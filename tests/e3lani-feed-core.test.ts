import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAUNCH_MODE,
  applyLaunchPublish,
  seedAds,
  shouldPublishFree,
  sortFeedAds,
  type Ad,
} from "../lib/e3lani-data";
import { citiesForMarket } from "../lib/e3lani-catalog";

const base = (overrides: Partial<Ad> = {}): Ad => ({
  ...seedAds[0],
  id: "T1",
  ...overrides,
});

describe("E3lani FREE_LAUNCH and feed core", () => {
  it("defaults to FREE_LAUNCH mode", () => {
    expect(DEFAULT_LAUNCH_MODE).toBe("FREE_LAUNCH");
    expect(shouldPublishFree()).toBe(true);
    expect(shouldPublishFree("PAID_ONLY")).toBe(false);
    expect(shouldPublishFree("PROFILE_ONLY")).toBe(false);
  });

  it("publishes free launch ads as active for 30 days", () => {
    const now = "2026-07-31T12:00:00.000Z";
    const ad = applyLaunchPublish(
      {
        ...base({ promotions: [] }),
        status: "awaiting_payment",
      },
      "FREE_LAUNCH",
      now,
    );
    expect(ad.status).toBe("active");
    expect(ad.activatedAt).toBe(now);
    expect(ad.expiresAt).toBe("2026-08-30T12:00:00.000Z");
  });

  it("keeps paid-only creates awaiting payment", () => {
    const ad = applyLaunchPublish(
      {
        ...base({ promotions: [] }),
        status: "awaiting_payment",
      },
      "PAID_ONLY",
      "2026-07-31T12:00:00.000Z",
    );
    expect(ad.status).toBe("awaiting_payment");
  });

  it("sorts forYou by featured, sponsored, and views", () => {
    const ads = [
      base({ id: "a", featured: false, sponsored: false, createdAt: "2026-07-01T00:00:00.000Z" }),
      base({ id: "b", featured: true, sponsored: false, createdAt: "2026-07-02T00:00:00.000Z" }),
      base({ id: "c", featured: false, sponsored: true, createdAt: "2026-07-03T00:00:00.000Z" }),
    ];
    const sorted = sortFeedAds(ads, "forYou", { viewsById: { a: 500000, b: 10, c: 10 } });
    // a wins on views, then featured b, then sponsored c
    expect(sorted.map((ad) => ad.id)).toEqual(["a", "b", "c"]);
  });

  it("filters nearby by market cities and sorts latest chronologically", () => {
    const ads = [
      base({ id: "riyadh", cityId: "riyadh", createdAt: "2026-07-01T00:00:00.000Z" }),
      base({ id: "dubai", cityId: "dubai", createdAt: "2026-07-03T00:00:00.000Z" }),
      base({ id: "jeddah", cityId: "jeddah", createdAt: "2026-07-02T00:00:00.000Z" }),
    ];
    const saCities = citiesForMarket("SA").map((city) => city.id);
    const nearby = sortFeedAds(ads, "near", { marketCityIds: saCities });
    expect(nearby.map((ad) => ad.id).sort()).toEqual(["jeddah", "riyadh"]);

    const latest = sortFeedAds(ads, "latest");
    expect(latest.map((ad) => ad.id)).toEqual(["dubai", "jeddah", "riyadh"]);
  });

  it("includes the three visual seed ads without marketplace price fields", () => {
    expect(seedAds).toHaveLength(3);
    for (const ad of seedAds) {
      expect(ad.status).toBe("active");
      expect(ad).not.toHaveProperty("price");
      expect(ad.media[0]?.uri).toMatch(/^https:\/\//);
    }
  });
});
