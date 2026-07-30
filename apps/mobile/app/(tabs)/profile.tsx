import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, uploadFile } from "@/lib/api";
import { useAuth, useLocale } from "@/lib/app-context";

type Me = {
  id: string;
  phone: string;
  email: string | null;
  roles: string[];
  profile: {
    name: string;
    slug: string;
    accountType: string;
    bio: string | null;
    avatarUrl: string | null;
    city: { nameAr: string; nameEn: string };
  };
  counts: { posts: number; activeAds: number; saved: number };
};

export default function ProfileScreen() {
  const { authenticated, logout } = useAuth();
  const { locale, rtl, setLocale } = useLocale();
  const ar = locale === "ar";
  const [me, setMe] = useState<Me>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    api<Me>("/auth/me")
      .then(setMe)
      .finally(() => setLoading(false));
  }, [authenticated]);
  useFocusEffect(useCallback(() => load(), [load]));

  async function changeAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.fileSize || !asset.mimeType || asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert(ar ? "الصورة يجب أن تكون JPG أو PNG أو WebP وبحد أقصى 5MB" : "Use JPG, PNG, or WebP up to 5MB");
      return;
    }
    const prepared = await api<{ mediaId: string; uploadUrl: string }>("/media/prepare", {
      method: "POST",
      body: JSON.stringify({
        fileName: asset.fileName ?? "avatar.jpg",
        mimeType: asset.mimeType,
        sizeBytes: asset.fileSize,
        kind: "IMAGE",
        purpose: "AVATAR",
      }),
    });
    await uploadFile(prepared.uploadUrl, asset.uri, asset.mimeType);
    await api("/media/complete", { method: "POST", body: JSON.stringify({ mediaId: prepared.mediaId }) });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await api<{ status: string }>(`/media/${prepared.mediaId}/status`);
      if (status.status === "READY") break;
      if (status.status === "FAILED") throw new Error("MEDIA_PROCESSING_FAILED");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    await api("/media/profile", {
      method: "POST",
      body: JSON.stringify({ mediaId: prepared.mediaId, slot: "AVATAR" }),
    });
    load();
  }

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.guestTitle}>{ar ? "أهلًا بك في إعلاني" : "Welcome to E3lani"}</Text>
        <Text style={styles.guestText}>{ar ? "سجّل الدخول لإدارة محتواك ومحفوظاتك." : "Sign in to manage your content and saved ads."}</Text>
        <Pressable onPress={() => router.push("/login")} style={styles.primary}>
          <Text style={styles.primaryText}>{ar ? "تسجيل الدخول" : "Sign in"}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  if (loading || !me) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FFC400" />;
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.cover} />
      <View style={styles.profile}>
        <Pressable onPress={() => void changeAvatar()} style={styles.avatar}>
          {me.profile.avatarUrl ? <Image source={{ uri: me.profile.avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={styles.avatarText}>{me.profile.name.slice(0, 1)}</Text>}
        </Pressable>
        <Text style={styles.name}>{me.profile.name}</Text>
        <Text style={styles.meta}>{ar ? me.profile.city.nameAr : me.profile.city.nameEn} · {me.profile.accountType}</Text>
        <View style={styles.metrics}>
          {[
            [me.counts.posts, ar ? "منشور" : "Posts"],
            [me.counts.activeAds, ar ? "إعلان نشط" : "Active ads"],
            [me.counts.saved, ar ? "محفوظ" : "Saved"],
          ].map(([value, label]) => (
            <View key={String(label)} style={styles.metric}>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.menu}>
        <Pressable onPress={() => Linking.openURL(`https://e3lani.sa/${locale}/profile/${me.profile.slug}`)} style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Text style={styles.rowText}>{ar ? "صفحتي العامة" : "Public profile"}</Text>
          <Text>←</Text>
        </Pressable>
        <Pressable onPress={() => setLocale(ar ? "en" : "ar")} style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Text style={styles.rowText}>{ar ? "English" : "العربية"}</Text>
          <Text>🌐</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert(ar ? "حذف صورة الحساب؟" : "Remove profile image?", undefined, [
            { text: ar ? "إلغاء" : "Cancel", style: "cancel" },
            {
              text: ar ? "حذف" : "Remove",
              style: "destructive",
              onPress: () => void api("/media/profile/AVATAR", { method: "DELETE" }).then(load),
            },
          ])}
          style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}
        >
          <Text style={styles.rowText}>{ar ? "العودة للصورة الافتراضية" : "Use default profile image"}</Text>
          <Text>○</Text>
        </Pressable>
        <Pressable
          onPress={() => void logout().then(() => router.replace("/"))}
          style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}
        >
          <Text style={[styles.rowText, { color: "#B91C1C" }]}>{ar ? "تسجيل الخروج" : "Sign out"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F7F7F7" },
  cover: { height: 100, backgroundColor: "#111111" },
  profile: { alignItems: "center", marginTop: -45, paddingHorizontal: 16 },
  avatar: { width: 90, height: 90, borderRadius: 28, borderWidth: 4, borderColor: "#FFFFFF", backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { fontSize: 36, fontWeight: "900", color: "#111111" },
  name: { marginTop: 10, fontSize: 23, fontWeight: "900", color: "#111111" },
  meta: { marginTop: 4, color: "#666666", fontSize: 12 },
  metrics: { flexDirection: "row", marginTop: 18, backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 14, width: "100%" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontWeight: "900", fontSize: 19 },
  metricLabel: { color: "#777777", fontSize: 10, marginTop: 3 },
  menu: { margin: 16, borderRadius: 18, backgroundColor: "#FFFFFF", overflow: "hidden" },
  row: { minHeight: 54, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  rowText: { fontWeight: "800", color: "#111111", fontSize: 13 },
  guestTitle: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  guestText: { fontSize: 13, color: "#666666", textAlign: "center", marginTop: 8, marginBottom: 20 },
  primary: { minWidth: 190, minHeight: 52, borderRadius: 15, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#111111", fontWeight: "900" },
});
