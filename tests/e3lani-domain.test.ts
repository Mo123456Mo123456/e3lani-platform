import { describe, expect, it } from "vitest";

import {
  REPUBLISH_COOLDOWN_MS,
  canRepublish,
  extendAdPeriod,
  moderatePendingAd,
  republishExpiredAd,
  transitionToPendingReview,
  type Ad,
  type AdStatus,
} from "../lib/e3lani-data";
import { calculateProductQuote } from "../lib/product-pricing";

const calculateQuote = (items: Parameters<typeof calculateProductQuote>[0]["items"]) =>
  calculateProductQuote({
    items,
    basePriceHalalas: 5900,
    vatBasisPoints: 1500,
    pricingRules: [
      { code: "highlight_3", priceHalalas: 1500 },
      { code: "highlight_7", priceHalalas: 2900 },
      { code: "top_category", priceHalalas: 3900 },
      { code: "city_targeting", priceHalalas: 1200 },
    ],
  });

function makeAd(status: AdStatus, overrides: Partial<Ad> = {}): Ad {
  return {
    id: "AD-TEST",
    ownerId: "U-TEST",
    title: "إعلان اختباري",
    description: "وصف اختباري طويل بما يكفي للتحقق من قواعد دورة حياة الإعلان.",
    categoryId: "services",
    cityId: "riyadh",
    media: [{ id: "M-TEST", kind: "image", uri: "asset:test" }],
    contacts: [{ type: "phone", value: "+966500000000" }],
    status,
    revision: 1,
    verified: false,
    featured: false,
    sponsored: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    promotions: [],
    ...overrides,
  };
}

describe("حساب سعر الإعلان", () => {
  it("يعيد سعر النشر الأساسي وضريبة القيمة المضافة المضمنة", () => {
    expect(calculateQuote([])).toEqual({
      items: [],
      totalHalalas: 5900,
      vatHalalas: 770,
    });
  });

  it("يزيل الإضافات المكررة قبل جمع السعر", () => {
    expect(calculateQuote(["highlight_3", "highlight_3"]).totalHalalas).toBe(7400);
  });

  it("يرفض خياري الإبراز المتعارضين", () => {
    expect(() => calculateQuote(["highlight_3", "highlight_7"])).toThrow(
      "HIGHLIGHT_OPTIONS_CONFLICT",
    );
  });
});

describe("مهلة إعادة النشر", () => {
  const now = Date.parse("2026-07-28T12:00:00.000Z");

  it("يسمح بأول إعادة نشر وبالإعادة عند اكتمال 72 ساعة", () => {
    expect(canRepublish(undefined, now)).toBe(true);
    expect(canRepublish(new Date(now - REPUBLISH_COOLDOWN_MS).toISOString(), now)).toBe(true);
  });

  it("يرفض الإعادة قبل اكتمال المهلة أو عند التاريخ غير الصالح", () => {
    expect(canRepublish(new Date(now - REPUBLISH_COOLDOWN_MS + 1).toISOString(), now)).toBe(false);
    expect(canRepublish("not-a-date", now)).toBe(false);
  });
});

describe("تكامل دورة حياة الإعلان", () => {
  it("ينقل الإعلان من الدفع إلى المراجعة ثم التفعيل والتمديد وإعادة النشر", () => {
    const awaitingPayment = makeAd("awaiting_payment");
    const pendingReview = transitionToPendingReview(awaitingPayment, ["highlight_3", "highlight_3"]);

    expect(pendingReview.status).toBe("pending_review");
    expect(pendingReview.promotions).toEqual(["highlight_3"]);

    const activatedAt = "2026-07-10T12:00:00.000Z";
    const active = moderatePendingAd(pendingReview, "approved", activatedAt);
    expect(active.status).toBe("active");
    expect(active.activatedAt).toBe(activatedAt);
    expect(active.expiresAt).toBe("2026-08-09T12:00:00.000Z");

    const extended = extendAdPeriod(active);
    expect(extended.expiresAt).toBe("2026-08-24T12:00:00.000Z");

    const republishedAt = "2026-08-25T12:00:00.000Z";
    const republished = republishExpiredAd({ ...extended, status: "expired" }, republishedAt);
    expect(republished).toMatchObject({
      status: "active",
      activatedAt: republishedAt,
      lastRepublishedAt: republishedAt,
      expiresAt: "2026-09-24T12:00:00.000Z",
    });
  });

  it("لا يغير الإعلان عندما لا تتوافق حالته مع الإجراء", () => {
    const active = makeAd("active", { expiresAt: "2026-08-01T00:00:00.000Z" });
    expect(transitionToPendingReview(active, [])).toBe(active);
    expect(moderatePendingAd(active, "rejected", "2026-07-28T00:00:00.000Z")).toBe(active);
    expect(republishExpiredAd(active, "2026-07-28T00:00:00.000Z")).toBe(active);

    const pending = makeAd("pending_review");
    expect(extendAdPeriod(pending)).toBe(pending);
  });

  it("يحترم مهلة إعادة النشر داخل التدفق المتكامل", () => {
    const now = "2026-07-28T12:00:00.000Z";
    const expired = makeAd("expired", {
      lastRepublishedAt: "2026-07-27T12:00:00.000Z",
    });
    expect(republishExpiredAd(expired, now)).toBe(expired);
  });
});
