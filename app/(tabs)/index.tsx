import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { EmptyState, Pill } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { createIdempotencyKey, getOrCreateAnonymousId } from "@/lib/analytics-identity";
import { centralAdToClientAd } from "@/lib/central-data-adapter";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

const DEMO_DATA_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_DATA === "true";

export default function Home() {
  const { height, width } = useWindowDimensions();
  const { ads: demoAds, blockedOwners } = useE3lani();
  const { isRTL, t } = useI18n();
  const [tab, setTab] = useState("forYou");
  const [active, setActive] = useState("");
  const anonymousId = useRef("");
  const seen = useRef(new Set<string>());
  const eventMutation = trpc.data.events.record.useMutation();
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const feedQuery = trpc.data.ads.feed.useQuery({ limit: 30 }, { retry: 1 });
  const favoritesQuery = trpc.data.favorites.list.useQuery(
    { limit: 100 },
    { enabled: Boolean(sessionQuery.data), retry: false },
  );
  const toggleFavoriteMutation = trpc.data.favorites.toggle.useMutation({
    onSuccess: async () => {
      await favoritesQuery.refetch();
    },
  });
  const eventMutateRef = useRef(eventMutation.mutate);
  eventMutateRef.current = eventMutation.mutate;

  useEffect(() => {
    let mounted = true;
    void getOrCreateAnonymousId().then((value) => {
      if (mounted) anonymousId.current = value;
    });
    return () => {
      mounted = false;
    };
  }, []);

  const centralAds = useMemo(
    () => (feedQuery.data ?? []).map(centralAdToClientAd),
    [feedQuery.data],
  );
  const sourceAds = feedQuery.isError && DEMO_DATA_ENABLED ? demoAds : centralAds;
  const savedIds = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((item) => item.id)),
    [favoritesQuery.data],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Ad }[] }) => {
      const id = viewableItems[0]?.item.id ?? "";
      setActive(id);
      if (!id || seen.current.has(id) || !anonymousId.current) return;
      seen.current.add(id);
      for (const eventType of ["impression", "view"] as const) {
        eventMutateRef.current({
          publicAdId: id,
          anonymousId: anonymousId.current,
          eventType,
          idempotencyKey: createIdempotencyKey(eventType, id),
        });
      }
    },
  ).current;

  const itemHeight = Math.min(Math.max(height - 238, 430), 680);
  const visible = sourceAds
    .filter((ad) => ad.status === "active" && !blockedOwners.includes(ad.ownerId))
    .sort((a, b) =>
      tab === "latest"
        ? b.createdAt.localeCompare(a.createdAt)
        : Number(b.sponsored) - Number(a.sponsored),
    );

  const toggleSave = async (ad: Ad) => {
    if (!sessionQuery.data) {
      router.push("/login" as never);
      return;
    }
    await toggleFavoriteMutation.mutateAsync({ publicAdId: ad.id });
  };

  const trackShare = async (ad: Ad) => {
    const identity = anonymousId.current || (await getOrCreateAnonymousId());
    anonymousId.current = identity;
    await eventMutation.mutateAsync({
      publicAdId: ad.id,
      anonymousId: identity,
      eventType: "share",
      idempotencyKey: createIdempotencyKey("share", ad.id),
    });
  };

  if (feedQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View>
          <Text style={styles.logo}>إعلاني</Text>
          <Text style={styles.logoEn}>E3lani</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("search")} onPress={() => router.push("/search" as never)} style={styles.search}>
          <Text style={styles.searchText}>{t("search")}</Text>
          <MaterialIcons accessible={false} name="search" size={23} color={BRAND.black} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("notifications")}
          onPress={() => router.push("/account/notifications" as never)}
          style={styles.bell}
        >
          <MaterialIcons accessible={false} name="notifications-none" size={25} color={BRAND.black} />
        </Pressable>
      </View>
      <View style={[styles.chips, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {["forYou", "near", "latest"].map((key) => (
          <Pill key={key} label={t(key)} active={tab === key} onPress={() => setTab(key)} />
        ))}
      </View>
      {feedQuery.isError && !DEMO_DATA_ENABLED ? (
        <EmptyState
          icon="cloud-off"
          title={t("error")}
          text={t("emptyHelp")}
          actionLabel={t("retry")}
          onAction={() => void feedQuery.refetch()}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(ad) => ad.id}
          renderItem={({ item }) => (
            <View style={{ height: itemHeight, justifyContent: "center" }}>
              <AdCard
                ad={item}
                height={itemHeight - 12}
                active={active === item.id}
                saved={savedIds.has(item.id)}
                metrics={item.metrics}
                onToggleSave={toggleSave}
                onShareTracked={trackShare}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="campaign"
              title={t("empty")}
              text={t("emptyHelp")}
              actionLabel={t("createAd")}
              onAction={() => router.push("/create-ad" as never)}
            />
          }
          contentContainerStyle={[styles.list, width > 700 && styles.web]}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          windowSize={3}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    minHeight: 68,
    paddingHorizontal: 15,
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  logo: { color: BRAND.black, fontSize: 20, lineHeight: 23, fontWeight: "900" },
  logoEn: {
    color: BRAND.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  search: {
    flex: 1,
    maxWidth: 430,
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 13,
    backgroundColor: BRAND.surface,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  searchText: { flex: 1, color: BRAND.muted, fontSize: 13, lineHeight: 18, textAlign: "right" },
  bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chips: { paddingHorizontal: 13, paddingVertical: 8, gap: 7 },
  list: { flexGrow: 1, paddingHorizontal: 10 },
  web: { maxWidth: 850, width: "100%", alignSelf: "center" },
});
