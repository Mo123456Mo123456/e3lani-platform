import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";
  const paths = ["", "/privacy", "/terms", "/safety"];
  return (["ar", "en"] as const).flatMap((locale) =>
    paths.map((path) => ({
      url: `${base}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: path ? ("monthly" as const) : ("hourly" as const),
      priority: path ? 0.5 : 1,
      alternates: {
        languages: {
          ar: `${base}/ar${path}`,
          en: `${base}/en${path}`,
        },
      },
    })),
  );
}
