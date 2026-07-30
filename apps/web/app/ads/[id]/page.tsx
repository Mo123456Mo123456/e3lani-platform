import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdFeed } from "@/components/ad-feed";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function getAd(id: string) {
  const response = await fetch(`${api}/api/v1/ads/${id}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as Parameters<typeof AdFeed>[0]["ads"][number];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const ad = await getAd((await params).id);
  return ad ? { title: ad.title, description: ad.description ?? undefined } : {};
}

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const ad = await getAd((await params).id);
  if (!ad) notFound();
  return (
    <main className="py-4">
      <AdFeed ads={[ad]} />
    </main>
  );
}
