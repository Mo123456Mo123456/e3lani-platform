import { useCallback, useMemo } from "react";

import { trpc } from "@/lib/trpc";
import type { Category, City, PromotionCode } from "@/lib/e3lani-data";
import { calculateProductQuote } from "@/lib/product-pricing";

const PROMOTION_CODES: PromotionCode[] = [
  "highlight_3",
  "highlight_7",
  "top_category",
  "city_targeting",
];

const FALLBACK_CATEGORIES: Category[] = [
  { id: "real-estate", ar: "العقارات", en: "Real Estate", icon: "apartment" },
  { id: "cars", ar: "السيارات", en: "Cars", icon: "directions-car" },
  { id: "electronics", ar: "الإلكترونيات", en: "Electronics", icon: "devices" },
  { id: "furniture", ar: "الأثاث", en: "Furniture", icon: "chair" },
  { id: "services", ar: "الخدمات", en: "Services", icon: "handyman" },
  { id: "brands", ar: "البراندات", en: "Brands", icon: "sell" },
  { id: "restaurants", ar: "مطاعم ومقاهي", en: "Restaurants & Cafes", icon: "restaurant" },
  { id: "fashion", ar: "أزياء وجمال", en: "Fashion & Beauty", icon: "checkroom" },
  { id: "equipment", ar: "معدات وأدوات", en: "Equipment & Tools", icon: "construction" },
  { id: "home", ar: "مستلزمات منزلية", en: "Home Essentials", icon: "home" },
];

const FALLBACK_CITIES: City[] = [
  { id: "riyadh", ar: "الرياض", en: "Riyadh", region: "riyadh" },
  { id: "jeddah", ar: "جدة", en: "Jeddah", region: "makkah" },
  { id: "makkah", ar: "مكة المكرمة", en: "Makkah", region: "makkah" },
  { id: "dammam", ar: "الدمام", en: "Dammam", region: "eastern" },
  { id: "khobar", ar: "الخبر", en: "Al Khobar", region: "eastern" },
  { id: "madinah", ar: "المدينة المنورة", en: "Madinah", region: "madinah" },
  { id: "tabuk", ar: "تبوك", en: "Tabuk", region: "tabuk" },
  { id: "abha", ar: "أبها", en: "Abha", region: "asir" },
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

  const categories = useMemo<Category[]>(
    () => {
      if (!catalogQuery.data) return FALLBACK_CATEGORIES;
      return catalogQuery.data.categories.map((category) => ({
          id: category.id,
          ar: category.nameAr,
          en: category.nameEn,
          icon: category.icon || "category",
        }));
    },
    [catalogQuery.data?.categories],
  );

  const cities = useMemo<City[]>(
    () => {
      if (!catalogQuery.data) return FALLBACK_CITIES;
      return catalogQuery.data.cities.map((city) => ({
          id: city.id,
          ar: city.nameAr,
          en: city.nameEn,
          region: city.regionId,
        }));
    },
    [catalogQuery.data?.cities],
  );

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
    ready: Boolean(catalogQuery.data && configQuery.data),
    isLoading: catalogQuery.isLoading || configQuery.isLoading,
    isError: catalogQuery.isError || configQuery.isError,
    catalogIsError: catalogQuery.isError,
    configIsError: configQuery.isError,
    isFallbackCatalog: !catalogQuery.data,
    retry,
  };
}
