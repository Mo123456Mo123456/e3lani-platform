import type { Ad, Metrics } from "./e3lani-data";

export type FeedMode = "forYou" | "near" | "latest";

export function scoreAd(ad: Ad, metrics?: Metrics): number {
  const views = metrics?.views ?? 0;
  return (ad.featured ? 1 : 0) + (ad.sponsored ? 0.45 : 0) + views / 100000;
}

export function rankFeedAds(
  ads: Ad[],
  mode: FeedMode,
  options: {
    market: string;
    categoryId?: string;
    blockedOwners?: string[];
    metrics?: Record<string, Metrics>;
  },
): Ad[] {
  const blocked = new Set(options.blockedOwners ?? []);
  let next = ads.filter(
    (ad) =>
      ad.status === "active" &&
      !blocked.has(ad.ownerId) &&
      (!options.categoryId || ad.categoryId === options.categoryId),
  );

  if (mode === "near") {
    next = next.filter((ad) => (ad.countryCode ?? "SA") === options.market);
  }

  if (mode === "latest") {
    return [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (mode === "forYou") {
    return [...next].sort(
      (a, b) =>
        scoreAd(b, options.metrics?.[b.id]) - scoreAd(a, options.metrics?.[a.id]),
    );
  }

  return next;
}

export function contactCtaLabel(
  type: string | undefined,
  labels: Record<string, string>,
): string {
  if (!type) return labels.contact;
  return labels[type] ?? labels.contact;
}

export function buildContactUrl(type: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (type === "whatsapp") {
    return `https://wa.me/${trimmed.replace(/\D/g, "")}`;
  }
  if (type === "phone") {
    return `tel:${trimmed.replace(/[^\d+]/g, "")}`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
