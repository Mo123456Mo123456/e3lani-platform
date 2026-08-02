import type { Express, Request } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import sharp from "sharp";

import {
  adMedia,
  adRevisions,
  advertiserProfiles,
  ads,
  mediaAssets,
} from "../drizzle/schema";
import { getDb, requireDatabase } from "./db";
import { getReadyShareVariant } from "./share-media-service";
import { storageGetSignedUrl } from "./storage";

function html(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function xml(value: string): string {
  return html(value).replace(/\n/g, " ");
}

function requestOrigin(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwarded === "https" ? "https" : req.protocol === "https" ? "https" : "http";
  return `${protocol}://${req.get("host")}`;
}

async function shareMetadata(publicAdId: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({
      adId: ads.id,
      publicId: ads.publicId,
      revisionId: ads.currentRevisionId,
      title: adRevisions.title,
      description: adRevisions.description,
      username: advertiserProfiles.username,
      advertiserName: advertiserProfiles.displayName,
    })
    .from(ads)
    .innerJoin(adRevisions, eq(ads.currentRevisionId, adRevisions.id))
    .leftJoin(advertiserProfiles, eq(ads.advertiserProfileId, advertiserProfiles.id))
    .where(
      and(
        eq(ads.publicId, publicAdId),
        eq(ads.adStatus, "active"),
        isNull(ads.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;
  const media = await db
    .select({
      mediaType: mediaAssets.mediaType,
      storageKey: mediaAssets.storageKey,
      variants: mediaAssets.variants,
    })
    .from(adMedia)
    .innerJoin(mediaAssets, eq(adMedia.mediaAssetId, mediaAssets.id))
    .where(eq(adMedia.revisionId, rows[0].revisionId!))
    .orderBy(asc(adMedia.sortOrder))
    .limit(1);
  return { ...rows[0], media: media[0] ?? null };
}

function posterStorageKey(media: {
  mediaType: "image" | "video";
  storageKey: string;
  variants: unknown;
} | null): string | null {
  if (!media) return null;
  if (media.mediaType === "image") return media.storageKey;
  const variants = media.variants as Record<string, { key?: string }> | null;
  return variants?.poster?.key ?? null;
}

async function cardPng(publicAdId: string): Promise<Buffer | null> {
  const ad = await shareMetadata(publicAdId);
  if (!ad) return null;
  const key = posterStorageKey(ad.media);
  let background = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: "#252525" },
  }).png().toBuffer();
  if (key) {
    const signed = await storageGetSignedUrl(key);
    const response = await fetch(signed);
    if (response.ok) {
      const source = Buffer.from(await response.arrayBuffer());
      background = await sharp(source)
        .resize(1200, 630, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
    }
  }
  const title = xml(ad.title.slice(0, 72));
  const advertiser = xml(`@${ad.username ?? "e3lani"} · ${ad.advertiserName ?? "إعلاني"}`);
  const overlay = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="35%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.94"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#g)"/>
      <rect x="48" y="42" rx="22" width="310" height="68" fill="#FFC400"/>
      <text x="203" y="86" text-anchor="middle" font-family="DejaVu Sans" font-size="30" font-weight="800" fill="#111">إعلاني | E3lani</text>
      <text x="1148" y="492" text-anchor="end" direction="rtl" font-family="DejaVu Sans" font-size="46" font-weight="800" fill="#fff">${title}</text>
      <text x="1148" y="558" text-anchor="end" font-family="DejaVu Sans" font-size="27" font-weight="600" fill="#FFC400">${advertiser}</text>
    </svg>
  `);
  return sharp(background).composite([{ input: overlay }]).png().toBuffer();
}

export function registerPublicShareRoutes(app: Express) {
  app.get("/share/ad/:id/card.png", async (req, res) => {
    try {
      const card = await cardPng(req.params.id);
      if (!card) return res.sendStatus(404);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=900, stale-while-revalidate=86400");
      return res.send(card);
    } catch {
      return res.sendStatus(503);
    }
  });

  app.get("/share/ad/:id", async (req, res) => {
    try {
      const ad = await shareMetadata(req.params.id);
      if (!ad) return res.sendStatus(404);
      const origin = requestOrigin(req);
      const canonical = `${origin}/share/ad/${encodeURIComponent(ad.publicId)}`;
      const image = `${canonical}/card.png`;
      const title = `${ad.title} — إعلاني | E3lani`;
      const description = `بواسطة @${ad.username ?? "e3lani"} — ${ad.description.slice(0, 150)}`;
      const language = req.query.lang === "en" ? "en" : "ar";
      const direction = language === "ar" ? "rtl" : "ltr";
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      return res.send(`<!doctype html>
<html lang="${language}" dir="${direction}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${html(title)}</title>
  <meta name="description" content="${html(description)}"/>
  <link rel="canonical" href="${html(canonical)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:site_name" content="إعلاني | E3lani"/>
  <meta property="og:title" content="${html(title)}"/>
  <meta property="og:description" content="${html(description)}"/>
  <meta property="og:url" content="${html(canonical)}"/>
  <meta property="og:image" content="${html(image)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${html(title)}"/>
  <meta name="twitter:description" content="${html(description)}"/>
  <meta name="twitter:image" content="${html(image)}"/>
  <style>
    body{margin:0;background:#111;color:#fff;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center}
    main{width:min(720px,92vw);text-align:${direction === "rtl" ? "right" : "left"}}
    img{width:100%;border-radius:24px}a{display:inline-block;margin-top:18px;padding:14px 22px;border-radius:14px;background:#ffc400;color:#111;text-decoration:none;font-weight:800}
  </style>
</head>
<body><main><img src="${html(image)}" alt="${html(ad.title)}"/><h1>${html(ad.title)}</h1><p>${html(description)}</p><a href="e3lani://ad/${html(ad.publicId)}">فتح الإعلان في إعلاني</a></main></body>
</html>`);
    } catch {
      return res.sendStatus(503);
    }
  });

  app.get("/share/media/:id", async (req, res) => {
    try {
      const variant = await getReadyShareVariant(req.params.id);
      if (!variant?.storageKey) return res.sendStatus(404);
      const signed = await storageGetSignedUrl(variant.storageKey);
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(302, signed);
    } catch {
      return res.sendStatus(503);
    }
  });
}

