import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type Ad = {
  id: string;
  title: string;
  description: string | null;
  category: { nameAr: string };
  city: { nameAr: string } | null;
  owner: {
    id: string;
    name: string | null;
    businessProfile: { slug: string; verified: boolean } | null;
  };
  media: Array<{
    id: string;
    mediaAsset: {
      kind: "IMAGE" | "VIDEO";
      thumbnailUrl: string | null;
      variants: Record<string, string> | null;
    };
  }>;
  contacts: Array<{ id: string; type: string; value: string; label: string | null }>;
};

const width = Dimensions.get("window").width;

function assetUrl(asset: Ad["media"][number]["mediaAsset"]) {
  return asset.variants?.optimized ?? asset.variants?.large ?? asset.variants?.medium ?? asset.thumbnailUrl;
}

function AdVideo({
  asset,
  active,
}: {
  asset: Ad["media"][number]["mediaAsset"];
  active: boolean;
}) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(assetUrl(asset) ?? "", (instance) => {
    instance.loop = true;
    instance.muted = true;
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <View style={styles.media}>
      <VideoView player={player} style={styles.media} nativeControls={false} contentFit="cover" />
      <Pressable
        onPress={() => setMuted((value) => !value)}
        style={styles.sound}
        accessibilityLabel={muted ? "تشغيل الصوت" : "كتم الصوت"}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={22} color="white" />
      </Pressable>
    </View>
  );
}

function Gallery({ items }: { items: Ad["media"] }) {
  const [index, setIndex] = useState(0);
  return (
    <View style={styles.media}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
      >
        {items.map((item) => (
          <Image
            key={item.id}
            source={assetUrl(item.mediaAsset)}
            style={styles.media}
            contentFit="cover"
            placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
            transition={180}
          />
        ))}
      </ScrollView>
      {items.length > 1 && (
        <Text style={styles.counter}>
          {index + 1}/{items.length}
        </Text>
      )}
    </View>
  );
}

function contactUrl(contact: Ad["contacts"][number]) {
  if (contact.type === "PHONE") return `tel:${contact.value}`;
  if (contact.type === "WHATSAPP") {
    return contact.value.startsWith("http")
      ? contact.value
      : `https://wa.me/${contact.value.replace(/\D/g, "")}`;
  }
  return contact.value;
}

export function AdCard({
  ad,
  active,
  height,
  onSave,
}: {
  ad: Ad;
  active: boolean;
  height: number;
  onSave: (id: string) => void;
}) {
  const video = ad.media[0]?.mediaAsset.kind === "VIDEO";
  return (
    <View style={[styles.card, { height }]}>
      {video ? <AdVideo asset={ad.media[0]!.mediaAsset} active={active} /> : <Gallery items={ad.media} />}
      <View style={styles.gradient} />
      <View style={styles.actions}>
        <Pressable onPress={() => onSave(ad.id)} style={styles.roundAction} accessibilityLabel="حفظ الإعلان">
          <Ionicons name="bookmark-outline" color="white" size={25} />
        </Pressable>
        <Pressable
          onPress={() => void Share.share({ message: `https://e3lani.sa/ads/${ad.id}` })}
          style={styles.roundAction}
          accessibilityLabel="مشاركة الإعلان"
        >
          <Ionicons name="share-social-outline" color="white" size={25} />
        </Pressable>
      </View>
      <View style={styles.details}>
        <Pressable
          onPress={() => router.push(`/ad/${ad.id}`)}
          accessibilityRole="link"
        >
          <Text style={styles.owner}>
            {ad.owner.name ?? "معلن"} {ad.owner.businessProfile?.verified ? "●" : ""}
          </Text>
          <Text style={styles.title}>{ad.title}</Text>
        </Pressable>
        {ad.description ? <Text numberOfLines={2} style={styles.description}>{ad.description}</Text> : null}
        <Text style={styles.meta}>
          {ad.category.nameAr} • {ad.city?.nameAr ?? "كل المملكة"}
        </Text>
        <View style={styles.contacts}>
          {ad.contacts.slice(0, 2).map((contact) => (
            <Pressable
              key={contact.id}
              style={styles.contact}
              onPress={() => void Linking.openURL(contactUrl(contact))}
            >
              <Text style={styles.contactText}>
                {contact.label ?? (contact.type === "WHATSAPP" ? "واتساب" : contact.type === "PHONE" ? "اتصال" : "زيارة الرابط")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width, backgroundColor: "#111111", position: "relative", overflow: "hidden" },
  media: { width, height: "100%" },
  sound: { position: "absolute", top: 60, left: 16, backgroundColor: "#0009", padding: 10, borderRadius: 30 },
  counter: { position: "absolute", top: 60, left: 16, color: "white", backgroundColor: "#0009", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  gradient: { position: "absolute", bottom: 0, right: 0, left: 0, height: "48%", backgroundColor: "#0007" },
  actions: { position: "absolute", left: 14, bottom: 140, gap: 12 },
  roundAction: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#0009", alignItems: "center", justifyContent: "center" },
  details: { position: "absolute", right: 18, left: 18, bottom: 22 },
  owner: { color: "#FFC400", fontWeight: "800", fontSize: 15, textAlign: "right" },
  title: { color: "white", fontWeight: "900", fontSize: 22, textAlign: "right", marginTop: 5 },
  description: { color: "#eee", textAlign: "right", marginTop: 4, lineHeight: 20 },
  meta: { color: "#ccc", textAlign: "right", marginTop: 7, fontSize: 12 },
  contacts: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  contact: { backgroundColor: "#FFC400", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  contactText: { color: "#111", fontWeight: "900" },
});
