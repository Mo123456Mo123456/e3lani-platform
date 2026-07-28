import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { EmptyState, Field, OutlineButton, PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Moderation() {
  const store = useE3lani(); const { locale } = useI18n();
  const [reason, setReason] = useState("تمت مراجعة المحتوى والروابط والوسائط.");
  const items = store.ads.filter((ad) => ["pending_review", "changes_requested"].includes(ad.status));
  const decide = (id: string, decision: "approved" | "changes_requested" | "rejected") => {
    if (reason.trim().length < 4) return Alert.alert(locale === "ar" ? "اكتب سبب القرار" : "Enter a decision reason");
    store.moderateAd(id, decision, reason.trim());
  };
  return <AdminShell title={locale === "ar" ? "مراجعة الإعلانات" : "Ad moderation"}><ScrollView contentContainerStyle={s.page}>{items.length ? items.map((ad) => <View key={ad.id} style={s.card}><View style={s.row}><StatusBadge status={ad.status} /><Text style={s.id}>{ad.id}</Text></View><Text style={s.title}>{ad.title}</Text><Text numberOfLines={3} style={s.description}>{ad.description}</Text><Field label={locale === "ar" ? "سبب القرار" : "Decision reason"} value={reason} onChangeText={setReason} /><View style={s.buttons}><View style={{ flex: 1 }}><PrimaryButton label={locale === "ar" ? "قبول وتفعيل" : "Approve"} icon="check" onPress={() => decide(ad.id, "approved")} /></View><View style={{ flex: 1 }}><OutlineButton label={locale === "ar" ? "طلب تعديل" : "Request changes"} icon="edit" onPress={() => decide(ad.id, "changes_requested")} /></View></View><OutlineButton label={locale === "ar" ? "رفض الإعلان" : "Reject"} icon="close" onPress={() => decide(ad.id, "rejected")} /></View>) : <EmptyState icon="fact-check" title={locale === "ar" ? "قائمة المراجعة فارغة" : "Review queue is empty"} text={locale === "ar" ? "ستظهر الإعلانات المدفوعة هنا." : "Paid ads will appear here."} />}</ScrollView></AdminShell>;
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35, gap: 12 }, card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 22, padding: 16, backgroundColor: BRAND.white }, row: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, id: { color: BRAND.muted, fontSize: 11 }, title: { marginTop: 12, color: BRAND.black, fontSize: 19, lineHeight: 27, fontWeight: "900", textAlign: "right" }, description: { marginTop: 5, color: BRAND.muted, fontSize: 13, lineHeight: 21, textAlign: "right" }, buttons: { marginTop: 10, flexDirection: "row-reverse", gap: 8 } });
