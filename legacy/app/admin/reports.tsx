import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { EmptyState, Field, PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Reports() {
  const store = useE3lani(); const { locale } = useI18n();
  const [note, setNote] = useState("تمت مراجعة البلاغ واتخاذ الإجراء المناسب.");
  const items = store.reports.filter((report) => report.status === "open");
  return <AdminShell title={locale === "ar" ? "البلاغات" : "Reports"}><ScrollView contentContainerStyle={s.page}>{items.length ? items.map((report) => <View key={report.id} style={s.card}><View style={s.row}><Text style={s.reason}>{report.reason}</Text><Text style={s.id}>{report.id}</Text></View><Text style={s.meta}>{report.adId} • {new Date(report.createdAt).toLocaleDateString()}</Text>{report.details ? <Text style={s.details}>{report.details}</Text> : null}<Field label={locale === "ar" ? "ملاحظة الحل" : "Resolution note"} value={note} onChangeText={setNote} /><PrimaryButton label={locale === "ar" ? "حل البلاغ" : "Resolve report"} icon="done-all" onPress={() => store.resolveReport(report.id, note)} /></View>) : <EmptyState icon="flag" title={locale === "ar" ? "لا توجد بلاغات مفتوحة" : "No open reports"} text={locale === "ar" ? "تمت معالجة جميع البلاغات الحالية." : "All current reports have been resolved."} />}</ScrollView></AdminShell>;
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35, gap: 12 }, card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 20, padding: 16, backgroundColor: BRAND.white }, row: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8 }, reason: { flex: 1, color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900", textAlign: "right" }, id: { color: BRAND.muted, fontSize: 11 }, meta: { marginTop: 5, color: BRAND.muted, fontSize: 11, textAlign: "right" }, details: { marginTop: 8, color: BRAND.black, fontSize: 13, lineHeight: 21, textAlign: "right" } });
