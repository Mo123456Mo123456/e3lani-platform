/** Helpers for country display. Source of truth is the `countries` DB table via tRPC. */

export type CountryInfo = {
  code: string;
  nameAr: string;
  nameEn: string;
  flag: string;
  dialCode: string;
  currency: string;
  defaultLocale?: string;
  timezone?: string;
};

export const GLOBAL_MARKET = "ALL" as const;
export const MY_COUNTRY_MARKET = "MINE" as const;

/** Minimal offline fallback when the countries API is unavailable. */
export const FALLBACK_COUNTRIES: CountryInfo[] = [
  {
    code: "SA",
    nameAr: "السعودية",
    nameEn: "Saudi Arabia",
    flag: "🇸🇦",
    dialCode: "+966",
    currency: "SAR",
  },
  {
    code: "AE",
    nameAr: "الإمارات",
    nameEn: "United Arab Emirates",
    flag: "🇦🇪",
    dialCode: "+971",
    currency: "AED",
  },
  {
    code: "EG",
    nameAr: "مصر",
    nameEn: "Egypt",
    flag: "🇪🇬",
    dialCode: "+20",
    currency: "EGP",
  },
];

export function formatCountryLabel(
  country: CountryInfo | undefined | null,
  locale: "ar" | "en" = "ar",
  cityName?: string,
): string {
  if (!country) return locale === "ar" ? "غير محدد" : "Unspecified";
  const name = locale === "ar" ? country.nameAr : country.nameEn;
  const base = `${country.flag} ${name}`;
  return cityName ? `${base} — ${cityName}` : base;
}

export function findCountry(countries: CountryInfo[], code: string | undefined | null) {
  if (!code) return undefined;
  return countries.find((item) => item.code === code);
}

export function guessCountryFromPhone(phone: string, countries: CountryInfo[]): string {
  const sorted = [...countries].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const country of sorted) {
    if (phone.startsWith(country.dialCode)) return country.code;
  }
  return "SA";
}
