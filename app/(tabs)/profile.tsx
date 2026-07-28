import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { clearUserInfo, removeSessionToken } from "@/lib/_core/auth";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

const rows = [
  { key: "myAds", icon: "campaign", route: "/account/my-ads" },
  { key: "dashboard", icon: "query-stats", route: "/account/dashboard" },
  { key: "notifications", icon: "notifications", route: "/account/notifications" },
  { key: "invoices", icon: "receipt-long", route: "/account/invoices" },
  { key: "brand", icon: "storefront", route: "/account/brand" },
] as const;

export default function Profile() {
  const { locale, t, toggleLocale } = useI18n();
  const utils = trpc.useUtils();
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const logoutMutation = trpc.auth.logout.useMutation();
  const user = sessionQuery.data;
  const staff = Boolean(user && ["reviewer", "finance", "support", "admin", "owner"].includes(user.role));

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Continue local cleanup even when the server is temporarily unreachable.
    }
    await Promise.all([removeSessionToken(), clearUserInfo()]);
    await utils.invalidate();
    router.replace("/(tabs)/profile" as never);
  };

  if (sessionQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenTitle title={t("account")} />
        <View
          accessible
          accessibilityLabel={user ? `${user.name ?? t("account")}, ${user.email ?? ""}` : t("welcome")}
          style={styles.card}
        >
          <View accessible={false} style={styles.avatar}>
            <MaterialIcons accessible={false} name="person" size={39} color={BRAND.black} />
          </View>
          <Text style={styles.name}>{user?.name ?? t("welcome")}</Text>
          <Text style={styles.help}>{user?.email ?? (user ? user.openId : t("loginHelp"))}</Text>
          {user ? (
            <View style={styles.sessionBadge}>
              <MaterialIcons name="verified-user" size={17} color={BRAND.success} />
              <Text style={styles.sessionText}>
                {locale === "ar" ? "جلسة خادم موثقة" : "Verified server session"}
              </Text>
            </View>
          ) : (
            <View style={styles.full}>
              <PrimaryButton label={t("signIn")} icon="login" onPress={() => router.push("/login" as never)} />
            </View>
          )}
        </View>

        {sessionQuery.isError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void sessionQuery.refetch()}
            style={styles.errorCard}
          >
            <MaterialIcons name="cloud-off" size={22} color={BRAND.error} />
            <Text style={styles.errorText}>
              {locale === "ar" ? "تعذر التحقق من جلسة الحساب. اضغط لإعادة المحاولة." : "The account session could not be verified. Tap to retry."}
            </Text>
          </Pressable>
        ) : null}

        {user
          ? rows.map((item) => {
              const label = t(item.key);
              return (
                <Pressable
                  accessible
                  accessibilityRole="link"
                  accessibilityLabel={label}
                  key={item.key}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <MaterialIcons accessible={false} name={item.icon} size={23} color={BRAND.black} />
                  <Text style={styles.rowText}>{label}</Text>
                  <MaterialIcons accessible={false} name="chevron-left" size={23} color={BRAND.muted} />
                </Pressable>
              );
            })
          : null}

        {staff ? (
          <Pressable
            accessible
            accessibilityRole="link"
            accessibilityLabel={t("admin")}
            onPress={() => router.push("/admin" as never)}
            style={({ pressed }) => [styles.adminRow, pressed && styles.pressed]}
          >
            <MaterialIcons accessible={false} name="admin-panel-settings" size={24} color={BRAND.black} />
            <Text style={styles.rowText}>{t("admin")}</Text>
            <MaterialIcons accessible={false} name="chevron-left" size={23} color={BRAND.black} />
          </Pressable>
        ) : null}

        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${t("language")}: ${locale === "ar" ? "English" : "العربية"}`}
          onPress={toggleLocale}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <MaterialIcons accessible={false} name="language" size={23} color={BRAND.black} />
          <Text style={styles.rowText}>{t("language")}</Text>
          <MaterialIcons accessible={false} name="chevron-left" size={23} color={BRAND.muted} />
        </Pressable>

        {user ? (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("logout")}
            disabled={logoutMutation.isPending}
            onPress={() => {
              Alert.alert(
                t("logout"),
                locale === "ar" ? "هل تريد إنهاء الجلسة على هذا الجهاز؟" : "End the session on this device?",
                [
                  { text: t("close"), style: "cancel" },
                  { text: t("logout"), style: "destructive", onPress: () => void logout() },
                ],
              );
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <MaterialIcons accessible={false} name="logout" size={23} color={BRAND.error} />
            <Text style={[styles.rowText, { color: BRAND.error }]}>{t("logout")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { paddingBottom: 35 },
  card: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 23,
    padding: 21,
    backgroundColor: BRAND.surface,
    alignItems: "center",
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 25,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { marginTop: 13, color: BRAND.black, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  help: { marginTop: 4, color: BRAND.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  full: { width: "100%", marginTop: 17 },
  sessionBadge: { marginTop: 13, minHeight: 34, paddingHorizontal: 11, borderRadius: 12, backgroundColor: "#EAF7EF", flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  sessionText: { color: BRAND.success, fontSize: 11, fontWeight: "900" },
  errorCard: { marginTop: 10, padding: 13, borderRadius: 16, backgroundColor: "#FFF0EF", flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  errorText: { flex: 1, color: BRAND.error, fontSize: 12, lineHeight: 19, textAlign: "right" },
  row: {
    minHeight: 58,
    marginTop: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingHorizontal: 15,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
  },
  adminRow: {
    minHeight: 60,
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 15,
    backgroundColor: BRAND.yellow,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
  },
  pressed: { opacity: 0.6 },
  rowText: {
    flex: 1,
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "right",
  },
});
