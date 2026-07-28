import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/e3lani/admin-shell";
import { BRAND, type StaffRole } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const roleLabels: Record<StaffRole, { ar: string; en: string }> = {
  user: { ar: "مستخدم", en: "User" },
  reviewer: { ar: "مراجع", en: "Reviewer" },
  support: { ar: "دعم", en: "Support" },
  finance: { ar: "مالية", en: "Finance" },
  admin: { ar: "مدير", en: "Admin" },
  owner: { ar: "مالك", en: "Owner" },
};

export default function Users() {
  const store = useE3lani();
  const { locale } = useI18n();
  const role = store.user?.role ?? "user";

  return (
    <AdminShell title={locale === "ar" ? "المستخدمون والصلاحيات" : "Users & roles"}>
      <ScrollView contentContainerStyle={styles.page}>
        {store.user ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{store.user.name.slice(0, 1)}</Text>
            </View>
            <Text style={styles.name}>{store.user.name}</Text>
            <Text style={styles.meta}>{store.user.phone} • {store.user.accountType}</Text>
            <Text style={styles.label}>{locale === "ar" ? "الدور الحالي" : "Current role"}</Text>
            <View accessible accessibilityLabel={roleLabels[role][locale]} style={styles.role}>
              <MaterialIcons name="verified-user" size={20} color={BRAND.black} />
              <Text style={styles.roleText}>{roleLabels[role][locale]}</Text>
            </View>
            <View accessible accessibilityRole="alert" style={styles.notice}>
              <MaterialIcons name="lock" size={22} color={BRAND.yellow} />
              <Text style={styles.noticeText}>
                {locale === "ar"
                  ? "لا يمكن تغيير الصلاحيات من التطبيق. تُمنح أدوار المراجعة والإدارة من الخادم بواسطة مالك مخوّل وبعد تسجيل تدقيق."
                  : "Roles cannot be changed from the app. Review and administrative roles are granted server-side by an authorized owner with an audit record."}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 35 },
  card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 22, padding: 18, backgroundColor: BRAND.white, alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  avatarText: { color: BRAND.black, fontSize: 28, fontWeight: "900" },
  name: { marginTop: 12, color: BRAND.black, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  meta: { marginTop: 3, color: BRAND.muted, fontSize: 11 },
  label: { alignSelf: "stretch", marginTop: 20, color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" },
  role: { minHeight: 42, marginTop: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: BRAND.yellow, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  roleText: { color: BRAND.black, fontSize: 12, fontWeight: "900" },
  notice: { marginTop: 18, padding: 15, borderRadius: 17, backgroundColor: BRAND.black, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  noticeText: { flex: 1, color: BRAND.white, fontSize: 12, lineHeight: 20, textAlign: "right" },
});
