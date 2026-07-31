import { useCallback, useMemo } from "react";

import { trpc } from "@/lib/trpc";
import type { Category, City, PromotionCode } from "@/lib/e3lani-data";
import { calculateProductQuote } from "@/lib/product-pricing";
import type { PublicMediaPolicy } from "@/shared/media-policy";

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
  {
    id: "restaurants",
    ar: "مطاعم ومقاهي",
    en: "Restaurants & Cafes",
    icon: "restaurant",
  },
  {
    id: "fashion",
    ar: "أزياء وجمال",
    en: "Fashion & Beauty",
    icon: "checkroom",
  },
  {
    id: "equipment",
    ar: "معدات وأدوات",
    en: "Equipment & Tools",
    icon: "construction",
  },
  { id: "home", ar: "مستلزمات منزلية", en: "Home Essentials", icon: "home" },
];

const FALLBACK_CITIES: City[] = [
  { id: "riyadh", ar: "الرياض", en: "Riyadh", region: "riyadh" },
  { id: "jeddah", ar: "جدة", en: "Jeddah", region: "makkah" },
  { id: "makkah", ar: "مكة المكرمة", en: "Makkah", region: "makkah" },
  { id: "dammam", ar: "الدمام", en: "Dammam", region: "eastern" },
  { id: "khobar", ar: "الخبر", en: "Al Khobar", region: "eastern" },
  { id: "madinah", ar: "المدينة المنورة", en: "Madinah", region: "madinah" },
  { id: "buraydah", ar: "بريدة", en: "Buraydah", region: "qassim" },
  { id: "abha", ar: "أبها", en: "Abha", region: "asir" },
];

const FALLBACK_MEDIA_POLICY: PublicMediaPolicy = {
  imageMaxBytes: 5 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoMimeTypes: ["video/mp4"],
  requirePrimaryImage: true,
  maxImages: 10,
  maxVideos: 1,
};

const FALLBACK_PRICING_RULES = [
  {
    code: "highlight_3",
    labelAr: "إبراز 3 أيام",
    labelEn: "3-day highlight",
    priceHalalas: 1500,
    durationDays: 3,
  },
  {
    code: "highlight_7",
    labelAr: "إبراز 7 أيام",
    labelEn: "7-day highlight",
    priceHalalas: 2900,
    durationDays: 7,
  },
  {
    code: "top_category",
    labelAr: "أعلى القسم",
    labelEn: "Top of category",
    priceHalalas: 2400,
    durationDays: 7,
  },
  {
    code: "city_targeting",
    labelAr: "استهداف مدينة",
    labelEn: "City targeting",
    priceHalalas: 1200,
    durationDays: 7,
  },
];

const FALLBACK_CONFIG = {
  appName: "إعلاني | E3lani",
  currency: "SAR",
  pricingVersion: 1,
  effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
  finalBasePriceHalalas: 5900,
  vatBasisPoints: 1500,
  activeDurationDays: 30,
  republishCooldownHours: 72,
  mediaPolicy: FALLBACK_MEDIA_POLICY,
  paymentEnabled: false,
  paymentMode: "disabled" as const,
  paymentProvider: null,
  paymentDisclaimer:
    "Payment is disabled. Free profile publishing remains available.",
  pricingRules: FALLBACK_PRICING_RULES,
  promotions: FALLBACK_PRICING_RULES.map((rule) => ({
    code: rule.code,
    type: rule.code.startsWith("highlight") ? "highlight" : rule.code,
    labelAr: rule.labelAr,
    labelEn: rule.labelEn,
  })),
};

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
    () =>
      catalogQuery.data?.categories
        ? catalogQuery.data.categories.map((category) => ({
            id: category.id,
            ar: category.nameAr,
            en: category.nameEn,
            icon: category.icon || "category",
          }))
        : FALLBACK_CATEGORIES,
    [catalogQuery.data?.categories],
  );

  const cities = useMemo<City[]>(
    () =>
      catalogQuery.data?.cities
        ? catalogQuery.data.cities.map((city) => ({
            id: city.id,
            ar: city.nameAr,
            en: city.nameEn,
            region: city.regionId,
          }))
        : FALLBACK_CITIES,
    [catalogQuery.data?.cities],
  );

  const promotions = useMemo<ProductPromotion[]>(() => {
    const config = configQuery.data ?? FALLBACK_CONFIG;
    const labels = new Map(
      config.promotions
        .filter((promotion) => isPromotionCode(promotion.code))
        .map((promotion) => [promotion.code, promotion]),
    );

    return config.pricingRules.flatMap((rule) => {
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
      const config = configQuery.data ?? FALLBACK_CONFIG;
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
    config: configQuery.data ?? FALLBACK_CONFIG,
    categories,
    cities,
    promotions,
    calculateQuote,
    ready: true,
    isLoading: false,
    isError: false,
    usingFallback: catalogQuery.isError || configQuery.isError,
    retry,
  };
}
