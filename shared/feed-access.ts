export const FEED_ACCESS_MODES = ["ONLY_PROFILE", "LAUNCH_FREE", "ONLY_PAID"] as const;

export type FeedAccessMode = (typeof FEED_ACCESS_MODES)[number];

export const DEFAULT_FEED_ACCESS_MODE: FeedAccessMode = "LAUNCH_FREE";

export function isFeedAccessMode(value: unknown): value is FeedAccessMode {
  return typeof value === "string" && FEED_ACCESS_MODES.includes(value as FeedAccessMode);
}

export function resolveFeedAccessMode(value: unknown): FeedAccessMode {
  if (typeof value !== "string") return DEFAULT_FEED_ACCESS_MODE;
  const normalized = value.trim().toUpperCase();
  return isFeedAccessMode(normalized) ? normalized : DEFAULT_FEED_ACCESS_MODE;
}

export function requiresPaymentForPublishing(mode: FeedAccessMode): boolean {
  return mode === "ONLY_PAID";
}

export function initialAdStatusForMode(
  mode: FeedAccessMode,
): "awaiting_payment" | "pending_review" {
  return requiresPaymentForPublishing(mode) ? "awaiting_payment" : "pending_review";
}

export function allowsHomeFeedDistribution(mode: FeedAccessMode): boolean {
  return mode !== "ONLY_PROFILE";
}
