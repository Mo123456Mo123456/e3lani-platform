import { useCallback, useMemo } from "react";

import { LOCAL_CATEGORIES, LOCAL_CITIES } from "@/lib/e3lani-catalog";
import { trpc } from "@/lib/trpc";
import type { Category, City, PromotionCode } from "@/lib/e3lani-data";
import { calculateProductQuote } from "@/lib/product-pricing";

const PROMOTION_CODES: PromotionCode[] = [
  "highlight_3",
  "highlight_7",
  "top_category",
  "city_targeting",
];

function isPromotionCode(value: string): value is PromotionCode {
  return PROMOTION_CODES.includes(value as PromotionCode);
}

export type ProductPromotion = {
  code: PromotionCode;
  ar: string;
  en: string;
  priceHalalas: number;
  durationDays: number | null;
};

export function useProductData() {
  const catalogQuery = trpc.product.catalog.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  const configQuery = trpc.product.config.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const categories = useMemo<Category[]>(() => {
    const remote = (catalogQuery.data?.categories ?? []).map((category) => ({
      id: category.id,
      ar: category.nameAr,
      en: category.nameEn,
      icon: category.icon || "category",
    }));
    return remote.length > 0 ? remote : LOCAL_CATEGORIES;
  }, [catalogQuery.data?.categories]);

  const cities = useMemo<City[]>(() => {
    const remote = (catalogQuery.data?.cities ?? []).map((city) => ({
      id: city.id,
      ar: city.nameAr,
      en: city.nameEn,
      region: city.regionId,
    }));
    return remote.length > 0 ? remote : LOCAL_CITIES;
  }, [catalogQuery.data?.cities]);

  const promotions = useMemo<ProductPromotion[]>(() => {
    const labels = new Map(
      (configQuery.data?.promotions ?? [])
        .filter((promotion) => isPromotionCode(promotion.code))
        .map((promotion) => [promotion.code, promotion]),
    );

    return (configQuery.data?.pricingRules ?? []).flatMap((rule) => {
      if (!isPromotionCode(rule.code)) return [];
      const label = labels.get(rule.code);
      return [
        {
          code: rule.code,
          ar: label?.labelAr ?? rule.labelAr,
          en: label?.labelEn ?? rule.labelEn,
          priceHalalas: rule.priceHalalas,
          durationDays: rule.durationDays,
        },
      ];
    });
  }, [configQuery.data?.pricingRules, configQuery.data?.promotions]);

  const calculateQuote = useCallback(
    (items: PromotionCode[]) => {
      const config = configQuery.data;
      if (!config) throw new Error("PRODUCT_CONFIG_UNAVAILABLE");
      return calculateProductQuote({
        items,
        basePriceHalalas: config.finalBasePriceHalalas,
        vatBasisPoints: config.vatBasisPoints,
        pricingRules: promotions,
      });
    },
    [configQuery.data, promotions],
  );

  const retry = useCallback(() => {
    void Promise.all([catalogQuery.refetch(), configQuery.refetch()]);
  }, [catalogQuery, configQuery]);

  return {
    catalog: catalogQuery.data,
    config: configQuery.data,
    categories,
    cities,
    promotions,
    calculateQuote,
    ready: Boolean(catalogQuery.data && configQuery.data) || categories.length > 0,
    isLoading: (catalogQuery.isLoading || configQuery.isLoading) && categories.length === 0,
    isError: (catalogQuery.isError || configQuery.isError) && categories.length === 0,
    usingFallback: !catalogQuery.data,
    retry,
  };
}
