import { describe, expect, it } from "vitest";

import { seedAds, type Ad } from "../lib/e3lani-data";
import { rankFeedAds, scoreForYouAd } from "../lib/e3lani-feed";

const metrics = {
  AD10001: { impressions: 128547, views: 128547, saves: 1926, shares: 3842, contacts: 1243 },
  AD10002: { impressions: 36240, views: 36240, saves: 318, shares: 229, contacts: 156 },
  AD10003: { impressions: 21874, views: 21874, saves: 210, shares: 180, contacts: 96 },
};

describe("E3lani feed ranking", () => {
  it("sorts latest strictly by createdAt descending", () => {
    const ranked = rankFeedAds(seedAds, { mode: "latest" });
    expect(ranked.map((ad) => ad.id)).toEqual(["AD10001", "AD10002", "AD10003"]);
  });

  it("filters near-you by market city ids", () => {
    const ranked = rankFeedAds(seedAds, {
      mode: "near",
      marketCityIds: ["riyadh", "jeddah"],
    });
    expect(ranked.map((ad) => ad.id)).toEqual(["AD10001", "AD10002"]);
    expect(ranked.every((ad) => ad.cityId !== "dubai")).toBe(true);
  });

  it("scores for-you with featured and sponsored signals", () => {
    const featured = scoreForYouAd(seedAds[0], { metrics });
    const sponsored = scoreForYouAd(seedAds[2], { metrics });
    const plain = scoreForYouAd(seedAds[1], { metrics });
    expect(featured).toBeGreaterThan(sponsored);
    expect(sponsored).toBeGreaterThan(plain);
  });

  it("places the highest for-you score first", () => {
    const ranked = rankFeedAds(seedAds, { mode: "forYou", metrics });
    expect(ranked[0]?.id).toBe("AD10001");
  });

  it("excludes blocked owners and non-active ads", () => {
    const paused: Ad = { ...seedAds[0], id: "AD-PAUSED", status: "paused" };
    const ranked = rankFeedAds([...seedAds, paused], {
      mode: "latest",
      blockedOwners: ["seed-owner-ae"],
    });
    expect(ranked.map((ad) => ad.id)).toEqual(["AD10001", "AD10002"]);
  });

  it("filters by category when provided", () => {
    const ranked = rankFeedAds(seedAds, {
      mode: "latest",
      categoryFilter: "restaurants",
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.categoryId).toBe("restaurants");
  });
});
