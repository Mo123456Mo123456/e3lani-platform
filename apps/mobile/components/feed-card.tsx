import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { FeedItem } from "@e3lani/types";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { api } from "@/lib/api";
import { useAuth, useLocale } from "@/lib/app-context";

function contactUrl(item: FeedItem) {
  if (item.contact.type === "PHONE") return `tel:${item.contact.value}`;
  if (item.contact.type === "WHATSAPP") {
    return `https://wa.me/${item.contact.value.replace(/\D/g, "").replace(/^0/, "966")}`;
  }
  return item.contact.value;
}

function VideoMedia({
  url,
  poster,
  active,
  muted,
}: {
  url: string;
  poster: string | null;
  active: boolean;
  muted: boolean;
}) {
  const player = useVideoPlayer({ uri: url, useCaching: true }, (instance) => {
    instance.loop = true;
    instance.muted = muted;
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      accessible
      accessibilityLabel="فيديو الإعلان"
    />
  );
}

export function FeedCard({ item, height, active }: { item: FeedItem; height: number; active: boolean }) {
  const { width } = useWindowDimensions();
  const { locale, rtl } = useLocale();
  const { authenticated } = useAuth();
  const ar = locale === "ar";
  const [muted, setMuted] = useState(true);
  const [saved, setSaved] = useState(item.saved);
  const [slide, setSlide] = useState(0);
  const video = item.media.length === 1 && item.media[0]?.kind === "VIDEO" ? item.media[0] : null;

  async function toggleSaved() {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    const next = !saved;
    setSaved(next);
    try {
      await api(`/content/saved/${item.id}`, { method: next ? "POST" : "DELETE" });
    } catch {
      setSaved(!next);
    }
  }

  function report() {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    Alert.alert(ar ? "سبب البلاغ" : "Report reason", undefined, [
      { text: ar ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: ar ? "محتوى مضلل" : "Misleading",
        onPress: () =>
          void api("/content/reports", {
            method: "POST",
            body: JSON.stringify({ distributionId: item.id, reason: "MISLEADING" }),
          }).then(() => Alert.alert(ar ? "تم استلام البلاغ" : "Report received")),
      },
      {
        text: ar ? "منتج ممنوع" : "Prohibited item",
        style: "destructive",
        onPress: () =>
          void api("/content/reports", {
            method: "POST",
            body: JSON.stringify({ distributionId: item.id, reason: "PROHIBITED_ITEM" }),
          }).then(() => Alert.alert(ar ? "تم استلام البلاغ" : "Report received")),
      },
    ]);
  }

  return (
    <View style={[styles.card, { height }]}>
      {video ? (
        <VideoMedia url={video.url} poster={video.thumbnailUrl} active={active} muted={muted} />
      ) : (
        <FlatList
          horizontal
          pagingEnabled
          data={item.media}
          keyExtractor={(media) => media.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setSlide(Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width))
          }
          renderItem={({ item: media }) => (
            <Image
              source={{ uri: media.url }}
              placeholder={media.thumbnailUrl ? { uri: media.thumbnailUrl } : undefined}
              transition={180}
              contentFit="cover"
              style={{ width, height }}
            />
          )}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View pointerEvents="none" style={styles.scrim} />

      {video ? (
        <Pressable
          onPress={() => setMuted((value) => !value)}
          style={styles.sound}
          accessibilityRole="button"
          accessibilityLabel={muted ? (ar ? "تشغيل الصوت" : "Unmute") : ar ? "كتم الصوت" : "Mute"}
        >
          <MaterialIcons name={muted ? "volume-off" : "volume-up"} color="#FFFFFF" size={23} />
        </Pressable>
      ) : item.media.length > 1 ? (
        <View style={styles.dots}>
          {item.media.map((media, index) => (
            <View
              key={media.id}
              style={[styles.dot, index === slide && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={toggleSaved} style={styles.action} accessibilityLabel={ar ? "حفظ" : "Save"}>
          <MaterialIcons name={saved ? "bookmark" : "bookmark-border"} size={27} color={saved ? "#FFC400" : "#FFFFFF"} />
        </Pressable>
        <Pressable
          onPress={() => Share.share({ message: `${item.title}\nhttps://e3lani.sa/${locale}/ad/${item.id}` })}
          style={styles.action}
          accessibilityLabel={ar ? "مشاركة" : "Share"}
        >
          <MaterialIcons name="share" size={25} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={report} style={styles.action} accessibilityLabel={ar ? "إبلاغ" : "Report"}>
          <MaterialIcons name="flag" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.copy, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
        <Pressable
          onPress={() => Linking.openURL(`https://e3lani.sa/${locale}/profile/${item.advertiser.slug}`)}
          style={[styles.advertiser, { flexDirection: rtl ? "row-reverse" : "row" }]}
        >
          <View style={styles.avatar}>
            {item.advertiser.avatarUrl ? (
              <Image source={{ uri: item.advertiser.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{item.advertiser.name.slice(0, 1)}</Text>
            )}
          </View>
          <Text style={styles.advertiserName}>{item.advertiser.name}</Text>
          {item.advertiser.verified ? <MaterialIcons name="verified" size={18} color="#FFC400" /> : null}
        </Pressable>
        <Text numberOfLines={2} style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>
          {item.title}
        </Text>
        {item.description ? (
          <Text numberOfLines={2} style={[styles.description, { textAlign: rtl ? "right" : "left" }]}>
            {item.description}
          </Text>
        ) : null}
        <View style={[styles.location, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <MaterialIcons name="location-on" color="#FFFFFF" size={15} />
          <Text style={styles.locationText}>{ar ? item.city.nameAr : item.city.nameEn}</Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(contactUrl(item))}
          style={styles.cta}
          accessibilityRole="link"
          accessibilityLabel={ar ? "تواصل مع المعلن" : "Contact advertiser"}
        >
          <Text style={styles.ctaText}>{ar ? "تواصل مع المعلن" : "Contact advertiser"}</Text>
          <MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={19} color="#111111" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", backgroundColor: "#111111", overflow: "hidden" },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.18)",
    borderBottomWidth: 260,
    borderBottomColor: "rgba(0,0,0,.42)",
  },
  sound: {
    position: "absolute",
    top: 18,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.45)",
  },
  dots: { position: "absolute", top: 24, alignSelf: "center", flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.65)" },
  dotActive: { width: 19, backgroundColor: "#FFC400" },
  actions: { position: "absolute", right: 10, bottom: 105, gap: 12 },
  action: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.4)",
  },
  copy: { position: "absolute", left: 17, right: 61, bottom: 20 },
  advertiser: { alignItems: "center", gap: 8 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFC400",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#111111", fontWeight: "900", fontSize: 17 },
  advertiserName: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  title: { marginTop: 10, color: "#FFFFFF", fontWeight: "900", fontSize: 25, lineHeight: 33 },
  description: { marginTop: 5, color: "#EEEEEE", fontSize: 13, lineHeight: 19 },
  location: { alignItems: "center", gap: 3, marginTop: 7 },
  locationText: { color: "#FFFFFF", fontSize: 12 },
  cta: {
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 17,
    borderRadius: 14,
    backgroundColor: "#FFC400",
    flexDirection: "row-reverse",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#111111", fontWeight: "900", fontSize: 14 },
});
