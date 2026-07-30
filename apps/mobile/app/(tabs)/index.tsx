import type { FeedItem } from "@e3lani/types";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FeedCard } from "@/components/feed-card";
import { api } from "@/lib/api";
import { useAuth, useLocale } from "@/lib/app-context";

type Mode = "FOR_YOU" | "NEARBY" | "LATEST";

function Ticker() {
  const [logos, setLogos] = useState<Array<{ id: string; logoUrl: string }>>([]);
  const movement = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    api<Array<{ id: string; logoUrl: string }>>("/catalog/ticker")
      .then((rows) =>
        setLogos(rows.filter((row, index) => index === 0 || row.logoUrl !== rows[index - 1]?.logoUrl)),
      )
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (logos.length === 0) return;
    const animation = Animated.loop(
      Animated.timing(movement, {
        toValue: 1,
        duration: Math.max(18_000, logos.length * 4_000),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [logos, movement]);
  if (logos.length === 0) return null;
  const sequence = [...logos, ...logos];
  return (
    <View pointerEvents="none" accessibilityLabel="شعارات المعلنين" style={styles.ticker}>
      <Animated.View
        style={[
          styles.tickerTrack,
          {
            transform: [
              {
                translateX: movement.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -Math.max(1, logos.length) * 92],
                }),
              },
            ],
          },
        ]}
      >
        {sequence.map((logo, index) => (
          <View key={`${logo.id}-${index}`} style={styles.tickerItem}>
            <Image source={{ uri: logo.logoUrl }} contentFit="contain" style={styles.tickerLogo} />
            <Text style={styles.tickerBrand}>إعلاني</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { authenticated } = useAuth();
  const { locale, rtl } = useLocale();
  const ar = locale === "ar";
  const [mode, setMode] = useState<Mode>("FOR_YOU");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cardHeight = Math.max(420, height - 72 - 128);

  const load = useCallback(async () => {
    try {
      let cityId: string | undefined;
      if (mode === "NEARBY") {
        if (!authenticated) {
          router.push("/login");
          return;
        }
        const me = await api<{ profile: { city: { id: string } } }>("/auth/me");
        cityId = me.profile.city.id;
      }
      const query = new URLSearchParams({
        mode,
        limit: "20",
        ...(cityId ? { cityId } : {}),
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      });
      const data = await api<{ items: FeedItem[] }>(`/content/feed?${query.toString()}`);
      setItems(data.items);
      setActiveId(data.items[0]?.id);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authenticated, mode, params.categoryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<FeedItem>> }) => {
      setActiveId(viewableItems.find((token) => token.isViewable)?.item.id);
    },
  ).current;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.header, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <View>
          <Text style={styles.logo}>إعلاني</Text>
          <Text style={styles.slogan}>{ar ? "منصة الإعلانات المرئية لكل شيء" : "Visual ads for everything"}</Text>
        </View>
      </View>
      <Ticker />
      <View style={[styles.tabs, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        {([
          ["FOR_YOU", ar ? "لك" : "For you"],
          ["NEARBY", ar ? "قريب منك" : "Nearby"],
          ["LATEST", ar ? "الأحدث" : "Latest"],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => {
              setLoading(true);
              setMode(value);
            }}
            style={[styles.tab, mode === value && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === value && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={[styles.center, { height: cardHeight }]}>
          <ActivityIndicator size="large" color="#FFC400" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          pagingEnabled
          snapToInterval={cardHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 65 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor="#FFC400"
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          renderItem={({ item }) => (
            <FeedCard item={item} height={cardHeight} active={activeId === item.id} />
          )}
          ListEmptyComponent={
            <View style={[styles.center, { height: cardHeight }]}>
              <Text style={styles.emptyTitle}>{ar ? "لا توجد إعلانات مطابقة" : "No matching ads"}</Text>
              <Text style={styles.emptyText}>{ar ? "اختر تبويبًا آخر أو حدّث الصفحة." : "Choose another feed or refresh."}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { height: 56, paddingHorizontal: 16, alignItems: "center", justifyContent: "space-between" },
  logo: { color: "#111111", fontSize: 25, fontWeight: "900" },
  slogan: { color: "#666666", fontSize: 9, marginTop: -2 },
  ticker: { height: 36, overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#EEEEEE" },
  tickerTrack: { flexDirection: "row", height: 36, alignItems: "center" },
  tickerItem: { width: 92, flexDirection: "row", alignItems: "center", gap: 7 },
  tickerLogo: { width: 50, height: 25 },
  tickerBrand: { fontSize: 8, fontWeight: "900", backgroundColor: "#FFC400", padding: 2, borderRadius: 3 },
  tabs: { height: 36, paddingHorizontal: 12, gap: 7, alignItems: "center", backgroundColor: "#FFFFFF" },
  tab: { flex: 1, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#FFC400" },
  tabText: { color: "#777777", fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: "#111111", fontWeight: "900" },
  center: { alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#111111" },
  emptyTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", textAlign: "center" },
  emptyText: { color: "#BBBBBB", fontSize: 13, marginTop: 8, textAlign: "center" },
});
