import { describe, expect, it } from "vitest";

import { normalizeLaunchPolicy } from "../lib/launch-policy";
import { pickPricingRule, resolvePublishQuote, type ScopedPricingRule } from "../lib/pricing/resolve-quote";

const paidPolicy = normalizeLaunchPolicy({
  globalFreeMode: false,
  globalPaidMode: true,
  paymentsEnabled: true,
  paymentRequired: true,
  pricingMode: "paid",
});

function rule(overrides: Partial<ScopedPricingRule>): ScopedPricingRule {
  return {
    id: "rule",
    name: "Rule",
    scopeType: "global",
    basePrice: 5900,
    currency: "SAR",
    taxRate: 0,
    isActive: true,
    priority: 1,
    ...overrides,
  };
}

describe("scoped pricing matching", () => {
  it("matches a category database reference", () => {
    const selected = pickPricingRule({
      policy: paidPolicy,
      categoryId: "7",
      rules: [rule({ id: "cars", scopeType: "category", categoryId: "7", priority: 20 })],
    });
    expect(selected?.id).toBe("cars");
  });

  it("matches user, brand and campaign references independently", () => {
    const rules = [
      rule({ id: "user", scopeType: "user", scopeRef: "42", priority: 30 }),
      rule({ id: "brand", scopeType: "brand", scopeRef: "91", priority: 20 }),
      rule({ id: "campaign", scopeType: "campaign", scopeRef: "77", priority: 10 }),
    ];

    expect(pickPricingRule({ policy: paidPolicy, rules, userId: "42" })?.id).toBe("user");
    expect(pickPricingRule({ policy: paidPolicy, rules, brandId: "91" })?.id).toBe("brand");
    expect(pickPricingRule({ policy: paidPolicy, rules, campaignId: "77" })?.id).toBe("campaign");
  });

  it("does not apply a subject rule to a different subject", () => {
    const selected = pickPricingRule({
      policy: paidPolicy,
      userId: "2",
      rules: [rule({ id: "user-one", scopeType: "user", scopeRef: "1" })],
    });
    expect(selected).toBeNull();
  });

  it("honors ad type restrictions", () => {
    const rules = [
      rule({ id: "video", adType: "video", priority: 10 }),
      rule({ id: "fallback", priority: 1 }),
    ];
    expect(pickPricingRule({ policy: paidPolicy, rules, adType: "image" })?.id).toBe("fallback");
    expect(pickPricingRule({ policy: paidPolicy, rules, adType: "video" })?.id).toBe("video");
  });

  it("uses the highest-priority matching discount without rewriting history", () => {
    const quote = resolvePublishQuote({
      policy: normalizeLaunchPolicy({
        ...paidPolicy,
        discountMode: true,
      }),
      countryId: "SA",
      rules: [
        rule({
          id: "sa-offer",
          name: "Saudi launch offer",
          scopeType: "country",
          countryId: "SA",
          basePrice: 5900,
          discountPrice: 2900,
          priority: 50,
        }),
      ],
    });

    expect(quote).toMatchObject({
      basePrice: 5900,
      discount: 3000,
      finalPrice: 2900,
      pricingRuleId: "sa-offer",
      offerOrCoupon: "Saudi launch offer",
      paymentStatus: "pending",
    });
  });
});
