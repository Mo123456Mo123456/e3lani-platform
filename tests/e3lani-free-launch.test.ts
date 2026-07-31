import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAUNCH_MODE,
  FUTURE_PROMO_DAYS,
  FUTURE_PROMO_PRICE_HALALAS,
  buildContactUrl,
  buildFreeLaunchAd,
  cityIdsForMarket,
  fallbackCities,
} from "../lib/e3lani-data";

describe("E3lani free launch core", () => {
  it("defaults to FREE_LAUNCH with future promo price stored only as config", () => {
    expect(DEFAULT_LAUNCH_MODE).toBe("FREE_LAUNCH");
    expect(FUTURE_PROMO_PRICE_HALALAS).toBe(5900);
    expect(FUTURE_PROMO_DAYS).toBe(30);
  });

  it("publishes free-launch ads as active without promotions", () => {
    const now = "2026-07-31T12:00:00.000Z";
    const ad = buildFreeLaunchAd(
      {
        id: "AD-FREE",
        ownerId: "U1",
        title: "إعلان تجريبي",
        description: "وصف",
        categoryId: "cars",
        cityId: "riyadh",
        media: [{ id: "m1", kind: "image", uri: "https://example.com/a.jpg" }],
        contacts: [{ type: "whatsapp", value: "+966500000000" }],
        createdAt: now,
      },
      now,
    );
    expect(ad.status).toBe("active");
    expect(ad.sponsored).toBe(false);
    expect(ad.featured).toBe(false);
    expect(ad.promotions).toEqual([]);
    expect(ad.activatedAt).toBe(now);
    expect(ad.expiresAt).toBe("2026-08-30T12:00:00.000Z");
  });

  it("maps Saudi market cities from fallback catalog", () => {
    const ids = cityIdsForMarket(fallbackCities, "SA");
    expect(ids).toContain("riyadh");
    expect(ids).toContain("jeddah");
    expect(ids).not.toContain("dubai");
  });

  it("builds whatsapp and https contact urls", () => {
    expect(buildContactUrl({ type: "whatsapp", value: "+966 50 000 0000" })).toBe(
      "https://wa.me/966500000000",
    );
    expect(buildContactUrl({ type: "store", value: "example.com" })).toBe("https://example.com");
    expect(buildContactUrl({ type: "phone", value: "" })).toBeNull();
  });
});
