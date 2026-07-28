import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/routers";
import type { Ad, AdMedia, Metrics } from "./e3lani-data";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type CentralAd = NonNullable<RouterOutput["data"]["ads"]["detail"]>;

function mediaStatus(value: CentralAd["media"][number]["processingStatus"]): AdMedia["processingStatus"] {
  if (value === "ready") return "ready";
  if (value === "failed") return "failed";
  return "processing";
}

export function centralAdToClientAd(value: CentralAd): Ad {
  const metrics: Metrics = {
    impressions: value.metrics.impressions,
    views: value.metrics.views,
    saves: value.metrics.saves,
    shares: value.metrics.shares,
    contacts: value.metrics.contacts,
  };

  return {
    id: value.id,
    ownerId: value.ownerId,
    title: value.title,
    description: value.description,
    categoryId: value.categoryId,
    cityId: value.cityId,
    media: value.media.map((media) => ({
      id: media.id,
      mediaAssetId: media.mediaAssetId,
      kind: media.kind,
      uri: media.uri,
      processingStatus: mediaStatus(media.processingStatus),
    })),
    contacts: value.contacts.map((contact) => ({ type: contact.type, value: contact.value })),
    status: value.status,
    revision: value.revision,
    verified: value.advertiser.verified,
    featured: false,
    sponsored: false,
    createdAt: value.createdAt,
    activatedAt: value.activatedAt,
    expiresAt: value.expiresAt,
    lastRepublishedAt: value.lastRepublishedAt,
    promotions: [],
    advertiserName: value.advertiser.name,
    advertiserSlug: value.advertiser.slug ?? undefined,
    advertiserAvatarUrl: value.advertiser.avatarUrl ?? undefined,
    metrics,
  };
}
