import { and, eq } from "drizzle-orm";

import { appSettings } from "../drizzle/schema";
import {
  DEFAULT_FEED_ACCESS_MODE,
  resolveFeedAccessMode,
  requiresPaymentForPublishing,
  type FeedAccessMode,
} from "../shared/feed-access";
import * as db from "./db";

function modeFromSetting(value: unknown): FeedAccessMode | null {
  if (typeof value === "string") return resolveFeedAccessMode(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const setting = value as Record<string, unknown>;
  const candidate = setting.mode ?? setting.feedAccessMode ?? setting.FEED_ACCESS_MODE;
  return typeof candidate === "string" ? resolveFeedAccessMode(candidate) : null;
}

async function readCentralFeedAccessMode(): Promise<FeedAccessMode> {
  const environmentMode = process.env.FEED_ACCESS_MODE;
  if (environmentMode?.trim()) return resolveFeedAccessMode(environmentMode);

  const database = await db.getDb();
  if (!database) return DEFAULT_FEED_ACCESS_MODE;

  const rows = await database
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(and(eq(appSettings.settingKey, "feed.access"), eq(appSettings.isPublic, 1)))
    .limit(1);

  return modeFromSetting(rows[0]?.value) ?? DEFAULT_FEED_ACCESS_MODE;
}

export async function getPublicProductConfig() {
  const [baseConfig, feedAccessMode] = await Promise.all([
    db.getPublicProductConfig(),
    readCentralFeedAccessMode(),
  ]);

  const publishingRequiresPayment = requiresPaymentForPublishing(feedAccessMode);
  const paymentEnabled = publishingRequiresPayment && baseConfig.paymentEnabled;

  return {
    ...baseConfig,
    feedAccessMode,
    publishingRequiresPayment,
    publishingIsFree: feedAccessMode === "LAUNCH_FREE",
    paymentEnabled,
    paymentMode: paymentEnabled ? baseConfig.paymentMode : ("disabled" as const),
    paymentProvider: paymentEnabled ? baseConfig.paymentProvider : null,
    paymentDisclaimer: paymentEnabled
      ? baseConfig.paymentDisclaimer
      : "Payment is disabled. Publishing is currently free and ads go directly to review.",
  };
}
