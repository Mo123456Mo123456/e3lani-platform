import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdCard } from "@/components/e3lani/ad-card";
import { BrandTicker } from "@/components/e3lani/brand-ticker";
import { EmptyState } from "@/components/e3lani/ui";
import { BRAND, cityIdsForMarket, fallbackCities, type Ad } from "@/lib/e3lani-data";
import { rankFeedAds, type FeedMode } from "@/lib/e3lani-feed";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const MODES: FeedMode[] = ["forYou", "near", "latest"];

export default function Home() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const { ads, blockedOwners, ready, recordMetric, metrics, market, user } = useE3lani();
  const { isRTL, t, locale } = useI18n();
  const productData = useProductData();
  const cities = productData.cities.length ? productData.cities : fallbackCities;
  const [tab, setTab] = useState<FeedMode>("forYou");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [active, setActive] = useState("");
  const listRef = useRef<FlatList<Ad>>(null);
  const seen = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Ad }[] }) => {
      const id = viewableItems[0]?.item.id ?? "";
      setActive(id);
      if (id && !seen.current.has(id)) {
        seen.current.add(id);
        recordMetric(id, "impressions");
        recordMetric(id, "views");
      }
    },
  ).current;

  const tabBarReserve = 72 + Math.max(insets.bottom, 0);
  const itemHeight = Math.max(height - tabBarReserve, 480);

  useEffect(() => {
    if (typeof params.category === "string" && params.category) {
      setCategoryFilter(params.category);
      setTab("latest");
    }
  }, [params.category]);

  const marketCityIds = useMemo(
    () => cityIdsForMarket(cities, market),
    [cities, market],
  );

  const visible = useMemo(
    () =>
      rankFeedAds(ads, {
        mode: tab,
        marketCityIds,
        preferredCityId: user?.cityId,
        metrics,
        categoryFilter: categoryFilter || undefined,
        blockedOwners,
      }),
    [ads, blockedOwners, categoryFilter, marketCityIds, metrics, tab, user?.cityId],
  );

  useEffect(() => {
    if (!params.focus || !ready) return;
    const index = visible.findIndex((ad) => ad.id === params.focus);
    if (index >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index, animated: true });
      }, 120);
    }
  }, [params.focus, ready, visible]);

  if (!ready) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={BRAND.yellow} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(ad) => ad.id}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={itemHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={1}
        windowSize={3}
        ListEmptyComponent={
          <View style={[styles.center, { height: itemHeight }]}>
            <EmptyState
              icon="campaign"
              title={t("noAds")}
              text={locale === "ar" ? "اختر قسمًا آخر أو أضف إعلانًا." : "Pick another category or post an ad."}
              actionLabel={t("create")}
              onAction={() => router.push("/(tabs)/create" as never)}
            />
          </View>
        }
        renderItem={({ item }) => (
          <AdCard
            ad={item}
            height={itemHeight}
            active={active === item.id}
            fullscreen
          />
        )}
      />

      <View style={[styles.overlayTop, { paddingTop: insets.top }]} pointerEvents="box-none">
        <BrandTicker />
        <View style={[styles.feedHead, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search")}
            onPress={() => router.push("/search" as never)}
            style={styles.round}
          >
            <MaterialIcons name="search" size={22} color={BRAND.white} />
          </Pressable>

          <View style={styles.tabs}>
            {MODES.map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === mode }}
                onPress={() => {
                  setTab(mode);
                  setCategoryFilter("");
                }}
                style={[styles.tab, tab === mode && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === mode && styles.tabTextActive]}>
                  {t(mode)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications")}
            onPress={() => router.push("/account/notifications" as never)}
            style={styles.round}
          >
            <MaterialIcons name="notifications-none" size={22} color={BRAND.white} />
          </Pressable>
        </View>

        {categoryFilter ? (
          <Pressable
            onPress={() => setCategoryFilter("")}
            style={styles.filterChip}
          >
            <Text style={styles.filterText}>
              {categoryFilter} · {t("clear")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  feedHead: {
    marginTop: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.19)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  tab: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#eee", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  filterChip: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  filterText: { color: BRAND.white, fontSize: 11, fontWeight: "900" },
});
