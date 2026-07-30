import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { OutlineButton, PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Brands() {
  const store = useE3lani(); const { locale } = useI18n(); const brand = store.brand;
  return <AdminShell title={locale === "ar" ? "توثيق البراندات" : "Brand verification"}><ScrollView contentContainerStyle={s.page}>{brand ? <View style={s.card}><View style={s.logo}><Text style={s.logoText}>{brand.name.slice(0, 1)}</Text></View><Text style={s.name}>{brand.name}</Text><Text style={s.slug}>/{brand.slug}</Text><Text style={s.bio}>{brand.bio}</Text><Text style={s.status}>{locale === "ar" ? "حالة التوثيق" : "Verification"}: {brand.verificationStatus}</Text><PrimaryButton label={locale === "ar" ? "توثيق يدوي" : "Verify manually"} icon="verified" onPress={() => store.upsertBrand({ verified: true, verificationStatus: "verified" })} /><OutlineButton label={locale === "ar" ? "رفض طلب التوثيق" : "Reject verification"} icon="close" onPress={() => store.upsertBrand({ verified: false, verificationStatus: "rejected" })} /></View> : null}</ScrollView></AdminShell>;
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35 }, card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 22, padding: 18, backgroundColor: BRAND.white, alignItems: "center", gap: 10 }, logo: { width: 78, height: 78, borderRadius: 25, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" }, logoText: { color: BRAND.black, fontSize: 30, fontWeight: "900" }, name: { color: BRAND.black, fontSize: 21, lineHeight: 29, fontWeight: "900" }, slug: { color: BRAND.muted, fontSize: 11 }, bio: { color: BRAND.black, fontSize: 13, lineHeight: 21, textAlign: "center" }, status: { alignSelf: "stretch", padding: 12, borderRadius: 14, backgroundColor: BRAND.surface, color: BRAND.black, fontSize: 12, fontWeight: "800", textAlign: "right" } });
