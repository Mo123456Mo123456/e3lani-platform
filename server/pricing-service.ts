import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { ads, categories, countries, scopedPricingRules } from "../drizzle/schema";
import {
  isPublishingFree,
  normalizeLaunchPolicy,
  shouldShowPaymentUi,
  type LaunchPolicy,
} from "../lib/launch-policy";
import {
  pickPricingRule,
  resolvePublishQuote,
  type PriceSnapshot,
  type ScopedPricingRule,
} from "../lib/pricing/resolve-quote";
import { writeAuditLog } from "./audit-service";
import { resolveActiveCoupon, userHasActiveExemption } from "./coupons-service";
import { getDb, getPublicProductConfig, requireDatabase } from "./db";

export type ServerQuoteInput = {
  countryCode?: string;
  categorySlug?: string;
  accountType?: string;
  userId?: number;
  brandId?: number;
  campaignId?: number;
  adType?: string;
  couponCode?: string;
};

export async function loadLaunchPolicy(): Promise<LaunchPolicy> {
  const config = await getPublicProductConfig();
  return normalizeLaunchPolicy(config.launchPolicy);
}

export async function listActiveScopedRules(): Promise<ScopedPricingRule[]> {
  const db = requireDatabase(await getDb());
  const now = new Date();
  const rows = await db
    .select({
      id: scopedPricingRules.publicId,
      name: scopedPricingRules.name,
      scopeType: scopedPricingRules.scopeType,
      countryCode: countries.code,
      categoryId: scopedPricingRules.categoryId,
      accountType: scopedPricingRules.accountType,
      scopeRef: scopedPricingRules.scopeRef,
      adType: scopedPricingRules.adType,
      basePrice: scopedPricingRules.basePrice,
      discountPrice: scopedPricingRules.discountPrice,
      currency: scopedPricingRules.currency,
      taxRate: scopedPricingRules.taxRate,
      startsAt: scopedPricingRules.startsAt,
      endsAt: scopedPricingRules.endsAt,
      isActive: scopedPricingRules.isActive,
      priority: scopedPricingRules.priority,
    })
    .from(scopedPricingRules)
    .leftJoin(countries, eq(scopedPricingRules.countryId, countries.id))
    .where(
      and(
        eq(scopedPricingRules.isActive, 1),
        or(isNull(scopedPricingRules.startsAt), lte(scopedPricingRules.startsAt, now)),
        or(isNull(scopedPricingRules.endsAt), gte(scopedPricingRules.endsAt, now)),
      ),
    )
    .orderBy(desc(scopedPricingRules.priority), asc(scopedPricingRules.id));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    scopeType: row.scopeType as ScopedPricingRule["scopeType"],
    countryId: row.countryCode ?? null,
    categoryId: row.categoryId != null ? String(row.categoryId) : null,
    accountType: row.accountType,
    scopeRef: row.scopeRef,
    adType: row.adType,
    basePrice: row.basePrice,
    discountPrice: row.discountPrice,
    currency: row.currency,
    taxRate: (row.taxRate ?? 0) / 10_000,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: row.isActive === 1,
    priority: row.priority,
  }));
}

async function resolveCategoryReference(categorySlug?: string): Promise<string | undefined> {
  if (!categorySlug) return undefined;
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.slug, categorySlug), eq(categories.isActive, 1)))
    .limit(1);
  return rows[0] ? String(rows[0].id) : undefined;
}

export async function countUserAds(userId: number): Promise<number> {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(ads)
    .where(and(eq(ads.ownerId, userId), isNull(ads.deletedAt)));
  return Number(rows[0]?.count ?? 0);
}

export async function resolveServerPublishQuote(input: ServerQuoteInput): Promise<{
  policy: LaunchPolicy;
  quote: PriceSnapshot;
  paymentUiVisible: boolean;
  paymentProviderReady: boolean;
  blockPublishReason: string | null;
  couponId?: number | null;
}> {
  const [policy, rules, config, categoryId] = await Promise.all([
    loadLaunchPolicy(),
    listActiveScopedRules().catch(() => [] as ScopedPricingRule[]),
    getPublicProductConfig(),
    resolveCategoryReference(input.categorySlug),
  ]);

  const userAdCount =
    input.userId != null ? await countUserAds(input.userId).catch(() => 0) : 0;
  const hasExemption =
    input.userId != null
      ? await userHasActiveExemption(input.userId, input.brandId).catch(() => false)
      : false;
  const coupon =
    policy.couponSystem && input.couponCode
      ? await resolveActiveCoupon({
          code: input.couponCode,
          countryCode: input.countryCode,
          userId: input.userId,
        }).catch(() => null)
      : null;

  const quote = resolvePublishQuote({
    policy,
    rules,
    countryId: input.countryCode?.toUpperCase(),
    categoryId,
    accountType: input.accountType,
    userId: input.userId != null ? String(input.userId) : undefined,
    brandId: input.brandId != null ? String(input.brandId) : undefined,
    campaignId: input.campaignId != null ? String(input.campaignId) : undefined,
    adType: input.adType,
    userAdCount,
    hasExemption,
    coupon: coupon
      ? {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          name: coupon.name,
        }
      : null,
  });

  const paymentUiVisible = shouldShowPaymentUi(policy);
  const paymentProviderReady =
    config.paymentEnabled &&
    config.paymentMode === "production" &&
    Boolean(config.paymentProvider) &&
    config.paymentProvider !== "sandbox";

  let blockPublishReason: string | null = null;
  if (!isPublishingFree(policy) && quote.paymentStatus === "pending" && !paymentProviderReady) {
    blockPublishReason =
      "PAYMENT_PROVIDER_NOT_READY: Paid mode is on but no production payment provider is configured.";
  }

  return {
    policy,
    quote,
    paymentUiVisible,
    paymentProviderReady,
    blockPublishReason,
    couponId: coupon?.id ?? null,
  };
}

export async function deactivatePricingRule(input: { actorId: number; publicId: string }) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(scopedPricingRules)
    .where(eq(scopedPricingRules.publicId, input.publicId))
    .limit(1);
  if (!rows[0]) throw new Error("PRICING_RULE_NOT_FOUND");
  await db
    .update(scopedPricingRules)
    .set({ isActive: 0 })
    .where(eq(scopedPricingRules.id, rows[0].id));
  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: "pricing_rule.deactivate",
    entityType: "pricing_rule",
    entityId: input.publicId,
    beforeState: rows[0],
  }).catch(() => undefined);
  return { ok: true as const };
}

export { pickPricingRule, resolvePublishQuote };
