import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { countries, scopedPricingRules } from "../drizzle/schema";
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
import { getDb, getPublicProductConfig, requireDatabase } from "./db";

export type ServerQuoteInput = {
  countryCode?: string;
  categorySlug?: string;
  accountType?: string;
  userId?: number;
  brandId?: number;
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
    adType: row.adType,
    basePrice: row.basePrice,
    discountPrice: row.discountPrice,
    currency: row.currency,
    // DB stores basis points; quote engine uses fraction.
    taxRate: (row.taxRate ?? 0) / 10_000,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: row.isActive === 1,
    priority: row.priority,
  }));
}

export async function resolveServerPublishQuote(input: ServerQuoteInput): Promise<{
  policy: LaunchPolicy;
  quote: PriceSnapshot;
  paymentUiVisible: boolean;
  paymentProviderReady: boolean;
  blockPublishReason: string | null;
}> {
  const [policy, rules, config] = await Promise.all([
    loadLaunchPolicy(),
    listActiveScopedRules().catch(() => [] as ScopedPricingRule[]),
    getPublicProductConfig(),
  ]);

  const quote = resolvePublishQuote({
    policy,
    rules,
    countryId: input.countryCode,
    categoryId: input.categorySlug,
    accountType: input.accountType,
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

  return { policy, quote, paymentUiVisible, paymentProviderReady, blockPublishReason };
}

export { pickPricingRule, resolvePublishQuote };
