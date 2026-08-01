import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { EmptyState } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const links = [
  ["/admin", "dashboard", "نظرة عامة", "Overview"],
  ["/admin/moderation", "fact-check", "المراجعة", "Moderation"],
  ["/admin/reports", "flag", "البلاغات", "Reports"],
  ["/admin/payments", "payments", "المدفوعات", "Payments"],
  ["/admin/pricing", "sell", "التسعير", "Pricing"],
  ["/admin/users", "group", "المستخدمون", "Users"],
  ["/admin/brands", "storefront", "البراندات", "Brands"],
  ["/admin/catalog", "category", "الكتالوج", "Catalog"],
  ["/admin/settings", "settings", "الإعدادات", "Settings"],
  ["/admin/audit", "history", "التدقيق", "Audit"],
] as const;

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useE3lani();
  const { locale, isRTL } = useI18n();
  const pathname = usePathname();
  const staff = user && ["reviewer", "support", "finance", "admin", "owner"].includes(user.role);
  if (!staff) {
    return <ScreenContainer><EmptyState icon="lock" title={locale === "ar" ? "هذه الصفحة للموظفين" : "Staff only"} text={locale === "ar" ? "سجّل الدخول بحساب إداري للوصول." : "Sign in with a staff account."} /></ScreenContainer>;
  }
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === "ar" ? "العودة إلى الملف الشخصي" : "Back to profile"} onPress={() => router.replace("/(tabs)/profile" as never)} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons accessible={false} name={isRTL ? "arrow-forward" : "arrow-back"} size={26} color={BRAND.black} /></Pressable>
        <View style={styles.headerCopy}><Text style={[styles.brand, { textAlign: isRTL ? "right" : "left" }]}>إعلاني | E3lani</Text><Text accessibilityRole="header" style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{title}</Text></View>
        <View accessible accessibilityLabel={`${locale === "ar" ? "الدور" : "Role"}: ${user.role}`} style={styles.role}><Text style={styles.roleText}>{user.role}</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.nav, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {links.map(([path, icon, ar, en]) => { const label = locale === "ar" ? ar : en; const selected = pathname === path; return <Pressable accessibilityRole="link" accessibilityLabel={label} accessibilityState={{ selected }} key={path} onPress={() => router.push(path as never)} style={({ pressed }) => [styles.navItem, selected && styles.navItemSelected, pressed && styles.pressed]}><MaterialIcons accessible={false} name={icon} size={20} color={BRAND.black} /><Text style={styles.navText}>{label}</Text></Pressable>; })}
      </ScrollView>
      <View style={styles.body}>{children}</View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 68, paddingHorizontal: 12, alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 }, brand: { color: BRAND.yellowDark, fontSize: 10, lineHeight: 15, fontWeight: "900", textAlign: "right" },
  title: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900", textAlign: "right" },
  role: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: BRAND.black }, roleText: { color: BRAND.yellow, fontSize: 10, fontWeight: "900" },
  nav: { minHeight: 58, paddingHorizontal: 10, paddingVertical: 8, gap: 7, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  navItem: { minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: BRAND.surface, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  navItemSelected: { backgroundColor: BRAND.yellow }, pressed: { opacity: 0.62 },
  navText: { color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "800" }, body: { flex: 1, width: "100%", maxWidth: 1100, alignSelf: "center" },
});
