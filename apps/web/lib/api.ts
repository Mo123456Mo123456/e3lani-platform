import type { FeedItem } from "@e3lani/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function api<T>(path: string, revalidate = 30): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { next: { revalidate } });
  if (!response.ok) throw new Error(`API_${response.status}`);
  return response.json() as Promise<T>;
}

export async function getFeed(searchParams: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams(
    Object.entries(searchParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  try {
    return await api<{ items: FeedItem[]; nextCursor: string | null }>(
      `/content/feed?${query.toString()}`,
      15,
    );
  } catch {
    return { items: [], nextCursor: null };
  }
}

export async function getCatalog() {
  try {
    return await api<{
      categories: Array<{
        id: string;
        slug: string;
        nameAr: string;
        nameEn: string;
        children: Array<{ id: string; slug: string; nameAr: string; nameEn: string }>;
      }>;
      regions: Array<{
        id: string;
        nameAr: string;
        nameEn: string;
        cities: Array<{ id: string; nameAr: string; nameEn: string }>;
      }>;
    }>("/catalog", 300);
  } catch {
    return { categories: [], regions: [] };
  }
}

export async function getTicker() {
  try {
    return await api<Array<{ id: string; logoUrl: string }>>("/catalog/ticker", 60);
  } catch {
    return [];
  }
}

export async function getAd(id: string) {
  return api<
    FeedItem & {
      category: { id: string; nameAr: string; nameEn: string };
      saveCount: number;
    }
  >(`/content/distributions/${encodeURIComponent(id)}`, 20);
}

export async function getProfile(slug: string) {
  return api<{
    id: string;
    slug: string;
    name: string;
    bio: string | null;
    verified: boolean;
    avatarUrl: string | null;
    coverUrl: string | null;
    links: Record<string, string | null>;
    posts: Array<{ id: string; title: string; description: string | null; media: FeedItem["media"] }>;
    ads: Array<{ id: string; title: string; description: string | null; media: FeedItem["media"] }>;
  }>(`/content/profiles/${encodeURIComponent(slug)}`, 30);
}
