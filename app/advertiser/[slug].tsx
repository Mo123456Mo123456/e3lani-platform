import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { EmptyState, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { createIdempotencyKey, getOrCreateAnonymousId } from "@/lib/analytics-identity";
import { centralAdToClientAd } from "@/lib/central-data-adapter";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function PublicAdvertiserPage() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>();
  const { locale, isRTL, t } = useI18n();
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const profileQuery = trpc.data.advertisers.public.useQuery(
    { slug },
    { enabled: Boolean(slug), retry: 1 },
  );
  const favoritesQuery = trpc.data.favorites.list.useQuery(
    { limit: 100 },
    { enabled: Boolean(sessionQuery.data), retry: false },
  );
  const toggleFavoriteMutation = trpc.data.favorites.toggle.useMutation({
    onSuccess: async () => {
      await favoritesQuery.refetch();
    },
  });
  const eventMutation = trpc.data.events.record.useMutation();
  const posts = (profileQuery.data?.posts ?? []).map(centralAdToClientAd);
  const savedIds = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((item) => item.id)),
    [favoritesQuery.data],
  );

  const toggleSave = async (ad: Ad) => {
    if (!sessionQuery.data) {
      router.push("/login" as never);
      return;
    }
    await toggleFavoriteMutation.mutateAsync({ publicAdId: ad.id });
  };

  const trackShare = async (ad: Ad) => {
    const anonymousId = await getOrCreateAnonymousId();
    await eventMutation.mutateAsync({
      publicAdId: ad.id,
      anonymousId,
      eventType: "share",
      idempotencyKey: createIdempotencyKey("share", ad.id),
    });
  };

  const shareProfile = async () => {
    if (!profileQuery.data) return;
    await Share.share({
      message: `${profileQuery.data.displayName}\ne3lani://advertiser/${profileQuery.data.slug}`,
    });
  };

  if (profileQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  if (profileQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-off"
          title={t("error")}
          text={locale === "ar" ? "تعذر جلب صفحة المعلن من الخادم." : "The advertiser page could not be loaded from the server."}
          actionLabel={t("retry")}
          onAction={() => void profileQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="storefront"
          title={locale === "ar" ? "صفحة المعلن غير موجودة" : "Advertiser page not found"}
          text={locale === "ar" ? "قد يكون الرابط غير صحيح أو الصفحة غير منشورة." : "The link may be incorrect or the page is not published."}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === "ar" ? "رجوع" : "Back"} onPress={() => router.back()} style={styles.headerButton}>
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={26} color={BRAND.black} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{profile.displayName}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("share")} onPress={() => void shareProfile()} style={styles.headerButton}>
          <MaterialIcons name="ios-share" size={23} color={BRAND.black} />
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.cover}>
              {profile.coverUrl ? (
                <Image source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={styles.coverFallback}>
                  <MaterialIcons name="campaign" size={58} color={BRAND.yellow} />
                </View>
              )}
            </View>
            <View style={styles.profileCard}>
              <View style={styles.logo}>
                {profile.logoUrl ? (
                  <Image source={{ uri: profile.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Text style={styles.logoText}>{profile.displayName.slice(0, 1)}</Text>
                )}
              </View>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.displayName}</Text>
                {profile.verificationStatus === "verified" ? (
                  <MaterialIcons name="verified" size={21} color={BRAND.yellowDark} />
                ) : null}
              </View>
              <Text style={styles.slug}>@{profile.slug}</Text>
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              <View style={styles.status}><StatusBadge status={profile.verificationStatus} /></View>
              {profile.websiteUrl ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t("website")}
                  onPress={() => void Linking.openURL(profile.websiteUrl!).catch(() => Alert.alert(t("error")))}
                  style={({ pressed }) => [styles.website, pressed && styles.pressed]}
                >
                  <MaterialIcons name="language" size={20} color={BRAND.black} />
                  <Text numberOfLines={1} style={styles.websiteText}>{profile.websiteUrl}</Text>
                  <MaterialIcons name="open-in-new" size={18} color={BRAND.black} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.stats}>
              <Stat value={profile.stats.activePosts} label={locale === "ar" ? "منشورات مجانية" : "Free posts"} />
              <Stat value={profile.stats.totalViews} label={t("views")} />
              <Stat value={profile.stats.totalSaves} label={t("saved")} />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{locale === "ar" ? "المنشورات النشطة" : "Active posts"}</Text>
              <View style={styles.freeBadge}>
                <MaterialIcons name="redeem" size={15} color={BRAND.black} />
                <Text style={styles.freeBadgeText}>{locale === "ar" ? "نشر مجاني" : "Free posting"}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="campaign"
            title={locale === "ar" ? "لا توجد منشورات نشطة" : "No active posts"}
            text={locale === "ar" ? "ستظهر الإعلانات هنا بعد الموافقة والتفعيل." : "Ads will appear here after approval and activation."}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.post}>
            <AdCard
              ad={item}
              height={500}
              saved={savedIds.has(item.id)}
              metrics={item.metrics}
              onToggleSave={toggleSave}
              onShareTracked={trackShare}
            />
          </View>
        )}
      />
    </ScreenContainer>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 58, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: BRAND.border, alignItems: "center", justifyContent: "space-between" },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, color: BRAND.black, fontSize: 17, fontWeight: "900", textAlign: "center" },
  list: { width: "100%", maxWidth: 720, alignSelf: "center", paddingBottom: 40 },
  cover: { height: 210, overflow: "hidden", backgroundColor: BRAND.charcoal },
  coverFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  profileCard: { marginHorizontal: 15, marginTop: -42, borderWidth: 1, borderColor: BRAND.border, borderRadius: 24, padding: 18, backgroundColor: BRAND.white, alignItems: "center" },
  logo: { width: 86, height: 86, borderRadius: 28, overflow: "hidden", backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: BRAND.white },
  logoText: { color: BRAND.black, fontSize: 34, fontWeight: "900" },
  nameRow: { marginTop: 11, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  name: { color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900", textAlign: "center" },
  slug: { marginTop: 2, color: BRAND.muted, fontSize: 12 },
  bio: { marginTop: 10, maxWidth: 520, color: BRAND.charcoal, fontSize: 13, lineHeight: 21, textAlign: "center" },
  status: { marginTop: 10 },
  website: { marginTop: 12, maxWidth: "100%", minHeight: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: BRAND.surface, flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  websiteText: { flexShrink: 1, color: BRAND.black, fontSize: 11 },
  pressed: { opacity: 0.65 },
  stats: { marginHorizontal: 15, marginTop: 12, flexDirection: "row-reverse", gap: 8 },
  stat: { flex: 1, minHeight: 78, borderRadius: 17, backgroundColor: BRAND.surface, alignItems: "center", justifyContent: "center" },
  statValue: { color: BRAND.black, fontSize: 18, fontWeight: "900" },
  statLabel: { marginTop: 2, color: BRAND.muted, fontSize: 9, textAlign: "center" },
  sectionHeader: { marginTop: 22, paddingHorizontal: 15, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { color: BRAND.black, fontSize: 18, fontWeight: "900", textAlign: "right" },
  freeBadge: { minHeight: 32, paddingHorizontal: 10, borderRadius: 12, backgroundColor: BRAND.yellow, flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  freeBadgeText: { color: BRAND.black, fontSize: 10, fontWeight: "900" },
  post: { marginTop: 14, paddingHorizontal: 10 },
});
