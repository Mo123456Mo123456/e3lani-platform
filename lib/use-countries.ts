import { useMemo } from "react";

import { FALLBACK_COUNTRIES, type CountryInfo } from "@/lib/countries";
import { trpc } from "@/lib/trpc";

export function useCountries() {
  const query = trpc.countries.list.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const countries = useMemo<CountryInfo[]>(() => {
    if (query.data?.length) {
      return query.data.map((row) => ({
        code: row.code,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        flag: row.flag,
        dialCode: row.dialCode,
        currency: row.currency,
        defaultLocale: row.defaultLocale,
        timezone: row.timezone,
      }));
    }
    return FALLBACK_COUNTRIES;
  }, [query.data]);

  return {
    countries,
    isLoading: query.isLoading,
    isError: query.isError,
    fromDatabase: Boolean(query.data?.length),
    retry: () => void query.refetch(),
  };
}
