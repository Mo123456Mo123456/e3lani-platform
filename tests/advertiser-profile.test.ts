import { describe, expect, it } from "vitest";

import { normalizeAdvertiserSlug } from "../server/advertiser-service";

describe("advertiser profile slug", () => {
  it("normalizes spaces and punctuation to a stable lowercase slug", () => {
    expect(normalizeAdvertiserSlug("  My Advertiser.Page  ")).toBe("my-advertiser-page");
  });

  it("collapses repeated separators and strips unsafe characters", () => {
    expect(normalizeAdvertiserSlug("A---B__C")).toBe("a-b-c");
    expect(normalizeAdvertiserSlug("صفحة معلن")).toBe("");
  });
});
