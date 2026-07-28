import { describe, expect, it } from "vitest";

import { BASE_PRICE_HALALAS, REPUBLISH_COOLDOWN_MS, calculateQuote, canRepublish, seedAds } from "../lib/e3lani-data";

describe("E3lani commercial rules", () => {
  it("uses a final base publishing price of 59 SAR", () => {
    const quote = calculateQuote([]);
    expect(quote.totalHalalas).toBe(BASE_PRICE_HALALAS);
    expect(quote.totalHalalas).toBe(5900);
    expect(quote.vatHalalas).toBe(770);
  });

  it("adds promotions once and includes VAT in the total", () => {
    const quote = calculateQuote(["highlight_3", "city_targeting", "highlight_3"]);
    expect(quote.items).toEqual(["highlight_3", "city_targeting"]);
    expect(quote.totalHalalas).toBe(8600);
    expect(quote.vatHalalas).toBe(Math.round(8600 * 15 / 115));
  });

  it("rejects mutually exclusive highlight durations", () => {
    expect(() => calculateQuote(["highlight_3", "highlight_7"])).toThrow("HIGHLIGHT_OPTIONS_CONFLICT");
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
