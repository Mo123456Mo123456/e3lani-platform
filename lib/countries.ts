/** Organizational country metadata. Never used alone to hide ads. */

export type CountryInfo = {
  code: string;
  nameAr: string;
  nameEn: string;
  flag: string;
  dialCode: string;
  currency: string;
  defaultLocale: string;
  timezone: string;
};

export const GLOBAL_MARKET = "ALL" as const;

export const ACCOUNT_COUNTRIES: CountryInfo[] = [
  {
    code: "SA",
    nameAr: "السعودية",
    nameEn: "Saudi Arabia",
    flag: "🇸🇦",
    dialCode: "+966",
    currency: "SAR",
    defaultLocale: "ar",
    timezone: "Asia/Riyadh",
  },
  {
    code: "AE",
    nameAr: "الإمارات",
    nameEn: "United Arab Emirates",
    flag: "🇦🇪",
    dialCode: "+971",
    currency: "AED",
    defaultLocale: "ar",
    timezone: "Asia/Dubai",
  },
  {
    code: "EG",
    nameAr: "مصر",
    nameEn: "Egypt",
    flag: "🇪🇬",
    dialCode: "+20",
    currency: "EGP",
    defaultLocale: "ar",
    timezone: "Africa/Cairo",
  },
  {
    code: "KW",
    nameAr: "الكويت",
    nameEn: "Kuwait",
    flag: "🇰🇼",
    dialCode: "+965",
    currency: "KWD",
    defaultLocale: "ar",
    timezone: "Asia/Kuwait",
  },
  {
    code: "QA",
    nameAr: "قطر",
    nameEn: "Qatar",
    flag: "🇶🇦",
    dialCode: "+974",
    currency: "QAR",
    defaultLocale: "ar",
    timezone: "Asia/Qatar",
  },
  {
    code: "BH",
    nameAr: "البحرين",
    nameEn: "Bahrain",
    flag: "🇧🇭",
    dialCode: "+973",
    currency: "BHD",
    defaultLocale: "ar",
    timezone: "Asia/Bahrain",
  },
  {
    code: "OM",
    nameAr: "عُمان",
    nameEn: "Oman",
    flag: "🇴🇲",
    dialCode: "+968",
    currency: "OMR",
    defaultLocale: "ar",
    timezone: "Asia/Muscat",
  },
  {
    code: "JO",
    nameAr: "الأردن",
    nameEn: "Jordan",
    flag: "🇯🇴",
    dialCode: "+962",
    currency: "JOD",
    defaultLocale: "ar",
    timezone: "Asia/Amman",
  },
  {
    code: "US",
    nameAr: "الولايات المتحدة",
    nameEn: "United States",
    flag: "🇺🇸",
    dialCode: "+1",
    currency: "USD",
    defaultLocale: "en",
    timezone: "America/New_York",
  },
  {
    code: "GB",
    nameAr: "المملكة المتحدة",
    nameEn: "United Kingdom",
    flag: "🇬🇧",
    dialCode: "+44",
    currency: "GBP",
    defaultLocale: "en",
    timezone: "Europe/London",
  },
];

export function getCountry(code: string | undefined | null): CountryInfo | undefined {
  if (!code) return undefined;
  return ACCOUNT_COUNTRIES.find((item) => item.code === code);
}

export function formatCountryLabel(
  code: string | undefined | null,
  locale: "ar" | "en" = "ar",
  cityName?: string,
): string {
  const country = getCountry(code);
  if (!country) return locale === "ar" ? "غير محدد" : "Unspecified";
  const name = locale === "ar" ? country.nameAr : country.nameEn;
  const base = `${country.flag} ${name}`;
  return cityName ? `${base} — ${cityName}` : base;
}

export function guessCountryFromPhone(phone: string): string {
  if (phone.startsWith("+971")) return "AE";
  if (phone.startsWith("+20")) return "EG";
  if (phone.startsWith("+965")) return "KW";
  if (phone.startsWith("+974")) return "QA";
  if (phone.startsWith("+973")) return "BH";
  if (phone.startsWith("+968")) return "OM";
  if (phone.startsWith("+962")) return "JO";
  if (phone.startsWith("+1")) return "US";
  if (phone.startsWith("+44")) return "GB";
  return "SA";
}
