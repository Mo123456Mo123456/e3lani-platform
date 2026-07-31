import type { MarketCode } from "./e3lani-data";

export type UiCategory = {
  id: string;
  ar: string;
  en: string;
  icon: string;
};

export type Market = {
  code: MarketCode;
  ar: string;
  en: string;
  cities: { id: string; ar: string; en: string }[];
};

export const UI_CATEGORIES: UiCategory[] = [
  { id: "cars", ar: "السيارات", en: "Cars", icon: "directions-car" },
  { id: "real-estate", ar: "العقارات", en: "Real estate", icon: "home" },
  { id: "electronics", ar: "الإلكترونيات", en: "Electronics", icon: "smartphone" },
  { id: "furniture", ar: "الأثاث", en: "Furniture", icon: "chair" },
  { id: "fashion", ar: "الأزياء", en: "Fashion", icon: "checkroom" },
  { id: "services", ar: "الخدمات", en: "Services", icon: "handyman" },
  { id: "jobs", ar: "الوظائف", en: "Jobs", icon: "work" },
  { id: "equipment", ar: "المعدات", en: "Equipment", icon: "construction" },
  { id: "pets", ar: "الحيوانات المسموح بها", en: "Pets", icon: "pets" },
  { id: "games", ar: "الألعاب", en: "Games", icon: "sports-esports" },
  { id: "rentals", ar: "التأجير", en: "Rentals", icon: "key" },
  { id: "home", ar: "المنتجات المنزلية", en: "Home products", icon: "cottage" },
  { id: "homemade", ar: "الأسر المنتجة", en: "Home businesses", icon: "bakery-dining" },
  { id: "tickets", ar: "التذاكر", en: "Tickets", icon: "confirmation-number" },
  { id: "beauty", ar: "الصحة والجمال", en: "Health & beauty", icon: "spa" },
  { id: "education", ar: "التعليم", en: "Education", icon: "school" },
  { id: "travel", ar: "السفر", en: "Travel", icon: "flight" },
  { id: "restaurants", ar: "المطاعم", en: "Restaurants", icon: "restaurant" },
  { id: "brands", ar: "البراندات", en: "Brands", icon: "diamond" },
  { id: "donations", ar: "التبادل والتبرع", en: "Exchange & donation", icon: "recycling" },
  { id: "other", ar: "أخرى", en: "Other", icon: "more-horiz" },
];

export const MARKETS: Market[] = [
  {
    code: "SA",
    ar: "السعودية",
    en: "Saudi Arabia",
    cities: [
      { id: "riyadh", ar: "الرياض", en: "Riyadh" },
      { id: "jeddah", ar: "جدة", en: "Jeddah" },
      { id: "makkah", ar: "مكة", en: "Makkah" },
      { id: "madinah", ar: "المدينة", en: "Madinah" },
      { id: "dammam", ar: "الدمام", en: "Dammam" },
      { id: "abha", ar: "أبها", en: "Abha" },
      { id: "jazan", ar: "جازان", en: "Jazan" },
      { id: "tabuk", ar: "تبوك", en: "Tabuk" },
    ],
  },
  {
    code: "AE",
    ar: "الإمارات",
    en: "United Arab Emirates",
    cities: [
      { id: "dubai", ar: "دبي", en: "Dubai" },
      { id: "abu-dhabi", ar: "أبوظبي", en: "Abu Dhabi" },
      { id: "sharjah", ar: "الشارقة", en: "Sharjah" },
      { id: "ajman", ar: "عجمان", en: "Ajman" },
      { id: "ras-al-khaimah", ar: "رأس الخيمة", en: "Ras Al Khaimah" },
    ],
  },
  {
    code: "EG",
    ar: "مصر",
    en: "Egypt",
    cities: [
      { id: "cairo", ar: "القاهرة", en: "Cairo" },
      { id: "giza", ar: "الجيزة", en: "Giza" },
      { id: "alexandria", ar: "الإسكندرية", en: "Alexandria" },
      { id: "mansoura", ar: "المنصورة", en: "Mansoura" },
      { id: "aswan", ar: "أسوان", en: "Aswan" },
    ],
  },
];

export const TICKER_BRANDS = ["نَخبة", "URBAN", "رِواق", "VIA", "SAND", "تِقنية", "رؤية", "LUMA"];

export const getMarket = (code: MarketCode) =>
  MARKETS.find((item) => item.code === code) ?? MARKETS[0];

export const getCategory = (id: string) => UI_CATEGORIES.find((item) => item.id === id);
