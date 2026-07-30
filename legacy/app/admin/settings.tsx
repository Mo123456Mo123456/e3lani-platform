import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Settings() {
  const { locale } = useI18n();
  const productData = useProductData();
  const config = productData.config;

  if (productData.isLoading) {
    return <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}><View style={s.center}><ActivityIndicator color={BRAND.yellowDark} size="large" /></View></AdminShell>;
  }

  if (productData.isError || !config) {
    return <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}><View style={s.center}><Text style={s.error}>{locale === "ar" ? "تعذر تحميل إعدادات المنتج المركزية" : "Central product settings could not be loaded"}</Text><PrimaryButton label={locale === "ar" ? "إعادة المحاولة" : "Retry"} icon="refresh" onPress={productData.retry} /></View></AdminShell>;
  }

  const rows = [
    ["إصدار التسعير", "Pricing version", String(config.pricingVersion)],
    ["السعر الأساسي النهائي", "Final base price", `${(config.finalBasePriceHalalas / 100).toFixed(2)} ${config.currency}`],
    ["مدة الإعلان بعد التفعيل", "Duration after activation", `${config.activeDurationDays} ${locale === "ar" ? "يوماً" : "days"}`],
    ["فترة انتظار إعادة النشر", "Republish cooldown", `${config.republishCooldownHours} ${locale === "ar" ? "ساعة" : "hours"}`],
    ["ضريبة القيمة المضافة", "VAT", `${(config.vatBasisPoints / 100).toFixed(2)}%`],
    ...productData.promotions.map((promotion) => [promotion.ar, promotion.en, `${(promotion.priceHalalas / 100).toFixed(2)} ${config.currency}`]),
  ];
  const paymentState = config.paymentMode === "production"
    ? (locale === "ar" ? "مزود دفع إنتاجي" : "Production payment provider")
    : config.paymentMode === "sandbox"
      ? (locale === "ar" ? "وضع تجريبي — التحصيل معطل في العميل" : "Sandbox mode — client collection disabled")
      : (locale === "ar" ? "الدفع معطل" : "Payment disabled");

  return <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}><ScrollView contentContainerStyle={s.page}><View style={s.banner}><Text style={s.bannerTitle}>{paymentState}</Text><Text style={s.bannerText}>{locale === "ar" ? "تُقرأ هذه القيم من قاعدة البيانات المركزية. لا يُفعّل أي توزيع مدفوع قبل تحقق الخادم من الإيصال." : "These values are read from the central database. Paid distribution is not activated before server-side receipt verification."}</Text></View>{rows.map(([ar, en, value]) => <View key={`${ar}-${value}`} style={s.row}><Text style={s.value}>{value}</Text><Text style={s.label}>{locale === "ar" ? ar : en}</Text></View>)}</ScrollView></AdminShell>;
}
const s = StyleSheet.create({ center: { flex: 1, minHeight: 420, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 }, error: { color: BRAND.black, fontSize: 15, lineHeight: 23, fontWeight: "800", textAlign: "center" }, page: { padding: 16, paddingBottom: 35, gap: 9 }, banner: { padding: 17, borderRadius: 20, backgroundColor: BRAND.black }, bannerTitle: { color: BRAND.yellow, fontSize: 15, lineHeight: 22, fontWeight: "900", textAlign: "right" }, bannerText: { marginTop: 5, color: "#DDD", fontSize: 11, lineHeight: 18, textAlign: "right" }, row: { minHeight: 62, borderWidth: 1, borderColor: BRAND.border, borderRadius: 18, paddingHorizontal: 15, backgroundColor: BRAND.white, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 }, label: { flex: 1, color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "800", textAlign: "right" }, value: { color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "900" } });
