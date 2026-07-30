import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";

type Profile = {
  name: string | null;
  avatarUrl: string | null;
  views: number;
  city: { nameAr: string } | null;
  businessProfile: {
    logoUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    verified: boolean;
  } | null;
  ads: Array<{ id: string; title: string }>;
  posts: Array<{ id: string; caption: string | null }>;
};

export default function PublicProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile>();
  const [tab, setTab] = useState<"ads" | "posts">("ads");
  useEffect(() => {
    if (slug) void api<Profile>(`/profiles/${slug}`).then(setProfile);
  }, [slug]);
  if (!profile) return <ActivityIndicator style={styles.center} color="#FFC400" size="large" />;
  const image = profile.businessProfile?.logoUrl ?? profile.avatarUrl;
  const entries = tab === "ads" ? profile.ads : profile.posts;
  return (
    <View style={styles.screen}>
      <View style={styles.cover}>
        {profile.businessProfile?.coverUrl && (
          <Image source={profile.businessProfile.coverUrl} style={styles.cover} contentFit="cover" />
        )}
      </View>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          {image ? (
            <Image source={image} style={styles.avatar} contentFit="cover" />
          ) : (
            <Text style={styles.letter}>{profile.name?.slice(0, 1) ?? "إ"}</Text>
          )}
        </View>
        <Text style={styles.name}>
          {profile.name ?? "معلن"} {profile.businessProfile?.verified ? "●" : ""}
        </Text>
        <Text style={styles.meta}>
          {profile.city?.nameAr ?? "المملكة"} • {profile.views} مشاهدة
        </Text>
        {profile.businessProfile?.bio && <Text style={styles.bio}>{profile.businessProfile.bio}</Text>}
        <Pressable
          style={styles.share}
          onPress={() => void Share.share({ message: `https://e3lani.sa/profiles/${slug}` })}
        >
          <Text style={styles.shareText}>مشاركة الصفحة</Text>
        </Pressable>
      </View>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "ads" && styles.active]} onPress={() => setTab("ads")}>
          <Text style={styles.tabText}>الإعلانات</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "posts" && styles.active]} onPress={() => setTab("posts")}>
          <Text style={styles.tabText}>المنشورات</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.item}>
            <Text style={styles.itemText}>{"title" in entry ? entry.title : entry.caption ?? "منشور مرئي"}</Text>
          </View>
        ))}
        {!entries.length && <Text style={styles.empty}>لا يوجد محتوى في هذا التبويب.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  cover: { height: 150, width: "100%", backgroundColor: "#ddd" },
  profile: { backgroundColor: "white", margin: 14, marginTop: -30, borderRadius: 20, padding: 18, alignItems: "center" },
  avatar: { width: 80, height: 80, borderRadius: 20, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  letter: { fontSize: 34, fontWeight: "900" },
  name: { fontSize: 21, fontWeight: "900", marginTop: 10 },
  meta: { color: "#666", marginTop: 4 },
  bio: { textAlign: "center", color: "#444", marginTop: 10, lineHeight: 20 },
  share: { backgroundColor: "#111", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  shareText: { color: "white", fontWeight: "800" },
  tabs: { flexDirection: "row-reverse", paddingHorizontal: 14, gap: 8 },
  tab: { flex: 1, alignItems: "center", padding: 12, backgroundColor: "white", borderRadius: 12 },
  active: { borderBottomWidth: 4, borderBottomColor: "#FFC400" },
  tabText: { fontWeight: "900" },
  list: { padding: 14, gap: 8 },
  item: { backgroundColor: "white", borderRadius: 13, padding: 15 },
  itemText: { textAlign: "right", fontWeight: "700" },
  empty: { textAlign: "center", color: "#777", marginTop: 25 },
});
