import type { PromotionCode } from "@/lib/e3lani-data";

export type ProductPricingRule = {
  code: PromotionCode;
  priceHalalas: number;
};

export function calculateProductQuote(input: {
  items: PromotionCode[];
  basePriceHalalas: number;
  vatBasisPoints: number;
  pricingRules: ProductPricingRule[];
}) {
  const unique = [...new Set(input.items)];
  if (unique.includes("highlight_3") && unique.includes("highlight_7")) {
    throw new Error("HIGHLIGHT_OPTIONS_CONFLICT");
  }

  const prices = new Map(input.pricingRules.map((rule) => [rule.code, rule.priceHalalas]));
  const promotionTotal = unique.reduce((total, code) => {
    const price = prices.get(code);
    if (price === undefined) throw new Error("PROMOTION_NOT_AVAILABLE");
    return total + price;
  }, 0);
  const totalHalalas = input.basePriceHalalas + promotionTotal;
  const vatHalalas = Math.round(
    (totalHalalas * input.vatBasisPoints) / (10_000 + input.vatBasisPoints),
  );

  return { items: unique, totalHalalas, vatHalalas };
}
