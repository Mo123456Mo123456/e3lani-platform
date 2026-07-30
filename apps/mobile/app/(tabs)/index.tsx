import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdCard, type Ad } from "@/components/ad-card";
import { api } from "@/lib/api";

type Banner = {
  id: string;
  owner: { name: string | null };
  logoMedia: { thumbnailUrl: string | null; variants: Record<string, string> | null };
};

const modes = [
  ["FOR_YOU", "لك"],
  ["NEARBY", "قريب منك"],
  ["LATEST", "الأحدث"],
] as const;

function LogoStrip({ banners }: { banners: Banner[] }) {
  const translation = useRef(new Animated.Value(0)).current;
  const logos = banners.filter(
    (item, index) => index === 0 || banners[index - 1]?.owner.name !== item.owner.name,
  );
  useEffect(() => {
    if (!logos.length) return;
    translation.setValue(0);
    const animation = Animated.loop(
      Animated.timing(translation, {
        toValue: -Math.max(1, logos.length) * 132,
        duration: Math.max(12_000, logos.length * 4500),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [logos.length, translation]);
  if (!logos.length) return null;
  return (
    <View pointerEvents="none" style={styles.strip}>
      <Animated.View style={[styles.stripContent, { transform: [{ translateX: translation }] }]}>
        {[...logos, ...logos].map((banner, index) => (
          <View key={`${banner.id}-${index}`} style={styles.logoItem}>
            <Image
              source={banner.logoMedia.variants?.medium ?? banner.logoMedia.thumbnailUrl}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.separator}>إعلاني</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<(typeof modes)[number][0]>("FOR_YOU");
  const [ads, setAds] = useState<Ad[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const viewportHeight = Dimensions.get("window").height - 68;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [feed, strip] = await Promise.all([
        api<{ items: Ad[] }>(`/ads?mode=${mode}&limit=20`),
        api<Banner[]>("/banners"),
      ]);
      setAds(feed.items);
      setBanners(strip);
      setActiveId(feed.items[0]?.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل الإعلانات");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const viewability = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<Ad>> }) => {
      setActiveId(viewableItems[0]?.item.id);
    },
  ).current;

  async function save(id: string) {
    try {
      await api(`/ads/${id}/save`, { method: "POST" });
    } catch {
      router.push("/login");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Text style={styles.brand}>إعلاني</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/search")} accessibilityLabel="البحث">
            <Ionicons name="search" size={25} color="#111" />
          </Pressable>
          <Pressable onPress={() => router.push("/notifications")} accessibilityLabel="الإشعارات">
            <Ionicons name="notifications-outline" size={25} color="#111" />
          </Pressable>
        </View>
      </View>
      <LogoStrip banners={banners} />
      <View style={styles.modes}>
        {modes.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            style={[styles.mode, mode === value && styles.modeActive]}
          >
            <Text style={styles.modeText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFC400" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AdCard ad={item} active={item.id === activeId} height={viewportHeight} onSave={save} />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={viewability}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>لا توجد إعلانات مطابقة الآن.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },
  header: { minHeight: 55, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "white", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 25, fontWeight: "900", color: "#111" },
  headerActions: { flexDirection: "row", gap: 18 },
  strip: { height: 48, backgroundColor: "#FFC400", overflow: "hidden" },
  stripContent: { height: 48, flexDirection: "row", alignItems: "center", width: 10000 },
  logoItem: { width: 132, flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 82, height: 34 },
  separator: { fontSize: 10, fontWeight: "900", color: "#111" },
  modes: { position: "absolute", top: 64, alignSelf: "center", zIndex: 4, flexDirection: "row-reverse", gap: 6, backgroundColor: "#fffE", padding: 4, borderRadius: 22 },
  mode: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18 },
  modeActive: { backgroundColor: "#FFC400" },
  modeText: { color: "#111", fontWeight: "800", fontSize: 12 },
  center: { flex: 1, minHeight: 400, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#111" },
  error: { color: "white", textAlign: "center" },
  empty: { color: "white", fontSize: 17, fontWeight: "700" },
  retry: { marginTop: 15, backgroundColor: "#FFC400", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryText: { fontWeight: "900", color: "#111" },
});
