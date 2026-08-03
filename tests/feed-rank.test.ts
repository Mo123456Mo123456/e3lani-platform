import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAUNCH_MODE,
  isPaymentFlowVisible,
  resolveCreateStatus,
  type Ad,
  type AdStatus,
} from "../lib/e3lani-data";
import { forYouScore, rankFeedAds } from "../lib/feed/rank";

function makeAd(id: string, overrides: Partial<Ad> = {}): Ad {
  return {
    id,
    ownerId: overrides.ownerId ?? `owner-${id}`,
    title: id,
    description: "وصف",
    categoryId: "services",
    cityId: "riyadh",
    countryCode: "SA",
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

describe("resolveCreateStatus / FREE_LAUNCH", () => {
  it("defaults to FREE_LAUNCH and activates ads immediately", () => {
    expect(DEFAULT_LAUNCH_MODE).toBe("FREE_LAUNCH");
    const result = resolveCreateStatus("FREE_LAUNCH", "2026-07-31T12:00:00.000Z");
    expect(result.status).toBe("active");
    expect(result.activatedAt).toBe("2026-07-31T12:00:00.000Z");
    expect(result.expiresAt).toBe("2026-08-30T12:00:00.000Z");
  });

  it("keeps PAID_ONLY on awaiting_payment and hides payment unless enabled", () => {
    expect(resolveCreateStatus("PAID_ONLY", "2026-07-31T12:00:00.000Z").status).toBe(
      "awaiting_payment" satisfies AdStatus,
    );
    expect(isPaymentFlowVisible("FREE_LAUNCH", false)).toBe(false);
    expect(isPaymentFlowVisible("PAID_ONLY", true)).toBe(true);
  });
});

describe("rankFeedAds", () => {
  const ads = [
    makeAd("A", {
      featured: true,
      sponsored: true,
      createdAt: "2026-07-30T10:00:00.000Z",
      ownerId: "o1",
    }),
    makeAd("B", {
      createdAt: "2026-07-31T12:00:00.000Z",
      ownerId: "o2",
      cityId: "jeddah",
    }),
    makeAd("C", {
      createdAt: "2026-07-29T10:00:00.000Z",
      ownerId: "o1",
      status: "paused",
    }),
    makeAd("D", {
      createdAt: "2026-07-31T11:00:00.000Z",
      ownerId: "o3",
      categoryId: "cars",
    }),
  ];

  it("latest sorts by createdAt descending and skips non-active ads", () => {
    const ranked = rankFeedAds(ads, { mode: "latest", marketCode: "SA" });
    expect(ranked.map((ad) => ad.id)).toEqual(["B", "D", "A"]);
  });

  it("forYou ranks featured/sponsored higher than plain recency", () => {
    const ranked = rankFeedAds(ads, {
      mode: "forYou",
      marketCode: "SA",
      metrics: { B: { views: 10 }, A: { views: 5 } },
    });
    expect(ranked[0]?.id).toBe("A");
    expect(forYouScore(ads[0]!, { A: { views: 5 } })).toBeGreaterThan(
      forYouScore(ads[1]!, { B: { views: 10 } }),
    );
  });

  it("supports category filter independently of tab mode", () => {
    const ranked = rankFeedAds(ads, {
      mode: "latest",
      marketCode: "SA",
      categoryId: "cars",
    });
    expect(ranked.map((ad) => ad.id)).toEqual(["D"]);
  });
});
