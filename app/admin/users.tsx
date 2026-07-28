import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { BRAND, type StaffRole } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Users() {
  const store = useE3lani(); const { locale } = useI18n();
  const roles: StaffRole[] = ["reviewer", "support", "finance", "admin", "owner"];
  const roleLabels: Record<StaffRole, { ar: string; en: string }> = {
    user: { ar: "مستخدم", en: "User" },
    reviewer: { ar: "مراجع", en: "Reviewer" },
    support: { ar: "دعم", en: "Support" },
    finance: { ar: "مالية", en: "Finance" },
    admin: { ar: "مدير", en: "Admin" },
    owner: { ar: "مالك", en: "Owner" },
  };
  return <AdminShell title={locale === "ar" ? "المستخدمون والصلاحيات" : "Users & roles"}><ScrollView contentContainerStyle={s.page}>{store.user ? <View style={s.card}><View style={s.avatar}><Text style={s.avatarText}>{store.user.name.slice(0, 1)}</Text></View><Text style={s.name}>{store.user.name}</Text><Text style={s.meta}>{store.user.phone} • {store.user.accountType}</Text><Text style={s.label}>{locale === "ar" ? "الدور الإداري" : "Staff role"}</Text><View style={s.roles}>{roles.map((role) => { const label = roleLabels[role][locale]; const selected = store.user?.role === role; return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} key={role} onPress={() => store.updateProfile({ role })} style={[s.role, selected && s.roleActive]}><Text style={s.roleText}>{label}</Text></Pressable>; })}</View></View> : null}</ScrollView></AdminShell>;
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35 }, card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 22, padding: 18, backgroundColor: BRAND.white, alignItems: "center" }, avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" }, avatarText: { color: BRAND.black, fontSize: 28, fontWeight: "900" }, name: { marginTop: 12, color: BRAND.black, fontSize: 20, lineHeight: 28, fontWeight: "900" }, meta: { marginTop: 3, color: BRAND.muted, fontSize: 11 }, label: { alignSelf: "stretch", marginTop: 20, color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" }, roles: { marginTop: 10, flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", gap: 7 }, role: { minHeight: 38, paddingHorizontal: 12, borderRadius: 14, backgroundColor: BRAND.surface, alignItems: "center", justifyContent: "center" }, roleActive: { backgroundColor: BRAND.yellow }, roleText: { color: BRAND.black, fontSize: 11, fontWeight: "900" } });
