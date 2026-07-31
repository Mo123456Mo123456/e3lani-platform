import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { EmptyState, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

type ProfileTab = "ads" | "posts";

export default function Profile() {
  const store = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t, toggleLocale } = useI18n();
  const [tab, setTab] = useState<ProfileTab>("ads");
  const myAds = store.user ? store.ads.filter((ad) => ad.ownerId === store.user?.id) : [];
  const totalViews = myAds.reduce((sum, ad) => sum + (store.metrics[ad.id]?.views ?? 0), 0);
  const name = store.user?.name ?? t("account");
  const city = productData.cities.find((item) => item.id === store.user?.cityId);
  const cityName = (locale === "ar" ? city?.ar : city?.en) ?? (locale === "ar" ? "الرياض" : "Riyadh");
  const accountType = store.user
    ? {
        viewer: locale === "ar" ? "فرد" : "Individual",
        advertiser: locale === "ar" ? "معلن" : "Advertiser",
        brand: locale === "ar" ? "براند" : "Brand",
      }[store.user.accountType]
    : locale === "ar"
      ? "فرد"
      : "Individual";
  const staff = Boolean(
    store.user && ["reviewer", "finance", "support", "admin", "owner"].includes(store.user.role),
  );

  const shareProfile = async () => {
    await Share.share({
      title: name,
      message: locale === "ar" ? `صفحة ${name} على إعلاني` : `${name}'s profile on E3lani`,
    });
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.cover}>
          <View style={styles.coverBlack} />
          <View style={styles.coverYellow} />
        </View>

        <View style={styles.profileMain}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>
          </View>
          <Text style={[styles.name, { textAlign: isRTL ? "right" : "left" }]}>{name}</Text>
          <Text style={[styles.bio, { textAlign: isRTL ? "right" : "left" }]}>
            {store.user?.bio ??
              (locale === "ar"
                ? "صفحتك العامة للإعلانات والمنشورات المجانية."
                : "Your public page for ads and free posts.")}
            {" · "}{cityName}{" · "}{accountType}
          </Text>

          <View style={[styles.profileButtons, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push((store.user ? "/account/brand" : "/login") as never)}
              style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
            >
              <Text style={styles.profileButtonText}>{store.user ? t("saveChanges") : t("signIn")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("share")}
              onPress={() => void shareProfile()}
              style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="share" size={17} color={BRAND.black} />
              <Text style={styles.profileButtonText}>{t("share")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={myAds.length} label={locale === "ar" ? "الإعلانات" : "Ads"} />
          <Stat value={0} label={locale === "ar" ? "المنشورات" : "Posts"} />
          <Stat value={totalViews.toLocaleString()} label={t("views")} />
        </View>

        <View style={styles.tabs}>
          <ProfileTabButton
            active={tab === "ads"}
            label={locale === "ar" ? "الإعلانات" : "Ads"}
            onPress={() => setTab("ads")}
          />
          <ProfileTabButton
            active={tab === "posts"}
            label={locale === "ar" ? "المنشورات" : "Posts"}
            onPress={() => setTab("posts")}
          />
        </View>

        <View style={styles.content}>
          {tab === "ads" ? (
            myAds.length ? (
              <View style={styles.mediaGrid}>
                {myAds.map((ad) => (
                  <Pressable
                    key={ad.id}
                    accessibilityRole="link"
                    accessibilityLabel={ad.title}
                    onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
                    style={({ pressed }) => [styles.mediaItem, pressed && styles.pressed]}
                  >
                    <MediaView media={ad.media[0]} accessibilityLabel={ad.title} />
                    <View style={styles.mediaShade} />
                    <Text numberOfLines={1} style={styles.mediaTitle}>{ad.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="campaign"
                title={locale === "ar" ? "لا توجد إعلانات لك" : "You have no ads"}
                text={locale === "ar" ? "استخدم زر «أضف إعلانًا» للنشر." : "Use Post Ad to publish."}
                actionLabel={t("create")}
                onAction={() => router.push((store.user ? "/create-ad" : "/login") as never)}
              />
            )
          ) : (
            <EmptyState
              icon="photo-library"
              title={locale === "ar" ? "لا توجد منشورات" : "No posts yet"}
              text={
                locale === "ar"
                  ? "المنشورات المجانية ستظهر داخل صفحتك فقط."
                  : "Free posts will only appear on your public profile."
              }
            />
          )}
        </View>

        <View style={styles.management}>
          {store.user ? (
            <>
              <ManagementRow icon="campaign" label={t("myAds")} route="/account/my-ads" />
              <ManagementRow icon="query-stats" label={t("dashboard")} route="/account/dashboard" />
              <ManagementRow icon="notifications-none" label={t("notifications")} route="/account/notifications" />
              {staff ? <ManagementRow icon="admin-panel-settings" label={t("admin")} route="/admin" yellow /> : null}
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={toggleLocale}
            style={({ pressed }) => [styles.managementRow, pressed && styles.pressed]}
          >
            <MaterialIcons name="language" size={22} color={BRAND.black} />
            <Text style={styles.managementText}>{t("language")}</Text>
            <MaterialIcons name="chevron-left" size={22} color={BRAND.muted} />
          </Pressable>
          {store.user ? (
            <Pressable
              accessibilityRole="button"
              onPress={store.logout}
              style={({ pressed }) => [styles.managementRow, pressed && styles.pressed]}
            >
              <MaterialIcons name="logout" size={22} color={BRAND.error} />
              <Text style={[styles.managementText, styles.logout]}>{t("logout")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProfileTabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ManagementRow({
  icon,
  label,
  route,
  yellow = false,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  route: string;
  yellow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(route as never)}
      style={({ pressed }) => [
        styles.managementRow,
        yellow && styles.managementRowYellow,
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons name={icon} size={22} color={BRAND.black} />
      <Text style={styles.managementText}>{label}</Text>
      <MaterialIcons name="chevron-left" size={22} color={BRAND.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 34 },
  cover: { height: 150, flexDirection: "row", overflow: "hidden" },
  coverBlack: { flex: 1.2, backgroundColor: BRAND.black },
  coverYellow: { flex: 0.8, backgroundColor: BRAND.yellow },
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
  avatarText: { color: BRAND.black, fontSize: 30, lineHeight: 38, fontWeight: "900" },
  name: { marginTop: 9, color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  bio: { marginTop: 2, color: BRAND.muted, fontSize: 12, lineHeight: 19 },
  profileButtons: { marginTop: 13, gap: 8 },
  profileButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  profileButtonText: { color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "900" },
  stats: { padding: 14, flexDirection: "row-reverse", gap: 9 },
  stat: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 15,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { color: BRAND.black, fontSize: 17, lineHeight: 23, fontWeight: "900" },
  statLabel: { marginTop: 2, color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  tabs: {
    height: 49,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
  },
  tab: {
    flex: 1,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { borderBottomColor: BRAND.yellow },
  tabText: { color: BRAND.muted, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  content: { minHeight: 280, padding: 14 },
  mediaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  mediaItem: {
    position: "relative",
    width: "48.7%",
    aspectRatio: 1 / 1.12,
    overflow: "hidden",
    borderRadius: 13,
    backgroundColor: BRAND.charcoal,
  },
  mediaShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: 54,
    backgroundColor: "rgba(0,0,0,.48)",
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
  management: { paddingHorizontal: 14, gap: 8 },
  managementRow: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  managementRowYellow: { borderColor: BRAND.yellowDark, backgroundColor: BRAND.yellow },
  managementText: { flex: 1, color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "800", textAlign: "right" },
  logout: { color: BRAND.error },
  pressed: { opacity: 0.62 },
});
