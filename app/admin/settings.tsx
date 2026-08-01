import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/e3lani/admin-shell";
import { PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import {
  launchPolicyImpact,
  normalizeLaunchPolicy,
  type LaunchPolicy,
} from "@/lib/launch-policy";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";

type FlagKey = keyof LaunchPolicy;

const TOGGLE_FLAGS: { key: FlagKey; en: string; ar: string }[] = [
  { key: "globalFreeMode", en: "Global Free Mode", ar: "وضع المجاني العالمي" },
  { key: "globalPaidMode", en: "Global Paid Mode", ar: "وضع المدفوع العالمي" },
  { key: "discountMode", en: "Discount Mode", ar: "وضع الخصم" },
  { key: "countryPricing", en: "Country Pricing", ar: "تسعير حسب الدولة" },
  { key: "categoryPricing", en: "Category Pricing", ar: "تسعير حسب القسم" },
  { key: "firstAdFree", en: "First Ad Free", ar: "أول إعلان مجاني" },
  { key: "couponSystem", en: "Coupon System", ar: "نظام الكوبونات" },
  { key: "paymentRequired", en: "Payment Required", ar: "الدفع مطلوب" },
  { key: "paymentsEnabled", en: "Payments Enabled", ar: "المدفوعات مفعّلة" },
  { key: "taxEnabled", en: "Tax Enabled", ar: "الضريبة مفعّلة" },
  { key: "featuredAdsEnabled", en: "Featured Ads Enabled", ar: "الإعلانات المميزة" },
  { key: "topBannerEnabled", en: "Top Banner Enabled", ar: "الشريط العلوي" },
  { key: "allCountriesVisibility", en: "All Countries Visibility", ar: "الظهور العالمي" },
  { key: "instantPublishing", en: "Instant Publishing", ar: "النشر الفوري" },
  { key: "aiModeration", en: "AI Moderation", ar: "مراجعة الذكاء الاصطناعي" },
  { key: "manualPreApproval", en: "Manual Pre-Approval", ar: "موافقة بشرية مسبقة" },
  { key: "postPublishReports", en: "Post-Publish Reports", ar: "البلاغات بعد النشر" },
];

export default function Settings() {
  const { locale } = useI18n();
  const store = useE3lani();
  const productData = useProductData();
  const config = productData.config;
  const utils = trpc.useUtils();
  const updateMutation = trpc.product.updateLaunchPolicy.useMutation({
    onSuccess: async () => {
      await utils.product.config.invalidate();
    },
  });
  const [draft, setDraft] = useState<Partial<LaunchPolicy>>({});
  const [message, setMessage] = useState("");

  const launch = useMemo(
    () =>
      normalizeLaunchPolicy({
        ...((config as { launchPolicy?: unknown } | undefined)?.launchPolicy ?? {}),
        ...store.launchPolicy,
        ...draft,
      }),
    [config, draft, store.launchPolicy],
  );

  if (productData.isLoading) {
    return (
      <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}>
        <View style={s.center}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
        </View>
      </AdminShell>
    );
  }

  if (productData.isError || !config) {
    return (
      <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}>
        <View style={s.center}>
          <Text style={s.error}>
            {locale === "ar"
              ? "تعذر تحميل إعدادات المنتج المركزية"
              : "Central product settings could not be loaded"}
          </Text>
          <PrimaryButton
            label={locale === "ar" ? "إعادة المحاولة" : "Retry"}
            icon="refresh"
            onPress={productData.retry}
          />
        </View>
      </AdminShell>
    );
  }

  const impacts = launchPolicyImpact(launch, locale === "ar" ? "ar" : "en");
  const rows = [
    ["إصدار التسعير", "Pricing version", String(config.pricingVersion)],
    [
      "السعر الأساسي النهائي",
      "Final base price",
      `${(config.finalBasePriceHalalas / 100).toFixed(2)} ${config.currency}`,
    ],
    [
      "مدة الإعلان بعد التفعيل",
      "Duration after activation",
      `${config.activeDurationDays} ${locale === "ar" ? "يوماً" : "days"}`,
    ],
    ["وضع السعر", "Pricing Mode", launch.pricingMode],
    ["سوق الموجز الافتراضي", "Default Feed Market", launch.defaultFeedMarket],
  ];

  const toggle = (key: FlagKey) => {
    const current = Boolean(launch[key]);
    const next = { [key]: !current } as Partial<LaunchPolicy>;
    if (key === "globalFreeMode" && !current) {
      next.globalPaidMode = false;
      next.pricingMode = "free";
      next.paymentRequired = false;
    }
    if (key === "globalPaidMode" && !current) {
      next.globalFreeMode = false;
      next.pricingMode = "paid";
      next.paymentRequired = true;
      next.paymentsEnabled = true;
    }
    setDraft((prev) => ({ ...prev, ...next }));
    setMessage(
      locale === "ar"
        ? "هذه معاينة داخل صفحة الإدارة فقط. اضغط اعتماد لتطبيقها على الخادم."
        : "This is an admin-page preview only. Apply to persist it on the server.",
    );
  };

  const apply = async () => {
    try {
      const patch = { ...draft };
      if (!Object.keys(patch).length) {
        setMessage(locale === "ar" ? "لا توجد تغييرات للاعتماد." : "Nothing to apply.");
        return;
      }
      const updated = await updateMutation.mutateAsync(patch);
      const serverPolicy = (updated as { launchPolicy?: unknown }).launchPolicy;
      if (serverPolicy) {
        store.hydrateLaunchPolicy(normalizeLaunchPolicy(serverPolicy));
      }
      setDraft({});
      setMessage(
        locale === "ar"
          ? "تم اعتماد المفاتيح على الخادم. السجلات والمدفوعات السابقة لم تتأثر."
          : "Flags were saved on the server. Past records and payments were not changed.",
      );
    } catch {
      setMessage(
        locale === "ar"
          ? "فشل اعتماد التغييرات على الخادم. لم تتغير إعدادات المنصة، وما زالت المعاينة محفوظة هنا للمراجعة."
          : "Server apply failed. Platform settings were not changed; the draft remains here for review.",
      );
    }
  };

  return (
    <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>
            {locale === "ar" ? launch.bannerMessageAr : launch.bannerMessageEn}
          </Text>
          <Text style={s.bannerText}>
            {locale === "ar"
              ? "بدّل المفاتيح لمعاينة الأثر، ثم اعتمد. تغيير الأسعار لا يعدّل السجلات السابقة."
              : "Toggle flags to preview impact, then apply. Price changes never rewrite past records."}
          </Text>
        </View>

        <Text style={s.section}>{locale === "ar" ? "مفاتيح التشغيل" : "Feature flags"}</Text>
        {TOGGLE_FLAGS.map((flag) => {
          const value = Boolean(launch[flag.key]);
          return (
            <Pressable
              key={flag.key}
              onPress={() => toggle(flag.key)}
              style={[s.row, value && s.rowOn]}
            >
              <Text style={s.value}>{value ? "ON" : "OFF"}</Text>
              <Text style={s.label}>{locale === "ar" ? flag.ar : flag.en}</Text>
            </Pressable>
          );
        })}

        <Text style={s.section}>
          {locale === "ar" ? "أثر التغيير قبل الاعتماد" : "Impact before applying"}
        </Text>
        {impacts.map((line) => (
          <View key={line} style={s.impact}>
            <Text style={s.impactText}>{line}</Text>
          </View>
        ))}

        <PrimaryButton
          label={
            updateMutation.isPending
              ? locale === "ar"
                ? "جارٍ الاعتماد..."
                : "Applying..."
              : locale === "ar"
                ? "اعتماد التغييرات"
                : "Apply changes"
          }
          icon="save"
          onPress={() => void apply()}
        />
        {message ? <Text style={s.message}>{message}</Text> : null}

        <Text style={s.section}>{locale === "ar" ? "التسعير الحالي" : "Current pricing"}</Text>
        {rows.map(([ar, en, value]) => (
          <View key={`${ar}-${value}`} style={s.row}>
            <Text style={s.value}>{value}</Text>
            <Text style={s.label}>{locale === "ar" ? ar : en}</Text>
          </View>
        ))}
      </ScrollView>
    </AdminShell>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    minHeight: 420,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  error: {
    color: BRAND.black,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  page: { padding: 16, paddingBottom: 35, gap: 9 },
  banner: { padding: 17, borderRadius: 20, backgroundColor: BRAND.black },
  bannerTitle: {
    color: BRAND.yellow,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "right",
  },
  bannerText: { marginTop: 5, color: "#DDD", fontSize: 11, lineHeight: 18, textAlign: "right" },
  section: {
    marginTop: 10,
    color: BRAND.black,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  row: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingHorizontal: 15,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowOn: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF8D6" },
  label: {
    flex: 1,
    color: BRAND.black,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "right",
  },
  value: { color: BRAND.muted, fontSize: 13, fontWeight: "900" },
  impact: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  impactText: {
    color: BRAND.black,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "right",
  },
  message: {
    color: BRAND.success,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "right",
  },
});
