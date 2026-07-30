import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VisualFeed } from "@/components/visual-feed";
import { getAd } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const ad = await getAd(id);
    return {
      title: ad.title,
      description: ad.description,
      openGraph: {
        type: "article",
        images: ad.media[0]?.thumbnailUrl ?? ad.media[0]?.url,
      },
    };
  } catch {
    return { title: "الإعلان غير موجود" };
  }
}

export default async function AdPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en"; id: string }>;
}) {
  const { locale, id } = await params;
  let ad;
  try {
    ad = await getAd(id);
  } catch {
    notFound();
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Advertisement",
    name: ad.title,
    description: ad.description,
    datePosted: ad.createdAt,
    image: ad.media.map((media) => media.thumbnailUrl ?? media.url),
    areaServed: ad.city.nameEn,
    author: { "@type": "Organization", name: ad.advertiser.name },
  };
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <VisualFeed items={[ad]} locale={locale} />
    </main>
  );
}
