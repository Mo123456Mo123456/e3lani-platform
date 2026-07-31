import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { persistPickedMedia } from "@/lib/local-media";

const rows = [
  { key: "myAds", icon: "campaign", route: "/account/my-ads" },
  { key: "dashboard", icon: "query-stats", route: "/account/dashboard" },
  { key: "notifications", icon: "notifications", route: "/account/notifications" },
  { key: "invoices", icon: "receipt-long", route: "/account/invoices" },
  { key: "brand", icon: "storefront", route: "/account/brand" },
] as const;

export default function Profile() {
  const { user, logout, ads, metrics, updateProfile } = useE3lani();
  const { locale, isRTL, t, toggleLocale } = useI18n();
  const [tab, setTab] = useState<"ads" | "posts">("ads");
  const staff = Boolean(user && ["reviewer", "finance", "support", "admin", "owner"].includes(user.role));
  const ownAds = ads.filter((ad) => ad.ownerId === "local-user" || ad.ownerId === user?.id);
  const views = ownAds.reduce((sum, ad) => sum + (metrics[ad.id]?.views ?? 0), 0);
  const name = user?.name ?? (locale === "ar" ? "حسابي" : "My account");
  const bio = user?.bio ?? (locale === "ar"
    ? "صفحتك العامة للإعلانات والمنشورات المجانية."
    : "Your public page for ads and free posts.");

  const shareProfile = () => {
    void Share.share({ message: locale === "ar" ? `صفحة ${name} على إعلاني` : `${name} on E3lani` });
  };

  const pickAvatar = async () => {
    if (!user) {
      router.push("/login" as never);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.75,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      updateProfile({ avatar: await persistPickedMedia(result.assets[0]) });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.cover}>
          <View style={styles.coverYellow} />
        </View>

        <View style={styles.profileMain}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === "ar" ? "تغيير الصورة الشخصية" : "Change profile photo"}
            onPress={pickAvatar}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>
            )}
          </Pressable>
          <Text accessibilityRole="header" style={styles.name}>{name}</Text>
          <Text style={styles.bio}>{bio}{user ? ` · ${user.phone}` : ""}</Text>
          <View style={[styles.profileButtons, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push((user ? "/account/brand" : "/login") as never)}
              style={styles.profileButton}
            >
              <Text style={styles.profileButtonText}>{user ? (locale === "ar" ? "تعديل الحساب" : "Edit profile") : t("signIn")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={shareProfile} style={styles.profileButton}>
              <Text style={styles.profileButtonText}>{t("share")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{ownAds.length}</Text><Text style={styles.statLabel}>{locale === "ar" ? "الإعلانات" : "Ads"}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>0</Text><Text style={styles.statLabel}>{locale === "ar" ? "المنشورات" : "Posts"}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{views.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}</Text><Text style={styles.statLabel}>{t("views")}</Text></View>
        </View>

        <View style={styles.profileTabs}>
          <Pressable onPress={() => setTab("ads")} style={[styles.profileTab, tab === "ads" && styles.profileTabActive]}>
            <Text style={[styles.profileTabText, tab === "ads" && styles.profileTabTextActive]}>{locale === "ar" ? "الإعلانات" : "Ads"}</Text>
          </Pressable>
          <Pressable onPress={() => setTab("posts")} style={[styles.profileTab, tab === "posts" && styles.profileTabActive]}>
            <Text style={[styles.profileTabText, tab === "posts" && styles.profileTabTextActive]}>{locale === "ar" ? "المنشورات" : "Posts"}</Text>
          </Pressable>
        </View>

        <View style={styles.profileContent}>
          {tab === "ads" && ownAds.length ? (
            <View style={styles.mediaGrid}>
              {ownAds.map((ad) => (
                <Pressable
                  key={ad.id}
                  accessibilityRole="link"
                  accessibilityLabel={ad.title}
                  onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
                  style={styles.mediaItem}
                >
                  {ad.media[0]?.kind === "image" ? (
                    <Image source={{ uri: ad.media[0].uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={styles.mediaFallback}><MaterialIcons name="play-circle" size={38} color={BRAND.yellow} /></View>
                  )}
                  <View style={styles.mediaShade} />
                  <Text numberOfLines={1} style={styles.mediaTitle}>{ad.title}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name={tab === "ads" ? "campaign" : "photo-library"} size={38} color={BRAND.muted} />
              <Text style={styles.emptyTitle}>{tab === "ads" ? (locale === "ar" ? "لا توجد إعلانات لك" : "You have no ads") : (locale === "ar" ? "لا توجد منشورات" : "No posts yet")}</Text>
              <Text style={styles.emptyText}>{tab === "ads" ? (locale === "ar" ? "استخدم زر «أضف إعلانًا» للنشر." : "Use Post Ad to publish.") : (locale === "ar" ? "المنشورات المجانية ستظهر هنا." : "Free posts will appear here.")}</Text>
            </View>
          )}
        </View>

        <View style={styles.menu}>
          {user
            ? rows.map((item) => {
                const label = t(item.key);
                return (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={label}
                    key={item.key}
                    onPress={() => router.push(item.route as never)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <MaterialIcons name={item.icon} size={22} color={BRAND.black} />
                    <Text style={styles.rowText}>{label}</Text>
                    <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={23} color={BRAND.muted} />
                  </Pressable>
                );
              })
            : null}
          {staff ? (
            <Pressable onPress={() => router.push("/admin" as never)} style={styles.adminRow}>
              <MaterialIcons name="admin-panel-settings" size={23} color={BRAND.black} />
              <Text style={styles.rowText}>{t("admin")}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={toggleLocale} style={styles.row}>
            <MaterialIcons name="language" size={22} color={BRAND.black} />
            <Text style={styles.rowText}>{t("language")}</Text>
          </Pressable>
          {user ? (
            <Pressable onPress={logout} style={styles.row}>
              <MaterialIcons name="logout" size={22} color={BRAND.error} />
              <Text style={[styles.rowText, { color: BRAND.error }]}>{t("logout")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 35 },
  cover: { height: 150, overflow: "hidden", backgroundColor: BRAND.black },
  coverYellow: { position: "absolute", top: 0, right: 0, bottom: 0, width: "45%", backgroundColor: BRAND.yellow, transform: [{ skewX: "-18deg" }, { translateX: 26 }] },
  profileMain: { paddingHorizontal: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: BRAND.border, backgroundColor: BRAND.white },
  avatar: {
    width: 86,
    height: 86,
    marginTop: -43,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: BRAND.white,
    borderRadius: 43,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: BRAND.black, fontSize: 30, lineHeight: 38, fontWeight: "900" },
  name: { marginTop: 10, color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900", textAlign: "right" },
  bio: { marginTop: 3, color: BRAND.muted, fontSize: 12, lineHeight: 19, textAlign: "right" },
  profileButtons: { marginTop: 13, gap: 8 },
  profileButton: { minHeight: 39, borderWidth: 1, borderColor: BRAND.border, borderRadius: 11, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  profileButtonText: { color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "900" },
  stats: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row-reverse", gap: 9 },
  stat: { flex: 1, minHeight: 70, borderWidth: 1, borderColor: BRAND.border, borderRadius: 15, backgroundColor: BRAND.white, alignItems: "center", justifyContent: "center" },
  statValue: { color: BRAND.black, fontSize: 17, lineHeight: 23, fontWeight: "900" },
  statLabel: { marginTop: 2, color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  profileTabs: { minHeight: 49, borderBottomWidth: 1, borderBottomColor: BRAND.border, backgroundColor: BRAND.white, flexDirection: "row-reverse" },
  profileTab: { flex: 1, borderBottomWidth: 3, borderBottomColor: "transparent", alignItems: "center", justifyContent: "center" },
  profileTabActive: { borderBottomColor: BRAND.yellow },
  profileTabText: { color: BRAND.muted, fontSize: 13, lineHeight: 19, fontWeight: "900" },
  profileTabTextActive: { color: BRAND.black },
  profileContent: { padding: 16 },
  mediaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  mediaItem: { width: "48.5%", aspectRatio: 1 / 1.12, overflow: "hidden", borderRadius: 13, backgroundColor: "#DDD" },
  mediaFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.charcoal },
  mediaShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 55, backgroundColor: "rgba(0,0,0,.35)" },
  mediaTitle: { position: "absolute", left: 8, right: 8, bottom: 8, color: BRAND.white, fontSize: 10, lineHeight: 14, fontWeight: "900", textAlign: "right" },
  empty: { minHeight: 180, borderWidth: 1, borderStyle: "dashed", borderColor: "#CCC", borderRadius: 18, backgroundColor: BRAND.white, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { marginTop: 10, color: BRAND.black, fontSize: 16, lineHeight: 23, fontWeight: "900", textAlign: "center" },
  emptyText: { marginTop: 4, color: BRAND.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  menu: { paddingHorizontal: 16 },
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
