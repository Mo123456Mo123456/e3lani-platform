import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { BRAND, promotionPrices } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";

export default function Settings() {
  const { locale } = useI18n();
  const rows = [
    ["السعر الأساسي النهائي", "Final base price", "59.00 SAR"],
    ["مدة الإعلان بعد التفعيل", "Duration after activation", "30 days"],
    ["ضريبة القيمة المضافة", "VAT", "15% included"],
    ["إبراز 3 أيام", "3-day highlight", `${promotionPrices.highlight_3 / 100} SAR`],
    ["إبراز 7 أيام", "7-day highlight", `${promotionPrices.highlight_7 / 100} SAR`],
    ["أعلى القسم", "Top category", `${promotionPrices.top_category / 100} SAR`],
  ];
  return <AdminShell title={locale === "ar" ? "إعدادات المنتج" : "Product settings"}><ScrollView contentContainerStyle={s.page}><View style={s.banner}><Text style={s.bannerTitle}>{locale === "ar" ? "وضع مزود الدفع: Sandbox موثق" : "Payment provider: documented sandbox"}</Text><Text style={s.bannerText}>{locale === "ar" ? "يتطلب الإنتاج ربط مزود دفع فعلي والتحقق الخادمي من الإيصالات." : "Production requires a live provider and server-side receipt validation."}</Text></View>{rows.map(([ar, en, value]) => <View key={ar} style={s.row}><Text style={s.value}>{value}</Text><Text style={s.label}>{locale === "ar" ? ar : en}</Text></View>)}</ScrollView></AdminShell>;
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35, gap: 9 }, banner: { padding: 17, borderRadius: 20, backgroundColor: BRAND.black }, bannerTitle: { color: BRAND.yellow, fontSize: 15, lineHeight: 22, fontWeight: "900", textAlign: "right" }, bannerText: { marginTop: 5, color: "#DDD", fontSize: 11, lineHeight: 18, textAlign: "right" }, row: { minHeight: 62, borderWidth: 1, borderColor: BRAND.border, borderRadius: 18, paddingHorizontal: 15, backgroundColor: BRAND.white, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 }, label: { flex: 1, color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "800", textAlign: "right" }, value: { color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "900" } });
