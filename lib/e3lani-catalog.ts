import type { Category, City } from "./e3lani-data";

export type Market = {
  code: string;
  ar: string;
  en: string;
  cityIds: string[];
};

export const MARKETS: Market[] = [
  {
    code: "SA",
    ar: "السعودية",
    en: "Saudi Arabia",
    cityIds: ["riyadh", "jeddah", "makkah", "madinah", "dammam", "abha", "jazan", "tabuk"],
  },
  {
    code: "AE",
    ar: "الإمارات",
    en: "United Arab Emirates",
    cityIds: ["dubai", "abu_dhabi", "sharjah", "ajman", "ras_al_khaimah"],
  },
  {
    code: "EG",
    ar: "مصر",
    en: "Egypt",
    cityIds: ["cairo", "giza", "alexandria", "mansoura", "aswan"],
  },
];

export const LOCAL_CITIES: City[] = [
  { id: "riyadh", ar: "الرياض", en: "Riyadh", region: "SA" },
  { id: "jeddah", ar: "جدة", en: "Jeddah", region: "SA" },
  { id: "makkah", ar: "مكة", en: "Makkah", region: "SA" },
  { id: "madinah", ar: "المدينة", en: "Madinah", region: "SA" },
  { id: "dammam", ar: "الدمام", en: "Dammam", region: "SA" },
  { id: "abha", ar: "أبها", en: "Abha", region: "SA" },
  { id: "jazan", ar: "جازان", en: "Jazan", region: "SA" },
  { id: "tabuk", ar: "تبوك", en: "Tabuk", region: "SA" },
  { id: "dubai", ar: "دبي", en: "Dubai", region: "AE" },
  { id: "abu_dhabi", ar: "أبوظبي", en: "Abu Dhabi", region: "AE" },
  { id: "sharjah", ar: "الشارقة", en: "Sharjah", region: "AE" },
  { id: "ajman", ar: "عجمان", en: "Ajman", region: "AE" },
  { id: "ras_al_khaimah", ar: "رأس الخيمة", en: "Ras Al Khaimah", region: "AE" },
  { id: "cairo", ar: "القاهرة", en: "Cairo", region: "EG" },
  { id: "giza", ar: "الجيزة", en: "Giza", region: "EG" },
  { id: "alexandria", ar: "الإسكندرية", en: "Alexandria", region: "EG" },
  { id: "mansoura", ar: "المنصورة", en: "Mansoura", region: "EG" },
  { id: "aswan", ar: "أسوان", en: "Aswan", region: "EG" },
];

export const LOCAL_CATEGORIES: Category[] = [
  { id: "cars", ar: "السيارات", en: "Cars", icon: "directions-car" },
  { id: "real_estate", ar: "العقارات", en: "Real estate", icon: "home" },
  { id: "electronics", ar: "الإلكترونيات", en: "Electronics", icon: "smartphone" },
  { id: "furniture", ar: "الأثاث", en: "Furniture", icon: "chair" },
  { id: "fashion", ar: "الأزياء", en: "Fashion", icon: "checkroom" },
  { id: "services", ar: "الخدمات", en: "Services", icon: "handyman" },
  { id: "jobs", ar: "الوظائف", en: "Jobs", icon: "work" },
  { id: "equipment", ar: "المعدات", en: "Equipment", icon: "construction" },
  { id: "pets", ar: "الحيوانات المسموح بها", en: "Pets", icon: "pets" },
  { id: "games", ar: "الألعاب", en: "Games", icon: "sports-esports" },
  { id: "rentals", ar: "التأجير", en: "Rentals", icon: "vpn-key" },
  { id: "home_goods", ar: "المنتجات المنزلية", en: "Home goods", icon: "cottage" },
  { id: "homemade", ar: "الأسر المنتجة", en: "Homemade", icon: "restaurant" },
  { id: "tickets", ar: "التذاكر", en: "Tickets", icon: "confirmation-number" },
  { id: "beauty", ar: "الصحة والجمال", en: "Health & beauty", icon: "spa" },
  { id: "education", ar: "التعليم", en: "Education", icon: "school" },
  { id: "travel", ar: "السفر", en: "Travel", icon: "flight" },
  { id: "restaurants", ar: "المطاعم", en: "Restaurants", icon: "restaurant-menu" },
  { id: "brands", ar: "البراندات", en: "Brands", icon: "storefront" },
  { id: "exchange", ar: "التبادل والتبرع", en: "Exchange & donate", icon: "swap-horiz" },
  { id: "other", ar: "أخرى", en: "Other", icon: "more-horiz" },
];

export const REPORT_REASONS_AR = [
  "محتوى مضلل",
  "منتج ممنوع",
  "احتيال",
  "رابط ضار",
  "انتحال",
  "محتوى غير مناسب",
  "إعلان مكرر",
  "مخالفة سياسة الدولة",
  "سبب آخر",
] as const;

export function citiesForMarket(marketCode: string, cities: City[] = LOCAL_CITIES): City[] {
  const market = MARKETS.find((item) => item.code === marketCode) ?? MARKETS[0];
  const ids = new Set(market.cityIds);
  return cities.filter((city) => ids.has(city.id) || city.region === market.code);
}
