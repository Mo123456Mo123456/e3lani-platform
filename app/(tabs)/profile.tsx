import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { shareText } from "@/lib/share";

const rows = [
  { key: "myAds", icon: "campaign", route: "/account/my-ads" },
  { key: "dashboard", icon: "query-stats", route: "/account/dashboard" },
  {
    key: "notifications",
    icon: "notifications",
    route: "/account/notifications",
  },
  { key: "invoices", icon: "receipt-long", route: "/account/invoices" },
  { key: "brand", icon: "storefront", route: "/account/brand" },
] as const;

export default function Profile() {
  const { user, brand, ads, metrics, logout } = useE3lani();
  const { locale, isRTL, t, toggleLocale } = useI18n();
  const [activeTab, setActiveTab] = useState<"ads" | "posts">("ads");
  const staff = Boolean(
    user &&
    ["reviewer", "finance", "support", "admin", "owner"].includes(user.role),
  );
  const profileName =
    brand?.name ?? user?.name ?? (locale === "ar" ? "حسابي" : "My account");
  const profileBio =
    brand?.bio ??
    user?.bio ??
    (locale === "ar"
      ? "صفحتك العامة للإعلانات والمنشورات المجانية."
      : "Your public ads and free posts.");
  const myAds = ads.filter((ad) =>
    user ? ad.ownerId === user.id : ad.ownerId === "local-user",
  );
  const views = myAds.reduce(
    (total, ad) => total + (metrics[ad.id]?.views ?? 0),
    0,
  );
  const shareProfile = async () => {
    const shared = await shareText(`${profileName} — E3lani`, profileName);
    if (!shared) {
      Alert.alert(
        locale === "ar" ? "المشاركة غير متاحة" : "Sharing is unavailable",
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.cover}>
          <View style={styles.coverYellow} />
        </View>

        <View style={styles.profileMain}>
          <View
            accessible
            accessibilityLabel={profileName}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{profileName.slice(0, 1)}</Text>
          </View>
          <Text style={[styles.name, { textAlign: isRTL ? "right" : "left" }]}>
            {profileName}
          </Text>
          <Text style={[styles.help, { textAlign: isRTL ? "right" : "left" }]}>
            {profileBio}
            {user?.cityId ? ` · ${user.cityId}` : ""}
          </Text>
          <View
            style={[
              styles.profileButtons,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Pressable
              onPress={() =>
                router.push((user ? "/account/brand" : "/login") as never)
              }
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.profileButtonText}>
                {user ? t("saveChanges") : t("signIn")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void shareProfile()}
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.profileButtonText}>{t("share")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{myAds.length}</Text>
            <Text style={styles.statLabel}>
              {locale === "ar" ? "الإعلانات" : "Ads"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>
              {locale === "ar" ? "المنشورات" : "Posts"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {views.toLocaleString(locale === "ar" ? "ar-SA" : "en")}
            </Text>
            <Text style={styles.statLabel}>{t("views")}</Text>
          </View>
        </View>

        <View style={styles.profileTabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "ads" }}
            onPress={() => setActiveTab("ads")}
            style={[
              styles.profileTab,
              activeTab === "ads" && styles.profileTabActive,
            ]}
          >
            <Text
              style={[
                styles.profileTabText,
                activeTab === "ads" && styles.profileTabTextActive,
              ]}
            >
              {locale === "ar" ? "الإعلانات" : "Ads"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "posts" }}
            onPress={() => setActiveTab("posts")}
            style={[
              styles.profileTab,
              activeTab === "posts" && styles.profileTabActive,
            ]}
          >
            <Text
              style={[
                styles.profileTabText,
                activeTab === "posts" && styles.profileTabTextActive,
              ]}
            >
              {locale === "ar" ? "المنشورات" : "Posts"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.profileContent}>
          {activeTab === "ads" ? (
            myAds.length ? (
              <View style={styles.mediaGrid}>
                {myAds.map((ad) => (
                  <Pressable
                    key={ad.id}
                    accessibilityRole="link"
                    accessibilityLabel={ad.title}
                    onPress={() =>
                      router.push({
                        pathname: "/ad/[id]",
                        params: { id: ad.id },
                      } as never)
                    }
                    style={({ pressed }) => [
                      styles.mediaItem,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MediaView
                      media={ad.media[0]}
                      accessibilityLabel={ad.title}
                    />
                    <View style={styles.mediaShade} />
                    <Text numberOfLines={1} style={styles.mediaTitle}>
                      {ad.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.profileEmpty}>
                <MaterialIcons name="campaign" size={38} color={BRAND.muted} />
                <Text style={styles.profileEmptyTitle}>
                  {locale === "ar" ? "لا توجد إعلانات لك" : "You have no ads"}
                </Text>
                <Text style={styles.profileEmptyText}>
                  {locale === "ar"
                    ? "استخدم زر «أضف إعلانًا» للنشر."
                    : "Use Post Ad to publish."}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.profileEmpty}>
              <MaterialIcons
                name="photo-library"
                size={38}
                color={BRAND.muted}
              />
              <Text style={styles.profileEmptyTitle}>
                {locale === "ar" ? "لا توجد منشورات" : "No posts yet"}
              </Text>
              <Text style={styles.profileEmptyText}>
                {locale === "ar"
                  ? "المنشورات المجانية تظهر داخل صفحتك فقط."
                  : "Free posts only appear on your profile."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.accountSection}>
          <Text
            style={[
              styles.sectionTitle,
              { textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {locale === "ar" ? "إدارة الحساب" : "Account management"}
          </Text>

          {user ? (
            rows.map((item) => {
              const label = t(item.key);
              return (
                <Pressable
                  accessible
                  accessibilityRole="link"
                  accessibilityLabel={label}
                  key={item.key}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [
                    styles.row,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    accessible={false}
                    name={item.icon}
                    size={22}
                    color={BRAND.black}
                  />
                  <Text
                    style={[
                      styles.rowText,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {label}
                  </Text>
                  <MaterialIcons
                    accessible={false}
                    name={isRTL ? "chevron-left" : "chevron-right"}
                    size={23}
                    color={BRAND.muted}
                  />
                </Pressable>
              );
            })
          ) : (
            <View style={styles.loginButton}>
              <PrimaryButton
                label={t("signIn")}
                icon="login"
                onPress={() => router.push("/login" as never)}
              />
            </View>
          )}

          {staff ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("admin")}
              onPress={() => router.push("/admin" as never)}
              style={({ pressed }) => [
                styles.adminRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="admin-panel-settings"
                size={23}
                color={BRAND.black}
              />
              <Text
                style={[
                  styles.rowText,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t("admin")}
              </Text>
              <MaterialIcons
                name={isRTL ? "chevron-left" : "chevron-right"}
                size={23}
                color={BRAND.black}
              />
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("language")}: ${locale === "ar" ? "English" : "العربية"}`}
            onPress={toggleLocale}
            style={({ pressed }) => [
              styles.row,
              { flexDirection: isRTL ? "row-reverse" : "row" },
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="language" size={22} color={BRAND.black} />
            <Text
              style={[styles.rowText, { textAlign: isRTL ? "right" : "left" }]}
            >
              {t("language")}
            </Text>
            <MaterialIcons
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={23}
              color={BRAND.muted}
            />
          </Pressable>

          {user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("logout")}
              onPress={logout}
              style={({ pressed }) => [
                styles.row,
                { flexDirection: isRTL ? "row-reverse" : "row" },
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="logout" size={22} color={BRAND.error} />
              <Text
                style={[
                  styles.rowText,
                  { color: BRAND.error, textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t("logout")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 38 },
  cover: { height: 150, overflow: "hidden", backgroundColor: BRAND.black },
  coverYellow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "43%",
    backgroundColor: BRAND.yellow,
  },
  profileMain: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  avatar: {
    width: 86,
    height: 86,
    marginTop: -43,
    borderWidth: 4,
    borderColor: BRAND.white,
    borderRadius: 43,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: BRAND.black,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
  },
  name: {
    marginTop: 10,
    color: BRAND.black,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "900",
  },
  help: { marginTop: 3, color: BRAND.muted, fontSize: 11, lineHeight: 18 },
  profileButtons: { marginTop: 13, alignItems: "center", gap: 8 },
  profileButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
  },
  profileButtonText: {
    color: BRAND.black,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
  },
  stats: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row-reverse",
    gap: 9,
  },
  stat: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 15,
    padding: 10,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: BRAND.black,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  statLabel: { marginTop: 2, color: BRAND.muted, fontSize: 9, lineHeight: 13 },
  profileTabs: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
  },
  profileTab: {
    flex: 1,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  profileTabActive: { borderBottomColor: BRAND.yellow },
  profileTabText: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  profileTabTextActive: { color: BRAND.black },
  profileContent: { padding: 14, minHeight: 230 },
  mediaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  mediaItem: {
    width: "48.8%",
    aspectRatio: 1 / 1.12,
    overflow: "hidden",
    borderRadius: 13,
    backgroundColor: "#DDD",
  },
  mediaShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: 62,
    backgroundColor: "rgba(0,0,0,.42)",
  },
  mediaTitle: {
    position: "absolute",
    right: 8,
    bottom: 8,
    left: 8,
    color: BRAND.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  profileEmpty: {
    minHeight: 205,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CCC",
    borderRadius: 18,
    padding: 24,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
  },
  profileEmptyTitle: {
    marginTop: 9,
    color: BRAND.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  profileEmptyText: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  accountSection: { paddingHorizontal: 16, paddingTop: 5 },
  sectionTitle: {
    marginBottom: 4,
    color: BRAND.black,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "900",
  },
  loginButton: { marginTop: 9 },
  row: {
    minHeight: 58,
    marginTop: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingHorizontal: 15,
    backgroundColor: BRAND.white,
    alignItems: "center",
    gap: 11,
  },
  adminRow: {
    minHeight: 60,
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 15,
    backgroundColor: BRAND.yellow,
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
  },
});
