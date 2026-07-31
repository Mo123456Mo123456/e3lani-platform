import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const tickerBrands = [
  "نَخبة",
  "URBAN",
  "رِواق",
  "VIA",
  "SAND",
  "تِقنية",
  "رؤية",
  "LUMA",
];
const tickerGroupWidth = tickerBrands.length * 138;

function BrandTicker() {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: -tickerGroupWidth,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [offset]);

  const group = (key: string) => (
    <View key={key} style={styles.tickerGroup}>
      {tickerBrands.map((brand) => (
        <View key={`${key}-${brand}`} style={styles.tickerPair}>
          <Text style={styles.tickerBrand}>{brand}</Text>
          <View style={styles.tickerSeparator}>
            <Text style={styles.tickerSeparatorText}>إعلاني</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View accessible={false} pointerEvents="none" style={styles.ticker}>
      <Animated.View
        style={[styles.tickerTrack, { transform: [{ translateX: offset }] }]}
      >
        {group("first")}
        {group("second")}
      </Animated.View>
    </View>
  );
}

export default function Home() {
  const { ads, blockedOwners, ready, recordMetric, metrics } = useE3lani();
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<"forYou" | "near" | "latest">("forYou");
  const [active, setActive] = useState("");
  const [feedHeight, setFeedHeight] = useState(0);
  const seen = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
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

  const visible = ads
    .filter(
      (ad) => ad.status === "active" && !blockedOwners.includes(ad.ownerId),
    )
    .filter((ad) => tab !== "near" || (ad.countryCode ?? "SA") === "SA")
    .sort((a, b) => {
      if (tab === "latest") return b.createdAt.localeCompare(a.createdAt);
      if (tab === "near") {
        return Number(b.cityId === "riyadh") - Number(a.cityId === "riyadh");
      }
      const score = (ad: Ad) =>
        Number(ad.featured) * 3 +
        Number(ad.sponsored) * 2 +
        (metrics[ad.id]?.views ?? 0) / 100000;
      return score(b) - score(a);
    });

  if (!ready) {
    return (
      <ScreenContainer
        containerClassName="bg-black"
        safeAreaClassName="bg-black"
      >
        <View style={styles.center}>
          <ActivityIndicator color={BRAND.yellow} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black" safeAreaClassName="bg-black">
      <StatusBar style="light" />
      <View
        style={styles.feedFrame}
        onLayout={(event) =>
          setFeedHeight(Math.round(event.nativeEvent.layout.height))
        }
      >
        <FlatList
          data={visible}
          keyExtractor={(ad) => ad.id}
          renderItem={({ item }) => (
            <AdCard
              ad={item}
              height={feedHeight || 1}
              active={active === item.id}
              variant="feed"
            />
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { height: feedHeight || 520 }]}>
              <MaterialIcons name="campaign" size={48} color={BRAND.yellow} />
              <Text style={styles.emptyTitle}>{t("noAds")}</Text>
              <Text style={styles.emptyText}>
                {locale === "ar"
                  ? "اختر قسمًا آخر أو أضف إعلانًا."
                  : "Choose another category or post an ad."}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          snapToInterval={feedHeight || undefined}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          windowSize={3}
          style={styles.feed}
          getItemLayout={
            feedHeight
              ? (_data, index) => ({
                  length: feedHeight,
                  offset: feedHeight * index,
                  index,
                })
              : undefined
          }
        />

        <BrandTicker />

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search")}
            onPress={() => router.push("/search" as never)}
            style={({ pressed }) => [
              styles.roundButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="search" size={23} color={BRAND.white} />
          </Pressable>

          <View style={styles.tabs}>
            {(["forYou", "near", "latest"] as const).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && styles.tabActive]}
              >
                <Text
                  style={[styles.tabText, tab === key && styles.tabTextActive]}
                >
                  {t(key)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications")}
            onPress={() => router.push("/account/notifications" as never)}
            style={({ pressed }) => [
              styles.roundButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons
              accessible={false}
              name="notifications-none"
              size={24}
              color={BRAND.white}
            />
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  feedFrame: { flex: 1, overflow: "hidden", backgroundColor: BRAND.black },
  feed: { flex: 1, backgroundColor: BRAND.black },
  ticker: {
    position: "absolute",
    zIndex: 20,
    top: 0,
    right: 0,
    left: 0,
    height: 40,
    overflow: "hidden",
    backgroundColor: BRAND.yellow,
  },
  tickerTrack: { height: 40, flexDirection: "row" },
  tickerGroup: { width: tickerGroupWidth, height: 40, flexDirection: "row" },
  tickerPair: {
    width: 138,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  tickerBrand: {
    width: 78,
    color: BRAND.black,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  tickerSeparator: {
    width: 54,
    height: 26,
    borderRadius: 9,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerSeparatorText: {
    color: BRAND.white,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
  },
  header: {
    position: "absolute",
    zIndex: 19,
    top: 48,
    right: 12,
    left: 12,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,.54)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
    borderRadius: 24,
    padding: 3,
    backgroundColor: "rgba(0,0,0,.54)",
  },
  tab: {
    minHeight: 34,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#EEE", fontSize: 11, lineHeight: 15, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyTitle: {
    marginTop: 12,
    color: BRAND.white,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 6,
    color: "#CCC",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
