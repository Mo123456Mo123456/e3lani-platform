import { and, eq } from "drizzle-orm";

import {
  adMetricsDaily,
  adPriceSnapshots,
  ads,
  favorites,
  mediaAssets,
  reports,
  users,
} from "../drizzle/schema";
import {
  createServerAd,
  listFeedAds,
  listSavedAdIds,
  recordAdEvent,
  reportAd,
  toggleFavorite,
} from "../server/ads-service";
import { getDb, requireDatabase } from "../server/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SERVER_AD_FLOW_FAILED: ${message}`);
}

const database = requireDatabase(await getDb());
const suffix = Date.now().toString(36);

const advertiserOpenId = `ci-advertiser-${suffix}`;
const viewerOpenId = `ci-viewer-${suffix}`;

await database.insert(users).values([
  {
    openId: advertiserOpenId,
    name: "CI Advertiser",
    phone: `+9665${Date.now().toString().slice(-8)}`,
    countryCode: "SA",
    loginMethod: "ci",
    accountType: "advertiser",
    role: "user",
    status: "active",
  },
  {
    openId: viewerOpenId,
    name: "CI Viewer",
    phone: `+9715${(Date.now() + 1).toString().slice(-8)}`,
    countryCode: "AE",
    loginMethod: "ci",
    accountType: "viewer",
    role: "user",
    status: "active",
  },
]);

const createdUsers = await database
  .select({ id: users.id, openId: users.openId })
  .from(users)
  .where(eq(users.loginMethod, "ci"));
const advertiser = createdUsers.find((user) => user.openId === advertiserOpenId);
const viewer = createdUsers.find((user) => user.openId === viewerOpenId);
assert(advertiser, "advertiser was not created");
assert(viewer, "viewer was not created");

const storageKey = `ci/${suffix}/ad-image.webp`;
const mediaInsert = await database.insert(mediaAssets).values({
  ownerId: advertiser.id,
  storageKey,
  originalUrl: `https://cdn.example.test/${storageKey}`,
  mediaType: "image",
  mimeType: "image/webp",
  bytes: 4096,
  width: 1080,
  height: 1920,
  processingStatus: "ready",
  variants: [],
});
const mediaAssetId = Number(mediaInsert[0].insertId);
assert(mediaAssetId > 0, "media asset was not created");

const createdAd = await createServerAd({
  ownerId: advertiser.id,
  title: "سيارة تجريبية لاختبار الخادم",
  description: "إعلان تكاملي نظيف للتأكد من الحفظ المركزي والظهور العالمي بين حسابين مختلفين.",
  categorySlug: "cars",
  cityCode: "riyadh",
  countryCode: "SA",
  mediaAssetIds: [mediaAssetId],
  contacts: [{ type: "phone", value: "+966500000001" }],
  accountType: "advertiser",
});

assert(createdAd.status === "active", "free launch ad must be active immediately");
assert(createdAd.paymentStatus === "not_required", "free launch must not create a paid state");
assert(createdAd.media.length === 1, "media was not attached to the revision");
assert(createdAd.priceSnapshot?.finalPrice === 0, "free launch price snapshot must be zero");
assert(
  createdAd.priceSnapshot?.freeReason === "global_free_mode",
  "free launch reason was not preserved",
);

const publicFeed = await listFeedAds({ countryCode: "ALL", forceCountryFilter: false, limit: 100 });
const visibleToViewer = publicFeed.find((ad) => ad.id === createdAd.id);
assert(visibleToViewer, "ad was not visible in the global server feed to another account");
assert(visibleToViewer.countryCode === "SA", "ad country was not preserved");

const saved = await toggleFavorite(viewer.id, createdAd.id);
assert(saved.saved, "viewer could not save advertiser ad");
const savedIds = await listSavedAdIds(viewer.id);
assert(savedIds.includes(createdAd.id), "saved ad was not persisted for viewer");

await recordAdEvent({
  publicAdId: createdAd.id,
  userId: viewer.id,
  eventType: "impression",
  dedupeSuffix: `viewer-${viewer.id}-impression`,
});
await recordAdEvent({
  publicAdId: createdAd.id,
  userId: viewer.id,
  eventType: "view",
  dedupeSuffix: `viewer-${viewer.id}-view`,
});
await recordAdEvent({
  publicAdId: createdAd.id,
  userId: viewer.id,
  eventType: "share",
  dedupeSuffix: `viewer-${viewer.id}-share`,
});

await reportAd({
  publicAdId: createdAd.id,
  reporterId: viewer.id,
  reason: "other",
  details: "CI integration report",
});

const adRows = await database
  .select({ id: ads.id })
  .from(ads)
  .where(and(eq(ads.publicId, createdAd.id), eq(ads.ownerId, advertiser.id)))
  .limit(1);
const databaseAd = adRows[0];
assert(databaseAd, "ad row was not persisted");

const [snapshotRows, favoriteRows, reportRows, metricRows] = await Promise.all([
  database
    .select()
    .from(adPriceSnapshots)
    .where(eq(adPriceSnapshots.adId, databaseAd.id)),
  database
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, viewer.id), eq(favorites.adId, databaseAd.id))),
  database
    .select()
    .from(reports)
    .where(and(eq(reports.reporterId, viewer.id), eq(reports.adId, databaseAd.id))),
  database
    .select()
    .from(adMetricsDaily)
    .where(eq(adMetricsDaily.adId, databaseAd.id)),
]);

assert(snapshotRows.length === 1, "historical ad price snapshot was not persisted");
assert(favoriteRows.length === 1, "favorite was not persisted centrally");
assert(reportRows.length === 1, "report was not persisted centrally");
assert(metricRows.length === 1, "daily metrics row was not persisted");
assert(metricRows[0].impressions >= 1, "impression metric was not recorded");
assert(metricRows[0].views >= 1, "view metric was not recorded");
assert(metricRows[0].shares >= 1, "share metric was not recorded");

console.log(
  JSON.stringify(
    {
      ok: true,
      advertiserId: advertiser.id,
      viewerId: viewer.id,
      adId: createdAd.id,
      status: createdAd.status,
      paymentStatus: createdAd.paymentStatus,
      globalFeedVisible: true,
      mediaAttached: createdAd.media.length,
      snapshotCount: snapshotRows.length,
      favoriteCount: favoriteRows.length,
      reportCount: reportRows.length,
      metrics: metricRows[0],
    },
    null,
    2,
  ),
);
