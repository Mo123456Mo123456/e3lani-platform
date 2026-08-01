import { isPublishingFree, type LaunchPolicy } from "../launch-policy";

export type PricingScopeType =
  | "global"
  | "country"
  | "category"
  | "account_type"
  | "user"
  | "brand"
  | "campaign";

export type ScopedPricingRule = {
  id: string;
  name: string;
  scopeType: PricingScopeType;
  countryId?: string | null;
  categoryId?: string | null;
  accountType?: string | null;
  /** User, brand or campaign reference, depending on scopeType. */
  scopeRef?: string | null;
  adType?: string | null;
  basePrice: number;
  discountPrice?: number | null;
  currency: string;
  taxRate: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  priority: number;
};

export type PriceSnapshot = {
  basePrice: number;
  discount: number;
  tax: number;
  finalPrice: number;
  currency: string;
  pricingRuleId: string | null;
  freeReason: string | null;
  offerOrCoupon: string | null;
  paymentStatus: "not_required" | "pending";
};

export type ResolveQuoteInput = {
  policy: LaunchPolicy;
  rules?: ScopedPricingRule[];
  countryId?: string;
  categoryId?: string;
  accountType?: string;
  userId?: string;
  brandId?: string;
  campaignId?: string;
  adType?: string;
  nowIso?: string;
};

function ruleActive(rule: ScopedPricingRule, now: Date): boolean {
  if (!rule.isActive) return false;
  if (rule.startsAt && new Date(rule.startsAt) > now) return false;
  if (rule.endsAt && new Date(rule.endsAt) < now) return false;
  return true;
}

function same(left: string | undefined | null, right: string | undefined | null): boolean {
  return Boolean(left && right && left === right);
}

function matchesScope(rule: ScopedPricingRule, input: ResolveQuoteInput): boolean {
  if (rule.adType && !same(rule.adType, input.adType)) return false;

  switch (rule.scopeType) {
    case "global":
      return true;
    case "country":
      return same(rule.countryId?.toUpperCase(), input.countryId?.toUpperCase());
    case "category":
      return same(rule.categoryId, input.categoryId);
    case "account_type":
      return same(rule.accountType, input.accountType);
    case "user":
      return same(rule.scopeRef, input.userId);
    case "brand":
      return same(rule.scopeRef, input.brandId);
    case "campaign":
      return same(rule.scopeRef, input.campaignId);
    default:
      return false;
  }
}

export function pickPricingRule(input: ResolveQuoteInput): ScopedPricingRule | null {
  const now = new Date(input.nowIso ?? Date.now());
  const candidates = (input.rules ?? [])
    .filter((rule) => ruleActive(rule, now) && matchesScope(rule, input))
    .sort((a, b) => b.priority - a.priority || a.basePrice - b.basePrice);
  return candidates[0] ?? null;
}

/** Resolves the payable amount without mutating historical snapshots. */
export function resolvePublishQuote(input: ResolveQuoteInput): PriceSnapshot {
  if (isPublishingFree(input.policy)) {
    return {
      basePrice: 0,
      discount: 0,
      tax: 0,
      finalPrice: 0,
      currency: "SAR",
      pricingRuleId: null,
      freeReason: input.policy.globalFreeMode ? "global_free_mode" : "payment_not_required",
      offerOrCoupon: null,
      paymentStatus: "not_required",
    };
  }

  const rule = pickPricingRule(input);
  const currency = rule?.currency ?? "SAR";
  const base = rule?.basePrice ?? 5900;
  const discounted =
    input.policy.discountMode && rule?.discountPrice != null ? rule.discountPrice : base;
  const discount = Math.max(0, base - discounted);
  const taxRate = input.policy.taxEnabled ? (rule?.taxRate ?? 0.15) : 0;
  const tax = Math.round(discounted * taxRate);
  const finalPrice = discounted + tax;

  return {
    basePrice: base,
    discount,
    tax,
    finalPrice,
    currency,
    pricingRuleId: rule?.id ?? null,
    freeReason: finalPrice === 0 ? "zero_priced_rule" : null,
    offerOrCoupon: discount > 0 ? rule?.name ?? "discount" : null,
    paymentStatus: finalPrice > 0 ? "pending" : "not_required",
  };
}
