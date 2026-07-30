import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { apiFetch, colors } from "@/lib/api";

type Ad = {
  id: string;
  title: string;
  description?: string;
  contactType: "STORE" | "PRODUCT" | "WHATSAPP" | "PHONE" | "EXTERNAL";
  contactValue: string;
  owner: { name?: string; avatarUrl?: string; businessProfile?: { logoUrl?: string; verifiedAt?: string } };
  category: { nameAr: string };
  city: { nameAr: string };
  media: Array<{ id: string; kind: "IMAGE" | "VIDEO"; url: string; thumbnailUrl?: string }>;
};

function LogoStrip() {
  const position = useRef(new Animated.Value(0)).current;
  const [logos, setLogos] = useState<Array<{ id: string; logoUrl: string }>>([]);
  useEffect(() => {
    void apiFetch<Array<{ id: string; logoUrl: string }>>("/banners").then(setLogos).catch(() => setLogos([]));
  }, []);
  useEffect(() => {
    if (!logos.length) return;
    const animation = Animated.loop(
      Animated.timing(position, { toValue: -600, duration: 18000, useNativeDriver: true })
    );
    animation.start();
    return () => animation.stop();
  }, [logos.length, position]);
  if (!logos.length) return null;
  return (
    <View pointerEvents="none" style={styles.strip}>
      <Animated.View style={[styles.stripTrack, { transform: [{ translateX: position }] }]}>
        {[...logos, ...logos, ...logos].map((logo, index) => (
          <View key={`${logo.id}-${index}`} style={styles.logoItem}>
            <Image source={logo.logoUrl} style={styles.brandLogo} contentFit="contain" />
            <Text style={styles.miniLogo}>إعلاني</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function VideoMedia({ media, active }: { media: Ad["media"][number]; active: boolean }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(media.url, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });
  useEffect(() => {
    if (active) void player.play();
    else player.pause();
  }, [active, player]);
  return (
    <View style={styles.media}>
      <VideoView player={player} style={styles.media} contentFit="contain" nativeControls={false} />
      <Pressable
        accessibilityLabel={muted ? "تشغيل الصوت" : "كتم الصوت"}
        style={styles.sound}
        onPress={() => {
          player.muted = !muted;
          setMuted(!muted);
        }}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={20} color="white" />
      </Pressable>
    </View>
  );
}

function AdSlide({ ad, active, height }: { ad: Ad; active: boolean; height: number }) {
  const href =
    ad.contactType === "WHATSAPP"
      ? `https://wa.me/${ad.contactValue.replace("+", "")}`
      : ad.contactType === "PHONE"
        ? `tel:${ad.contactValue}`
        : ad.contactValue;
  return (
    <View style={[styles.slide, { height }]}>
      <FlatList
        data={ad.media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.kind === "VIDEO" ? (
            <VideoMedia media={item} active={active} />
          ) : (
            <Image source={item.url} placeholder={item.thumbnailUrl} transition={250} style={styles.media} contentFit="contain" />
          )
        }
      />
      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.owner}>
          <View style={styles.avatar}>
            {ad.owner.businessProfile?.logoUrl || ad.owner.avatarUrl ? (
              <Image source={ad.owner.businessProfile?.logoUrl ?? ad.owner.avatarUrl} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{ad.owner.name?.slice(0, 1) ?? "إ"}</Text>
            )}
          </View>
          <Text style={styles.ownerName}>{ad.owner.name ?? "معلن"}</Text>
          {ad.owner.businessProfile?.verifiedAt && <Text style={styles.verified}>موثّق</Text>}
        </View>
        <Text style={styles.title}>{ad.title}</Text>
        {!!ad.description && <Text numberOfLines={2} style={styles.description}>{ad.description}</Text>}
        <Text style={styles.meta}>{ad.category.nameAr} · {ad.city.nameAr}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.contact} onPress={() => void Linking.openURL(href)}>
            <Text style={styles.contactText}>تواصل مع المعلن</Text>
            <Ionicons name="open-outline" size={18} />
          </Pressable>
          <Pressable style={styles.circle} onPress={() => void Share.share({ message: `https://e3lani.sa/ads/${ad.id}` })}>
            <Ionicons name="share-social" size={20} color="white" />
          </Pressable>
          <Pressable
            style={styles.circle}
            onPress={() =>
              void apiFetch(`/ads/${ad.id}/save`, { method: "POST" }).catch(() => router.push("/login"))
            }
          >
            <Ionicons name="bookmark" size={20} color="white" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { height } = useWindowDimensions();
  const slideHeight = Math.max(500, height - 222);
  const [mode, setMode] = useState<"FOR_YOU" | "NEARBY" | "LATEST">("FOR_YOU");
  const [query, setQuery] = useState("");
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const category = categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : "";
      void apiFetch<{ items: Ad[] }>(`/feed?mode=${mode}&q=${encodeURIComponent(query)}${category}`)
        .then((result) => {
          setAds(result.items);
          setActiveId(result.items[0]?.id);
        })
        .catch(() => setAds([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [categoryId, mode, query]);

  return (
    <View style={styles.screen}>
      <LogoStrip />
      <View style={styles.header}>
        <View style={styles.headline}><Text style={styles.wordmark}>إعلاني</Text><Text> E3lani</Text></View>
        <View style={styles.modes}>
          {([["FOR_YOU", "لك"], ["NEARBY", "قريب منك"], ["LATEST", "الأحدث"]] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => setMode(value)} style={[styles.chip, mode === value && styles.activeChip]}>
              <Text style={[styles.chipText, mode === value && styles.activeChipText]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color="#777" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث في الإعلانات" style={styles.searchInput} textAlign="right" />
        </View>
      </View>
      {loading ? (
        <View style={[styles.loading, { height: slideHeight }]}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={ads}
          pagingEnabled
          snapToInterval={slideHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AdSlide ad={item} active={item.id === activeId} height={slideHeight} />}
          onViewableItemsChanged={({ viewableItems }) => setActiveId(viewableItems[0]?.item?.id)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          ListEmptyComponent={<View style={[styles.loading, { height: slideHeight }]}><Text style={{ color: "white" }}>لا توجد إعلانات مطابقة حاليًا.</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  strip: { height: 42, overflow: "hidden", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  stripTrack: { height: 42, flexDirection: "row", alignItems: "center", gap: 22, width: 1800 },
  logoItem: { flexDirection: "row", alignItems: "center", gap: 16 },
  brandLogo: { width: 72, height: 28 },
  miniLogo: { fontSize: 14, fontWeight: "900" },
  header: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  headline: { flexDirection: "row-reverse", alignItems: "baseline", justifyContent: "flex-end" },
  wordmark: { fontSize: 24, fontWeight: "900", color: colors.ink },
  modes: { flexDirection: "row-reverse", gap: 8, justifyContent: "flex-start" },
  chip: { backgroundColor: colors.muted, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  activeChip: { backgroundColor: colors.ink },
  chipText: { fontWeight: "700" },
  activeChipText: { color: "white" },
  search: { height: 39, borderRadius: 12, backgroundColor: colors.muted, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 11, gap: 7 },
  searchInput: { flex: 1 },
  loading: { backgroundColor: "black", alignItems: "center", justifyContent: "center" },
  slide: { backgroundColor: "black", position: "relative" },
  media: { width: "100%", height: "100%", backgroundColor: "black" },
  sound: { position: "absolute", top: 16, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "#0009", alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingTop: 90, backgroundColor: "#0008" },
  owner: { flexDirection: "row-reverse", alignItems: "center", gap: 8, justifyContent: "flex-start" },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontWeight: "900" },
  ownerName: { color: "white", fontWeight: "800" },
  verified: { color: colors.ink, backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, fontSize: 11 },
  title: { color: "white", fontSize: 24, fontWeight: "900", marginTop: 10, textAlign: "right" },
  description: { color: "#eee", marginTop: 4, textAlign: "right" },
  meta: { color: "#bbb", fontSize: 12, marginTop: 6, textAlign: "right" },
  actions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  contact: { flex: 1, height: 46, borderRadius: 13, backgroundColor: colors.brand, flexDirection: "row-reverse", gap: 7, alignItems: "center", justifyContent: "center" },
  contactText: { color: colors.ink, fontWeight: "900" },
  circle: { width: 46, height: 46, borderRadius: 13, backgroundColor: "#ffffff2e", alignItems: "center", justifyContent: "center" }
});
