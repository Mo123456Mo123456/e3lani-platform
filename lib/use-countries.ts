import { useMemo } from "react";

import { FALLBACK_COUNTRIES, type CountryInfo } from "@/lib/countries";
import { trpc } from "@/lib/trpc";

/** Progressive country list — first page from DB, fallback only if empty. */
export function useCountries(options?: { limit?: number; q?: string }) {
  const pageQuery = trpc.countries.page.useQuery(
    {
      offset: 0,
      limit: options?.limit ?? 60,
      q: options?.q,
    },
    {
      staleTime: 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  );

  const countries = useMemo<CountryInfo[]>(() => {
    const items = pageQuery.data?.items;
    if (items?.length) {
      return items.map((row) => ({
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
  }, [pageQuery.data?.items]);

  return {
    countries,
    total: pageQuery.data?.total ?? countries.length,
    hasMore: pageQuery.data?.hasMore ?? false,
    isLoading: pageQuery.isLoading,
    isError: pageQuery.isError,
    fromDatabase: Boolean(pageQuery.data?.items?.length),
    retry: () => void pageQuery.refetch(),
    loadMore: async () => {
      if (!pageQuery.data?.hasMore) return;
      // Client can call countries.page with a higher offset when building a full picker.
      return pageQuery.refetch();
    },
  };
}
