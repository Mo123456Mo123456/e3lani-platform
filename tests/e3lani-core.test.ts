import { describe, expect, it } from "vitest";

import { REPUBLISH_COOLDOWN_MS, canRepublish, seedAds } from "../lib/e3lani-data";
import { calculateProductQuote } from "../lib/product-pricing";

const pricingRules = [
  { code: "highlight_3" as const, priceHalalas: 1500 },
  { code: "highlight_7" as const, priceHalalas: 2900 },
  { code: "top_category" as const, priceHalalas: 3900 },
  { code: "city_targeting" as const, priceHalalas: 1200 },
];

const quote = (items: Parameters<typeof calculateProductQuote>[0]["items"]) =>
  calculateProductQuote({ items, basePriceHalalas: 5900, vatBasisPoints: 1500, pricingRules });

describe("E3lani commercial rules", () => {
  it("uses a final base publishing price of 59 SAR", () => {
    const result = quote([]);
    expect(result.totalHalalas).toBe(5900);
    expect(result.vatHalalas).toBe(770);
  });

  it("adds promotions once and includes VAT in the total", () => {
    const result = quote(["highlight_3", "city_targeting", "highlight_3"]);
    expect(result.items).toEqual(["highlight_3", "city_targeting"]);
    expect(result.totalHalalas).toBe(8600);
    expect(result.vatHalalas).toBe(Math.round(8600 * 15 / 115));
  });

  it("rejects mutually exclusive highlight durations", () => {
    expect(() => quote(["highlight_3", "highlight_7"])).toThrow("HIGHLIGHT_OPTIONS_CONFLICT");
  });

  it("enforces the 72-hour republish cooldown", () => {
    const now = Date.parse("2026-07-28T12:00:00.000Z");
    expect(canRepublish(undefined, now)).toBe(true);
    expect(canRepublish(new Date(now - REPUBLISH_COOLDOWN_MS + 1).toISOString(), now)).toBe(false);
    expect(canRepublish(new Date(now - REPUBLISH_COOLDOWN_MS).toISOString(), now)).toBe(true);
  });

  it("does not model product prices or marketplace commissions", () => {
    for (const ad of seedAds) {
      expect(ad).not.toHaveProperty("price");
      expect(ad).not.toHaveProperty("commission");
    }
  });
});
