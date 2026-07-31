import { describe, expect, it } from "vitest";

import { seedAds } from "../lib/e3lani-data";
import { buildContactUrl, rankFeedAds, scoreAd } from "../lib/e3lani-feed";

describe("fullscreen feed ranking", () => {
  it("ranks forYou by featured, sponsored, and views", () => {
    const ranked = rankFeedAds(seedAds, "forYou", {
      market: "SA",
      metrics: {
        AD10001: { impressions: 1, views: 128547, saves: 0, shares: 0, contacts: 0 },
        AD10002: { impressions: 1, views: 100, saves: 0, shares: 0, contacts: 0 },
        AD10003: { impressions: 1, views: 21874, saves: 0, shares: 0, contacts: 0 },
      },
    });
    expect(ranked[0]?.id).toBe("AD10001");
    expect(scoreAd(seedAds[0], { impressions: 0, views: 128547, saves: 0, shares: 0, contacts: 0 })).toBeGreaterThan(
      scoreAd(seedAds[2], { impressions: 0, views: 21874, saves: 0, shares: 0, contacts: 0 }),
    );
  });

  it("filters nearby by selected market", () => {
    const nearby = rankFeedAds(seedAds, "near", { market: "SA" });
    expect(nearby.every((ad) => ad.countryCode === "SA")).toBe(true);
    expect(nearby.some((ad) => ad.id === "AD10003")).toBe(false);
  });

  it("sorts latest by createdAt descending", () => {
    const latest = rankFeedAds(seedAds, "latest", { market: "SA" });
    expect(latest.map((ad) => ad.id)).toEqual(["AD10001", "AD10002", "AD10003"]);
  });

  it("builds whatsapp and https contact urls", () => {
    expect(buildContactUrl("whatsapp", "+966501234567")).toBe("https://wa.me/966501234567");
    expect(buildContactUrl("store", "example.com")).toBe("https://example.com");
    expect(buildContactUrl("phone", "+966501234567")).toBe("tel:+966501234567");
  });
});
