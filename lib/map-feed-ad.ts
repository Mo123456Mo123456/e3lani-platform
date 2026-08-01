import type { Ad, AdContact, AdMedia, AdStatus } from "@/lib/e3lani-data";

type FeedLike = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  cityId: string;
  customCityName?: string | null;
  countryCode: string;
  media: { id: string; kind: "image" | "video"; uri: string; mediaAssetId?: number }[];
  contacts: { type: AdContact["type"]; value: string }[];
  status: string;
  revision: number;
  verified?: boolean;
  featured?: boolean;
  sponsored?: boolean;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  aiLabel?: Ad["aiLabel"];
  paymentStatus?: string;
  priceSnapshot?: Ad["priceSnapshot"];
};

export function mapFeedAd(dto: FeedLike): Ad {
  const media: AdMedia[] = dto.media.map((item) => ({
    id: item.id,
    kind: item.kind,
    uri: item.uri,
    mediaAssetId: item.mediaAssetId,
  }));
  const paymentStatus =
    dto.paymentStatus === "not_required" ||
    dto.paymentStatus === "pending" ||
    dto.paymentStatus === "paid" ||
    dto.paymentStatus === "failed"
      ? dto.paymentStatus
      : dto.paymentStatus === "unpaid"
        ? "pending"
        : "not_required";
  return {
    id: dto.id,
    ownerId: dto.ownerId,
    title: dto.title,
    description: dto.description,
    categoryId: dto.categoryId,
    cityId: dto.customCityName ? `other:${dto.customCityName}` : dto.cityId,
    countryCode: dto.countryCode,
    media,
    contacts: dto.contacts,
    status: dto.status as AdStatus,
    revision: dto.revision,
    verified: Boolean(dto.verified),
    featured: Boolean(dto.featured),
    sponsored: Boolean(dto.sponsored),
    createdAt: dto.createdAt,
    activatedAt: dto.activatedAt,
    expiresAt: dto.expiresAt,
    promotions: [],
    aiLabel: dto.aiLabel,
    paymentStatus,
    priceSnapshot: dto.priceSnapshot,
  };
}
