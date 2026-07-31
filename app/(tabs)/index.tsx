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
import { EmptyState } from "@/components/e3lani/ui";
import { citiesForMarket, MARKETS } from "@/lib/e3lani-catalog";
import { BRAND, sortFeedAds, type Ad, type FeedMode } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const TICKER = ["نَخبة", "URBAN", "رِواق", "VIA", "SAND", "تِقنية", "رؤية", "LUMA"];

export default function Home() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const { ads, blockedOwners, ready, recordMetric, marketCode, metrics } = useE3lani();
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

  const navReserve = 72 + Math.max(insets.bottom, 0);
  const itemHeight = Math.max(height - navReserve, 520);

  const marketCities = useMemo(
    () => citiesForMarket(marketCode, productData.cities).map((city) => city.id),
    [marketCode, productData.cities],
  );

  const visible = useMemo(() => {
    const filtered = ads.filter((ad) => !blockedOwners.includes(ad.ownerId));
    return sortFeedAds(filtered, tab, {
      marketCityIds: marketCities,
      categoryId: typeof params.category === "string" ? params.category : undefined,
      viewsById: Object.fromEntries(Object.entries(metrics).map(([id, value]) => [id, value.views])),
    });
  }, [ads, blockedOwners, marketCities, metrics, params.category, tab]);

  useEffect(() => {
    if (!params.focus || !ready) return;
    const index = visible.findIndex((ad) => ad.id === params.focus);
    if (index >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 120);
    }
  }, [params.focus, ready, visible]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={BRAND.yellow} size="large" />
      </View>
    );
  }

  const market = MARKETS.find((item) => item.code === marketCode) ?? MARKETS[0];

  return (
    <View style={styles.root}>
      <View style={[styles.ticker, { paddingTop: insets.top }]}>
        <Text numberOfLines={1} style={styles.tickerText}>
          {TICKER.map((logo) => `${logo}  ·  إعلاني  ·  `).join("")}
          {TICKER.map((logo) => `${logo}  ·  إعلاني  ·  `).join("")}
        </Text>
      </View>

      <View style={[styles.feedHead, { top: insets.top + 48, flexDirection: isRTL ? "row" : "row-reverse" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("search")} onPress={() => router.push("/search" as never)} style={styles.round}>
          <MaterialIcons name="search" size={22} color={BRAND.white} />
        </Pressable>

        <View style={styles.tabs}>
          {(["forYou", "near", "latest"] as FeedMode[]).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t(key)}</Text>
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

      {params.category ? (
        <View style={[styles.filterChip, { top: insets.top + 100 }]}>
          <Text style={styles.filterText}>
            {productData.categories.find((item) => item.id === params.category)?.ar ?? params.category}
            {" · "}
            {market.ar}
          </Text>
          <Pressable onPress={() => router.setParams({ category: undefined } as never)}>
            <Text style={styles.filterClear}>{t("clear")}</Text>
          </Pressable>
        </View>
      ) : null}

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
        getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
        renderItem={({ item }) => (
          <View style={{ height: itemHeight }}>
            <AdCard ad={item} height={itemHeight} active={active === item.id} variant="feed" />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ height: itemHeight, justifyContent: "center" }}>
            <EmptyState
              icon="campaign"
              title={t("noAds")}
              text={t("emptyHelp")}
              actionLabel={t("createAd")}
              onAction={() => router.push("/(tabs)/create" as never)}
            />
          </View>
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={2}
        windowSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.black },
  root: { flex: 1, backgroundColor: BRAND.black },
  ticker: {
    position: "absolute",
    zIndex: 50,
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: "flex-end",
    backgroundColor: BRAND.yellow,
    overflow: "hidden",
  },
  tickerText: {
    height: 40,
    lineHeight: 40,
    paddingHorizontal: 12,
    color: BRAND.black,
    fontSize: 13,
    fontWeight: "900",
  },
  feedHead: {
    position: "absolute",
    zIndex: 45,
    left: 0,
    right: 0,
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
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  tab: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#eee", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  filterChip: {
    position: "absolute",
    zIndex: 44,
    alignSelf: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  filterText: { color: BRAND.white, fontSize: 12, fontWeight: "800" },
  filterClear: { color: BRAND.yellow, fontSize: 12, fontWeight: "900" },
});
