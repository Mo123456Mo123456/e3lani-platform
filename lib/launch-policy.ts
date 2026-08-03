/**
 * Central launch / pricing / visibility policy for إعلاني.
 * Defaults match the open global free launch. Admin can override via `launch.policy`.
 */

export type PricingMode = "free" | "paid" | "discount";
export type ModerationMode = "pre_publish" | "post_publish";

export type LaunchPolicy = {
  globalFreeMode: boolean;
  globalPaidMode: boolean;
  discountMode: boolean;
  countryPricing: boolean;
  categoryPricing: boolean;
  firstAdFree: boolean;
  freeAdsPerUser: number | null;
  couponSystem: boolean;
  paymentRequired: boolean;
  paymentsEnabled: boolean;
  taxEnabled: boolean;
  featuredAdsEnabled: boolean;
  topBannerEnabled: boolean;
  allCountriesVisibility: boolean;
  instantPublishing: boolean;
  aiModeration: boolean;
  manualPreApproval: boolean;
  postPublishReports: boolean;
  authenticationRequired: boolean;
  guestPublishingEnabled: boolean;
  phoneVerificationEnabled: boolean;
  emailVerificationEnabled: boolean;
  verificationRequiredForPublishing: boolean;
  brandVerificationEnabled: boolean;
  mainAdsDailyLimit: number;
  profilePostsDailyLimit: number;
  reportDailyLimit: number;
  moderationMode: ModerationMode;
  watermarkEnabled: boolean;
  watermarkText: string;
  postToAdEnabled: boolean;
  defaultFeedMarket: "ALL" | string;
  pricingMode: PricingMode;
  bannerMessageAr: string;
  bannerMessageEn: string;
};

export const DEFAULT_LAUNCH_POLICY: LaunchPolicy = {
  globalFreeMode: true,
  globalPaidMode: false,
  discountMode: false,
  countryPricing: false,
  categoryPricing: false,
  firstAdFree: true,
  freeAdsPerUser: null,
  couponSystem: false,
  paymentRequired: false,
  paymentsEnabled: false,
  taxEnabled: false,
  featuredAdsEnabled: true,
  topBannerEnabled: true,
  allCountriesVisibility: true,
  instantPublishing: true,
  aiModeration: true,
  manualPreApproval: false,
  postPublishReports: true,
  authenticationRequired: false,
  guestPublishingEnabled: true,
  phoneVerificationEnabled: false,
  emailVerificationEnabled: false,
  verificationRequiredForPublishing: false,
  brandVerificationEnabled: false,
  mainAdsDailyLimit: 10,
  profilePostsDailyLimit: 30,
  reportDailyLimit: 20,
  moderationMode: "post_publish",
  watermarkEnabled: true,
  watermarkText: "إعلاني | E3lani",
  postToAdEnabled: true,
  defaultFeedMarket: "ALL",
  pricingMode: "free",
  bannerMessageAr: "النشر مجاني حاليًا بمناسبة إطلاق إعلاني.",
  bannerMessageEn: "Publishing is free right now for the E3lani launch.",
};

export function normalizeLaunchPolicy(raw: unknown): LaunchPolicy {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const bool = (key: keyof LaunchPolicy, fallback: boolean) =>
    typeof value[key] === "boolean" ? (value[key] as boolean) : fallback;

  const pricingMode =
    value.pricingMode === "paid" || value.pricingMode === "discount" || value.pricingMode === "free"
      ? value.pricingMode
      : DEFAULT_LAUNCH_POLICY.pricingMode;
  const moderationMode =
    value.moderationMode === "pre_publish" || value.moderationMode === "post_publish"
      ? value.moderationMode
      : DEFAULT_LAUNCH_POLICY.moderationMode;
  const integer = (key: keyof LaunchPolicy, fallback: number, minimum: number, maximum: number) =>
    typeof value[key] === "number" && Number.isInteger(value[key])
      ? Math.min(maximum, Math.max(minimum, value[key] as number))
      : fallback;

  return {
    ...DEFAULT_LAUNCH_POLICY,
    globalFreeMode: bool("globalFreeMode", DEFAULT_LAUNCH_POLICY.globalFreeMode),
    globalPaidMode: bool("globalPaidMode", DEFAULT_LAUNCH_POLICY.globalPaidMode),
    discountMode: bool("discountMode", DEFAULT_LAUNCH_POLICY.discountMode),
    countryPricing: bool("countryPricing", DEFAULT_LAUNCH_POLICY.countryPricing),
    categoryPricing: bool("categoryPricing", DEFAULT_LAUNCH_POLICY.categoryPricing),
    firstAdFree: bool("firstAdFree", DEFAULT_LAUNCH_POLICY.firstAdFree),
    freeAdsPerUser:
      typeof value.freeAdsPerUser === "number" ? value.freeAdsPerUser : DEFAULT_LAUNCH_POLICY.freeAdsPerUser,
    couponSystem: bool("couponSystem", DEFAULT_LAUNCH_POLICY.couponSystem),
    paymentRequired: bool("paymentRequired", DEFAULT_LAUNCH_POLICY.paymentRequired),
    paymentsEnabled: bool("paymentsEnabled", DEFAULT_LAUNCH_POLICY.paymentsEnabled),
    taxEnabled: bool("taxEnabled", DEFAULT_LAUNCH_POLICY.taxEnabled),
    featuredAdsEnabled: bool("featuredAdsEnabled", DEFAULT_LAUNCH_POLICY.featuredAdsEnabled),
    topBannerEnabled: bool("topBannerEnabled", DEFAULT_LAUNCH_POLICY.topBannerEnabled),
    allCountriesVisibility: bool(
      "allCountriesVisibility",
      DEFAULT_LAUNCH_POLICY.allCountriesVisibility,
    ),
    instantPublishing: bool("instantPublishing", DEFAULT_LAUNCH_POLICY.instantPublishing),
    aiModeration: bool("aiModeration", DEFAULT_LAUNCH_POLICY.aiModeration),
    manualPreApproval: bool("manualPreApproval", DEFAULT_LAUNCH_POLICY.manualPreApproval),
    postPublishReports: bool("postPublishReports", DEFAULT_LAUNCH_POLICY.postPublishReports),
    authenticationRequired: bool(
      "authenticationRequired",
      DEFAULT_LAUNCH_POLICY.authenticationRequired,
    ),
    guestPublishingEnabled: bool(
      "guestPublishingEnabled",
      DEFAULT_LAUNCH_POLICY.guestPublishingEnabled,
    ),
    phoneVerificationEnabled: bool(
      "phoneVerificationEnabled",
      DEFAULT_LAUNCH_POLICY.phoneVerificationEnabled,
    ),
    emailVerificationEnabled: bool(
      "emailVerificationEnabled",
      DEFAULT_LAUNCH_POLICY.emailVerificationEnabled,
    ),
    verificationRequiredForPublishing: bool(
      "verificationRequiredForPublishing",
      DEFAULT_LAUNCH_POLICY.verificationRequiredForPublishing,
    ),
    brandVerificationEnabled: bool(
      "brandVerificationEnabled",
      DEFAULT_LAUNCH_POLICY.brandVerificationEnabled,
    ),
    mainAdsDailyLimit: integer(
      "mainAdsDailyLimit",
      DEFAULT_LAUNCH_POLICY.mainAdsDailyLimit,
      1,
      1000,
    ),
    profilePostsDailyLimit: integer(
      "profilePostsDailyLimit",
      DEFAULT_LAUNCH_POLICY.profilePostsDailyLimit,
      1,
      5000,
    ),
    reportDailyLimit: integer(
      "reportDailyLimit",
      DEFAULT_LAUNCH_POLICY.reportDailyLimit,
      1,
      1000,
    ),
    moderationMode,
    watermarkEnabled: bool("watermarkEnabled", DEFAULT_LAUNCH_POLICY.watermarkEnabled),
    watermarkText:
      typeof value.watermarkText === "string" && value.watermarkText.trim()
        ? value.watermarkText.trim().slice(0, 80)
        : DEFAULT_LAUNCH_POLICY.watermarkText,
    postToAdEnabled: bool("postToAdEnabled", DEFAULT_LAUNCH_POLICY.postToAdEnabled),
    defaultFeedMarket:
      typeof value.defaultFeedMarket === "string" && value.defaultFeedMarket
        ? value.defaultFeedMarket
        : DEFAULT_LAUNCH_POLICY.defaultFeedMarket,
    pricingMode,
    bannerMessageAr:
      typeof value.bannerMessageAr === "string"
        ? value.bannerMessageAr
        : DEFAULT_LAUNCH_POLICY.bannerMessageAr,
    bannerMessageEn:
      typeof value.bannerMessageEn === "string"
        ? value.bannerMessageEn
        : DEFAULT_LAUNCH_POLICY.bannerMessageEn,
  };
}

export function launchPolicyImpact(policy: LaunchPolicy, locale: "ar" | "en" = "ar"): string[] {
  if (locale === "en") {
    return [
      policy.globalFreeMode
        ? "New ads will publish globally for free. Existing paid orders are unchanged."
        : "Free global mode is off.",
      policy.paymentsEnabled
        ? "Payment providers may be used when payment is required."
        : "Payment collection stays disabled.",
      policy.instantPublishing
        ? "Ads go live immediately; AI scans in the background."
        : "Publishing waits for the configured review path.",
      policy.allCountriesVisibility
        ? "Users can browse ads from every country."
        : "Country visibility filters may hide cross-border ads.",
    ];
  }
  return [
    policy.globalFreeMode
      ? "عند تفعيل هذا الخيار ستصبح جميع الإعلانات الجديدة مجانية عالميًا. الإعلانات السابقة والمدفوعات القديمة لن تتأثر."
      : "وضع المجاني العالمي غير مفعّل.",
    policy.paymentsEnabled
      ? "يمكن استخدام مزودي الدفع عند اشتراط الدفع."
      : "تحصيل المدفوعات يبقى معطلًا.",
    policy.instantPublishing
      ? "يُنشر الإعلان فورًا مع فحص ذكاء اصطناعي في الخلفية."
      : "النشر ينتظر مسار المراجعة المحدد.",
    policy.allCountriesVisibility
      ? "يمكن للمستخدمين مشاهدة إعلانات كل الدول."
      : "قد تُخفى إعلانات الدول الأخرى حسب الفلتر.",
  ];
}

export function isPublishingFree(policy: LaunchPolicy): boolean {
  if (policy.globalFreeMode) return true;
  if (policy.pricingMode === "free") return true;
  if (!policy.paymentsEnabled || !policy.paymentRequired) return true;
  return false;
}

export function shouldShowPaymentUi(policy: LaunchPolicy): boolean {
  return policy.paymentsEnabled && policy.paymentRequired && !isPublishingFree(policy);
}
