import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
import { rankFeedAds, type FeedMode } from "@/lib/e3lani-feed";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const TAB_BAR = 72;

export default function Home() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { ads, blockedOwners, ready, recordMetric, market, metrics } = useE3lani();
  const { isRTL, t } = useI18n();
  const [tab, setTab] = useState<FeedMode>("forYou");
  const [active, setActive] = useState("");
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

  const itemHeight = Math.max(height - TAB_BAR - Math.max(insets.bottom, 0), 520);
  const visible = useMemo(
    () =>
      rankFeedAds(ads, tab, {
        market,
        blockedOwners,
        metrics,
      }),
    [ads, blockedOwners, market, metrics, tab],
  );

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={BRAND.yellow} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        style={styles.feed}
        data={visible}
        keyExtractor={(ad) => ad.id}
        renderItem={({ item }) => (
          <AdCard ad={item} height={itemHeight} active={active === item.id} fullscreen />
        )}
        ListEmptyComponent={
          <View style={{ height: itemHeight, justifyContent: "center" }}>
            <EmptyState
              icon="campaign"
              title={t("noMatch")}
              text={t("noMatchHelp")}
              actionLabel={t("create")}
              onAction={() => router.push("/(tabs)/create" as never)}
            />
          </View>
        }
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={itemHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <BrandTicker />
        <View style={[styles.head, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search")}
            onPress={() => router.push("/search" as never)}
            style={styles.round}
          >
            <MaterialIcons name="search" size={22} color={BRAND.white} />
          </Pressable>

          <View style={[styles.tabs, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
            {(
              [
                ["forYou", t("forYou")],
                ["near", t("near")],
                ["latest", t("latest")],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => setTab(key)}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.black },
  feed: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.black,
  },
  head: {
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
    borderColor: "rgba(255,255,255,.3)",
    backgroundColor: "rgba(0,0,0,.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    padding: 3,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    backgroundColor: "rgba(0,0,0,.5)",
  },
  tab: {
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#eee", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
});
