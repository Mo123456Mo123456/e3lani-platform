import { describe, expect, it } from "vitest";

import type { Ad } from "../lib/e3lani-data";
import { GLOBAL_MARKET, rankFeedAds } from "../lib/feed/rank";
import {
  DEFAULT_LAUNCH_POLICY,
  isPublishingFree,
  launchPolicyImpact,
  normalizeLaunchPolicy,
  shouldShowPaymentUi,
} from "../lib/launch-policy";
import { scanAdContent, textSimilarity } from "../lib/moderation/ai-scan";
import { resolvePublishQuote } from "../lib/pricing/resolve-quote";

function ad(id: string, countryCode: string, overrides: Partial<Ad> = {}): Ad {
  return {
    id,
    ownerId: `o-${id}`,
    title: id,
    description: "وصف",
    categoryId: "services",
    cityId: countryCode === "AE" ? "dubai" : countryCode === "EG" ? "cairo" : "riyadh",
    countryCode,
    media: [{ id: `m-${id}`, kind: "image", uri: "asset:poster" }],
    contacts: [{ type: "phone", value: "+966500000000" }],
    status: "active",
    revision: 1,
    verified: false,
    featured: false,
    sponsored: false,
    createdAt: "2026-07-31T10:00:00.000Z",
    promotions: [],
    ...overrides,
  };
}

describe("global open launch policy", () => {
  it("defaults to free global publishing with payments off", () => {
    expect(DEFAULT_LAUNCH_POLICY.globalFreeMode).toBe(true);
    expect(DEFAULT_LAUNCH_POLICY.paymentsEnabled).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.paymentRequired).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.allCountriesVisibility).toBe(true);
    expect(DEFAULT_LAUNCH_POLICY.instantPublishing).toBe(true);
    expect(DEFAULT_LAUNCH_POLICY.manualPreApproval).toBe(false);
    expect(isPublishingFree(DEFAULT_LAUNCH_POLICY)).toBe(true);
    expect(shouldShowPaymentUi(DEFAULT_LAUNCH_POLICY)).toBe(false);
  });

  it("keeps historical quote snapshots free under global free mode", () => {
    const quote = resolvePublishQuote({
      policy: DEFAULT_LAUNCH_POLICY,
      countryId: "SA",
      rules: [
        {
          id: "sa-paid",
          name: "SA paid",
          scopeType: "country",
          countryId: "SA",
          basePrice: 5900,
          currency: "SAR",
          taxRate: 0.15,
          isActive: true,
          priority: 10,
        },
      ],
    });
    expect(quote.paymentStatus).toBe("not_required");
    expect(quote.finalPrice).toBe(0);
    expect(quote.freeReason).toBe("global_free_mode");
  });

  it("can resolve paid country pricing when free mode is off", () => {
    const policy = normalizeLaunchPolicy({
      globalFreeMode: false,
      paymentsEnabled: true,
      paymentRequired: true,
      pricingMode: "paid",
      taxEnabled: true,
    });
    const quote = resolvePublishQuote({
      policy,
      countryId: "AE",
      rules: [
        {
          id: "ae",
          name: "UAE",
          scopeType: "country",
          countryId: "AE",
          basePrice: 4900,
          currency: "AED",
          taxRate: 0.05,
          isActive: true,
          priority: 5,
        },
      ],
    });
    expect(quote.currency).toBe("AED");
    expect(quote.basePrice).toBe(4900);
    expect(quote.finalPrice).toBe(4900 + Math.round(4900 * 0.05));
    expect(quote.paymentStatus).toBe("pending");
  });

  it("explains admin impact in Arabic", () => {
    const lines = launchPolicyImpact(DEFAULT_LAUNCH_POLICY, "ar");
    expect(lines.some((line) => line.includes("مجانية عالميًا"))).toBe(true);
  });
});

describe("global feed visibility", () => {
  const ads = [
    ad("SA1", "SA", { featured: true, createdAt: "2026-07-30T10:00:00.000Z" }),
    ad("AE1", "AE", { createdAt: "2026-07-31T12:00:00.000Z" }),
    ad("EG1", "EG", { createdAt: "2026-07-31T11:00:00.000Z" }),
  ];

  it("shows every country in forYou when market is ALL", () => {
    const ranked = rankFeedAds(ads, {
      mode: "forYou",
      marketCode: GLOBAL_MARKET,
      allCountriesVisibility: true,
    });
    expect(ranked.map((item) => item.id).sort()).toEqual(["AE1", "EG1", "SA1"]);
  });

  it("does not hide foreign ads for a Saudi account browsing forYou without force filter", () => {
    const ranked = rankFeedAds(ads, {
      mode: "forYou",
      marketCode: "SA",
      forceCountryFilter: false,
      allCountriesVisibility: true,
    });
    expect(ranked.some((item) => item.countryCode === "AE")).toBe(true);
    expect(ranked.some((item) => item.countryCode === "EG")).toBe(true);
  });

  it("filters only when the user explicitly chooses a country", () => {
    const ranked = rankFeedAds(ads, {
      mode: "latest",
      marketCode: "AE",
      forceCountryFilter: true,
      allCountriesVisibility: true,
    });
    expect(ranked.map((item) => item.id)).toEqual(["AE1"]);
  });
});

describe("AI moderation heuristics", () => {
  it("keeps clean ads published", () => {
    expect(scanAdContent({ title: "شقة للإيجار في الرياض", description: "غرفتين" }).label).toBe(
      "SAFE",
    );
  });

  it("auto-pauses clearly blocked content with contextual phrases", () => {
    const result = scanAdContent({ title: "بيع سلاح ناري", description: "متوفر الآن" });
    expect(result.label).toBe("BLOCKED");
    expect(result.autoAction).toBe("auto_pause");
  });

  it("does not auto-pause on a lone ambiguous word without context", () => {
    const result = scanAdContent({
      title: "دورة عن تاريخ السلاح في المتاحف",
      description: "محتوى تعليمي للمعارض",
    });
    expect(result.autoAction).not.toBe("auto_pause");
  });

  it("flags near-duplicate owner copy for review", () => {
    const prior = "شقة مفروشة للإيجار شمال الرياض غرفتين وصالة";
    const result = scanAdContent({
      title: "شقة مفروشة للإيجار شمال الرياض",
      description: "غرفتين وصالة",
      recentOwnerTexts: [prior],
    });
    expect(result.reasons).toContain("near_duplicate");
    expect(result.autoAction).toBe("flag_for_admin");
  });

  it("computes token similarity for duplicate detection", () => {
    expect(textSimilarity("hello world test", "hello world test")).toBe(1);
    expect(textSimilarity("hello world", "unrelated stuff")).toBeLessThan(0.3);
  });
});

describe("per-user free pricing rules", () => {
  const paidPolicy = normalizeLaunchPolicy({
    globalFreeMode: false,
    pricingMode: "paid",
    paymentsEnabled: true,
    paymentRequired: true,
    firstAdFree: true,
    freeAdsPerUser: 2,
    couponSystem: true,
    discountMode: false,
    taxEnabled: false,
  });

  it("makes the first ad free when firstAdFree is on", () => {
    const quote = resolvePublishQuote({
      policy: paidPolicy,
      userAdCount: 0,
      rules: [
        {
          id: "r1",
          name: "Global",
          scopeType: "global",
          basePrice: 5900,
          currency: "SAR",
          taxRate: 0,
          isActive: true,
          priority: 1,
        },
      ],
    });
    expect(quote.finalPrice).toBe(0);
    expect(quote.freeReason).toBe("first_ad_free");
    expect(quote.paymentStatus).toBe("not_required");
  });

  it("applies percent coupons when publishing is paid", () => {
    const quote = resolvePublishQuote({
      policy: { ...paidPolicy, firstAdFree: false, freeAdsPerUser: null },
      userAdCount: 5,
      coupon: { code: "SAVE50", discountType: "percent", discountValue: 50 },
      rules: [
        {
          id: "r1",
          name: "Global",
          scopeType: "global",
          basePrice: 5900,
          currency: "SAR",
          taxRate: 0,
          isActive: true,
          priority: 1,
        },
      ],
    });
    expect(quote.finalPrice).toBe(2950);
    expect(quote.offerOrCoupon).toBe("SAVE50");
  });
});

describe("payment adapters", () => {
  it("does not create a paid order for free publish", async () => {
    const { paymentStatusForFreePublish, sandboxPaymentAdapter } = await import(
      "../lib/payments/providers"
    );
    expect(paymentStatusForFreePublish()).toBe("not_required");
    const zero = await sandboxPaymentAdapter.createPayment({
      amount: 0,
      currency: "SAR",
      countryCode: "SA",
      adId: "AD1",
      userId: "U1",
    });
    expect(zero.status).toBe("not_required");
    expect(zero.externalId).toBeNull();
  });
});
