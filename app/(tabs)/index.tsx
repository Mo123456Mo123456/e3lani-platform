import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { TICKER_BRANDS } from "@/lib/e3lani-ui-data";
import { useI18n } from "@/lib/i18n";

function BrandTicker() {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: -1296,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [offset]);

  const group = (suffix: string) =>
    TICKER_BRANDS.flatMap((brand, index) => [
      <View key={`${suffix}-${brand}-${index}`} style={styles.tickerLogo}>
        <Text style={styles.tickerLogoText}>{brand}</Text>
      </View>,
      <View key={`${suffix}-separator-${index}`} style={styles.tickerSeparator}>
        <Text style={styles.tickerSeparatorText}>إعلاني</Text>
      </View>,
    ]);

  return (
    <View pointerEvents="none" style={styles.ticker}>
      <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: offset }] }]}>
        {group("a")}
        {group("b")}
      </Animated.View>
    </View>
  );
}

export default function Home() {
  const { height } = useWindowDimensions();
  const { ads, blockedOwners, ready, recordMetric, metrics, market } = useE3lani();
  const { locale, t } = useI18n();
  const [tab, setTab] = useState("forYou");
  const [active, setActive] = useState("");
  const [feedHeight, setFeedHeight] = useState(Math.max(height - 150, 520));
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
  const visible = useMemo(() => {
    const filtered = ads.filter(
      (ad) =>
        ad.status === "active" &&
        !blockedOwners.includes(ad.ownerId) &&
        (tab !== "near" || (ad.countryCode ?? "SA") === market),
    );

    return [...filtered].sort((a, b) => {
      if (tab === "latest" || tab === "near") return b.createdAt.localeCompare(a.createdAt);
      const score = (ad: Ad) =>
        Number(ad.featured) +
        Number(ad.sponsored) * 0.45 +
        (metrics[ad.id]?.views ?? 0) / 100000;
      return score(b) - score(a);
    });
  }, [ads, blockedOwners, market, metrics, tab]);

  if (!ready) {
    return (
      <ScreenContainer containerClassName="bg-black" safeAreaClassName="bg-black">
        <View style={styles.center}>
          <ActivityIndicator color={BRAND.yellow} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black" safeAreaClassName="bg-black" style={styles.screen}>
      <StatusBar style="light" />
      <View
        style={styles.feedFrame}
        onLayout={(event) => setFeedHeight(Math.max(1, Math.round(event.nativeEvent.layout.height)))}
      >
        <FlatList
          data={visible}
          keyExtractor={(ad) => ad.id}
          renderItem={({ item }) => (
            <AdCard ad={item} height={feedHeight} active={active === item.id} immersive />
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { height: feedHeight }]}>
              <MaterialIcons name="campaign" size={46} color={BRAND.yellow} />
              <Text style={styles.emptyTitle}>{t("noAds")}</Text>
              <Text style={styles.emptyText}>
                {locale === "ar" ? "اختر سوقًا آخر أو أضف إعلانك الآن." : "Choose another market or publish your ad."}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          snapToInterval={feedHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          windowSize={3}
          getItemLayout={(_, index) => ({ length: feedHeight, offset: feedHeight * index, index })}
        />
      </View>

      <BrandTicker />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("search")}
          onPress={() => router.push("/search" as never)}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <MaterialIcons accessible={false} name="search" size={23} color={BRAND.white} />
        </Pressable>

        <View style={styles.tabs}>
          {["forYou", "near", "latest"].map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={t(key)}
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
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <MaterialIcons accessible={false} name="notifications-none" size={24} color={BRAND.white} />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: BRAND.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.black },
  feedFrame: { flex: 1, backgroundColor: BRAND.black },
  ticker: {
    position: "absolute",
    zIndex: 20,
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    overflow: "hidden",
    backgroundColor: BRAND.yellow,
  },
  tickerTrack: { width: 2592, height: 40, flexDirection: "row", alignItems: "center" },
  tickerLogo: { width: 90, paddingHorizontal: 14, alignItems: "center" },
  tickerLogoText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  tickerSeparator: {
    width: 62,
    minHeight: 26,
    marginHorizontal: 5,
    borderRadius: 10,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerSeparatorText: { color: BRAND.white, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  header: {
    position: "absolute",
    zIndex: 18,
    top: 48,
    left: 0,
    right: 0,
    height: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  round: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.62 },
  tabs: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
    borderRadius: 22,
    padding: 3,
    backgroundColor: "rgba(0,0,0,.52)",
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  tab: { minHeight: 32, borderRadius: 18, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#EEE", fontSize: 11, lineHeight: 15, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  empty: { padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.black },
  emptyTitle: { marginTop: 14, color: BRAND.white, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  emptyText: { marginTop: 5, color: "#CCC", fontSize: 13, lineHeight: 20, textAlign: "center" },
});
