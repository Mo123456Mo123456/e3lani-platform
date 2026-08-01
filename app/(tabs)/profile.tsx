import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { findCountry, formatCountryLabel } from "@/lib/countries";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useCountries } from "@/lib/use-countries";

const rows = [
  { key: "myAds", icon: "campaign", route: "/account/my-ads" },
  { key: "dashboard", icon: "query-stats", route: "/account/dashboard" },
  { key: "notifications", icon: "notifications", route: "/account/notifications" },
  { key: "invoices", icon: "receipt-long", route: "/account/invoices" },
  { key: "brand", icon: "storefront", route: "/account/brand" },
] as const;

export default function Profile() {
  const { user, logout, accountCountry } = useE3lani();
  const { countries } = useCountries();
  const { locale, t, toggleLocale } = useI18n();
  const staff = Boolean(user && ["reviewer", "finance", "support", "admin", "owner"].includes(user.role));
  const country = findCountry(countries, user?.countryCode ?? accountCountry);
  const countryLabel = formatCountryLabel(country, locale === "ar" ? "ar" : "en");

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenTitle title={t("account")} />
        <View
          accessible
          accessibilityLabel={user ? `${user.name}, ${user.phone}` : t("welcome")}
          style={styles.card}
        >
          <View accessible={false} style={styles.avatar}>
            <MaterialIcons accessible={false} name="person" size={39} color={BRAND.black} />
          </View>
          <Text style={styles.name}>{user?.name ?? t("welcome")}</Text>
          <Text style={styles.help}>{user?.phone ?? t("loginHelp")}</Text>
          <Text style={styles.country}>{countryLabel}</Text>
          <Pressable
            onPress={() => router.push("/welcome" as never)}
            style={styles.changeCountry}
          >
            <Text style={styles.changeCountryText}>
              {locale === "ar" ? "تغيير الدولة" : "Change country"}
            </Text>
          </Pressable>
          {!user ? (
            <View style={styles.full}>
              <PrimaryButton label={t("signIn")} icon="login" onPress={() => router.push("/login" as never)} />
            </View>
          ) : null}
        </View>

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
            onPress={logout}
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
  country: {
    marginTop: 8,
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  changeCountry: { marginTop: 6 },
  changeCountryText: {
    color: BRAND.yellowDark,
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  full: { width: "100%", marginTop: 17 },
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
