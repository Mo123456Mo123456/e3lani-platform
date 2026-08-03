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

export type CouponDiscount = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  name?: string | null;
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
  /** Count of ads already created by this user (for first-ad / quota free). */
  userAdCount?: number;
  hasExemption?: boolean;
  coupon?: CouponDiscount | null;
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

function freeSnapshot(currency: string, freeReason: string, offerOrCoupon: string | null = null): PriceSnapshot {
  return {
    basePrice: 0,
    discount: 0,
    tax: 0,
    finalPrice: 0,
    currency,
    pricingRuleId: null,
    freeReason,
    offerOrCoupon,
    paymentStatus: "not_required",
  };
}

/** Resolves the payable amount without mutating historical snapshots. */
export function resolvePublishQuote(input: ResolveQuoteInput): PriceSnapshot {
  if (isPublishingFree(input.policy)) {
    return freeSnapshot(
      "SAR",
      input.policy.globalFreeMode ? "global_free_mode" : "payment_not_required",
    );
  }

  if (input.hasExemption) {
    return freeSnapshot("SAR", "pricing_exemption");
  }

  // Per-user free rules apply only when the caller supplies a known ad count.
  if (typeof input.userAdCount === "number") {
    if (input.policy.firstAdFree && input.userAdCount === 0) {
      return freeSnapshot("SAR", "first_ad_free");
    }
    if (input.policy.freeAdsPerUser != null && input.userAdCount < input.policy.freeAdsPerUser) {
      return freeSnapshot("SAR", "free_ads_quota");
    }
  }

  const rule = pickPricingRule(input);
  const currency = rule?.currency ?? "SAR";
  const base = rule?.basePrice ?? 5900;
  let payable =
    input.policy.discountMode && rule?.discountPrice != null ? rule.discountPrice : base;
  const ruleDiscount = Math.max(0, base - payable);
  let offerOrCoupon = ruleDiscount > 0 ? rule?.name ?? "discount" : null;

  if (input.policy.couponSystem && input.coupon) {
    if (input.coupon.discountType === "percent") {
      const cut = Math.round((payable * Math.min(100, Math.max(0, input.coupon.discountValue))) / 100);
      payable = Math.max(0, payable - cut);
    } else {
      payable = Math.max(0, payable - Math.max(0, input.coupon.discountValue));
    }
    offerOrCoupon = input.coupon.name || input.coupon.code;
  }

  const discount = Math.max(0, base - payable);
  const taxRate = input.policy.taxEnabled ? (rule?.taxRate ?? 0.15) : 0;
  const tax = Math.round(payable * taxRate);
  const finalPrice = payable + tax;

  return {
    basePrice: base,
    discount,
    tax,
    finalPrice,
    currency,
    pricingRuleId: rule?.id ?? null,
    freeReason: finalPrice === 0 ? "zero_priced_rule" : null,
    offerOrCoupon,
    paymentStatus: finalPrice > 0 ? "pending" : "not_required",
  };
}
