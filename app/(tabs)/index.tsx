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
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { rankFeedAds, type FeedMode } from "@/lib/feed/rank";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const TAB_BAR = 72;

export default function Home() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const {
    ads,
    blockedOwners,
    ready,
    recordMetric,
    metrics,
    marketCode,
    categoryFilter,
    setCategoryFilter,
  } = useE3lani();
  const productData = useProductData();
  const { isRTL, t } = useI18n();
  const [tab, setTab] = useState<FeedMode>("forYou");
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

  useEffect(() => {
    if (typeof params.category === "string" && params.category) {
      setCategoryFilter(params.category);
      setTab("latest");
    }
  }, [params.category, setCategoryFilter]);

  const itemHeight = Math.max(height - TAB_BAR - insets.bottom, 520);

  const cities = useMemo(
    () =>
      productData.cities.map((city) => ({
        id: city.id,
        region: city.region,
        countryCode: "SA" as const,
      })),
    [productData.cities],
  );

  const visible = useMemo(
    () =>
      rankFeedAds(ads, {
        mode: tab,
        marketCode,
        categoryId: categoryFilter || undefined,
        cities,
        metrics,
        blockedOwners,
      }),
    [ads, blockedOwners, categoryFilter, cities, marketCode, metrics, tab],
  );

  useEffect(() => {
    if (!params.focus || !ready) return;
    const index = visible.findIndex((ad) => ad.id === params.focus);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [params.focus, ready, visible]);

  if (!ready) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={BRAND.yellowDark} size="large" />
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
        renderItem={({ item }) => (
          <View style={{ height: itemHeight, width }}>
            <AdCard ad={item} height={itemHeight} active={active === item.id} fullscreen />
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyWrap, { height: itemHeight }]}>
            <EmptyState
              icon="campaign"
              title={t("noAds")}
              text={t("noAdsHelp")}
              actionLabel={t("create")}
              onAction={() => router.push("/(tabs)/create" as never)}
            />
          </View>
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={2}
        windowSize={3}
      />

      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top }]}>
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
            {(
              [
                ["forYou", t("forYou")],
                ["nearby", t("near")],
                ["latest", t("latest")],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => {
                  setTab(key);
                  if (key !== "latest") setCategoryFilter("");
                }}
                style={[styles.tab, tab === key && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
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
            accessibilityRole="button"
            onPress={() => setCategoryFilter("")}
            style={styles.filterChip}
          >
            <Text style={styles.filterText}>
              {productData.categories.find((item) => item.id === categoryFilter)?.ar ?? categoryFilter}
            </Text>
            <MaterialIcons name="close" size={16} color={BRAND.white} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.black },
  center: { alignItems: "center", justifyContent: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
    gap: 2,
  },
  tab: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#eee", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  filterChip: {
    alignSelf: "center",
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  filterText: { color: BRAND.white, fontSize: 12, fontWeight: "800" },
  emptyWrap: { justifyContent: "center", paddingHorizontal: 24 },
});
