import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdCard } from "@/components/e3lani/ad-card";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const tickerNames = ["نَخبة", "URBAN", "رِواق", "VIA", "SAND", "تِقنية", "رؤية", "LUMA"];
type FeedTab = "forYou" | "near" | "latest";

function TickerGroup() {
  return (
    <View style={styles.tickerGroup}>
      {tickerNames.map((name) => (
        <View key={name} style={styles.tickerItem}>
          <Text style={styles.tickerName}>{name}</Text>
          <View style={styles.tickerSeparator}>
            <Text style={styles.tickerSeparatorText}>إعلاني</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function BrandTicker({ top }: { top: number }) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: -1136,
        duration: 22000,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [offset]);

  return (
    <View pointerEvents="none" style={[styles.tickerShell, { height: top + 40, paddingTop: top }]}>
      <View style={styles.ticker}>
        <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: offset }] }]}>
          <TickerGroup />
          <TickerGroup />
        </Animated.View>
      </View>
    </View>
  );
}

export default function Home() {
  const params = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const { ads, blockedOwners, metrics, ready, recordMetric, user } = useE3lani();
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<FeedTab>(params.category ? "latest" : "forYou");
  const [categoryFilter, setCategoryFilter] = useState(params.category ?? "");
  const [active, setActive] = useState("");
  const [feedHeight, setFeedHeight] = useState(0);
  const seen = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  useEffect(() => {
    if (!params.category) return;
    setCategoryFilter(params.category);
    setTab("latest");
  }, [params.category]);

  const visible = useMemo(() => {
    const currentCity = user?.cityId ?? "riyadh";
    const filtered = ads.filter(
      (ad) =>
        ad.status === "active" &&
        !blockedOwners.includes(ad.ownerId) &&
        (!categoryFilter || ad.categoryId === categoryFilter) &&
        (tab !== "near" || ad.cityId === currentCity),
    );

    return [...filtered].sort((a, b) => {
      if (tab === "latest") return b.createdAt.localeCompare(a.createdAt);
      if (tab === "near") {
        return (metrics[b.id]?.views ?? 0) - (metrics[a.id]?.views ?? 0);
      }
      const score = (ad: Ad) =>
        Number(ad.featured) * 3 +
        Number(ad.sponsored) * 2 +
        Math.min((metrics[ad.id]?.views ?? 0) / 50000, 2) +
        new Date(ad.createdAt).getTime() / 1e13;
      return score(b) - score(a);
    });
  }, [ads, blockedOwners, categoryFilter, metrics, tab, user?.cityId]);

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

  const selectTab = (next: FeedTab) => {
    setTab(next);
    setCategoryFilter("");
  };

  const measureFeed = (event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight && nextHeight !== feedHeight) setFeedHeight(nextHeight);
  };

  if (!ready) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" backgroundColor={BRAND.black} />
        <ActivityIndicator color={BRAND.yellow} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen} onLayout={measureFeed}>
      <StatusBar style="dark" backgroundColor={BRAND.yellow} />

      {feedHeight ? (
        <FlatList
          data={visible}
          keyExtractor={(ad) => ad.id}
          renderItem={({ item }) => (
            <View style={[styles.adFrame, { height: feedHeight }]}>
              <AdCard ad={item} height={feedHeight} active={active === item.id} />
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { height: feedHeight }]}>
              <MaterialIcons name="campaign" size={44} color={BRAND.yellow} />
              <Text style={styles.emptyTitle}>{t("noAds")}</Text>
              <Text style={styles.emptyText}>
                {locale === "ar" ? "اختر قسمًا آخر أو أضف إعلانًا جديدًا." : "Choose another category or create a new ad."}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          pagingEnabled
          snapToInterval={feedHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          windowSize={3}
        />
      ) : null}

      <BrandTicker top={insets.top} />

      <View pointerEvents="box-none" style={[styles.feedHeadShell, { top: insets.top + 48 }]}>
        <View style={styles.feedHead}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search")}
            onPress={() => router.push("/search" as never)}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <MaterialIcons name="search" size={24} color={BRAND.white} />
          </Pressable>

          <View style={styles.tabs}>
            {(["forYou", "near", "latest"] as FeedTab[]).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={t(key)}
                accessibilityState={{ selected: tab === key }}
                onPress={() => selectTab(key)}
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
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <MaterialIcons name="notifications-none" size={23} color={BRAND.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "center",
  },
  adFrame: { width: "100%", backgroundColor: BRAND.black, alignItems: "center" },
  tickerShell: {
    position: "absolute",
    zIndex: 50,
    top: 0,
    right: 0,
    left: 0,
    backgroundColor: BRAND.yellow,
  },
  ticker: {
    width: "100%",
    maxWidth: 480,
    height: 40,
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: BRAND.yellow,
  },
  tickerTrack: { width: 2272, height: 40, flexDirection: "row", alignItems: "center" },
  tickerGroup: { width: 1136, height: 40, flexDirection: "row", alignItems: "center" },
  tickerItem: { width: 142, height: 40, flexDirection: "row", alignItems: "center" },
  tickerName: { width: 76, color: BRAND.black, fontSize: 12, fontWeight: "900", textAlign: "center" },
  tickerSeparator: {
    width: 58,
    height: 25,
    borderRadius: 9,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerSeparatorText: { color: BRAND.white, fontSize: 9, fontWeight: "900" },
  feedHeadShell: { position: "absolute", zIndex: 45, right: 0, left: 0 },
  feedHead: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  round: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,.54)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,.55)",
    flexDirection: "row-reverse",
  },
  tab: {
    minHeight: 34,
    borderRadius: 18,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#EEEEEE", fontSize: 11, lineHeight: 15, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  pressed: { opacity: 0.62 },
  empty: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.black,
  },
  emptyTitle: { marginTop: 13, color: BRAND.white, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  emptyText: { marginTop: 5, color: "#BBBBBB", fontSize: 13, lineHeight: 20, textAlign: "center" },
});
