import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch, clearSession, colors } from "@/lib/api";

type Me = {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  accountType?: string;
  avatarUrl?: string;
  city?: { nameAr: string };
  businessProfile?: { bio?: string; logoUrl?: string; coverUrl?: string; verifiedAt?: string };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ProfileScreen() {
  const [me, setMe] = useState<Me>();
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    void apiFetch<Me>("/auth/me").then(setMe).catch(() => setMe(undefined));
  }, []);
  useFocusEffect(load);

  async function uploadAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85
    });
    if (picked.canceled) return;
    setBusy(true);
    try {
      const selected = picked.assets[0];
      if (!selected) return;
      const blob = await fetch(selected.uri).then((response) => response.blob());
      const prepared = await apiFetch<{ assetId: string; uploadUrl: string; headers: Record<string, string> }>("/media/prepare", {
        method: "POST",
        body: JSON.stringify({
          fileName: selected.fileName ?? "avatar.jpg",
          contentType: selected.mimeType ?? "image/jpeg",
          size: blob.size
        })
      });
      const uploaded = await fetch(prepared.uploadUrl, { method: "PUT", headers: prepared.headers, body: blob });
      if (!uploaded.ok) throw new Error("upload");
      await apiFetch(`/media/${prepared.assetId}/complete`, { method: "POST" });
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await apiFetch<{ status: string }>(`/media/${prepared.assetId}`);
        if (status.status === "READY") break;
        if (["FAILED", "REJECTED"].includes(status.status)) throw new Error("processing");
        await sleep(1000);
      }
      await apiFetch("/me/avatar", { method: "PATCH", body: JSON.stringify({ assetId: prepared.assetId }) });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <View style={styles.guest}>
        <Text style={styles.heading}>حسابي</Text>
        <Text style={styles.muted}>سجّل الدخول لإدارة إعلاناتك ومنشوراتك ومحفوظاتك.</Text>
        <Pressable style={styles.primary} onPress={() => router.push("/login")}><Text style={styles.primaryText}>الدخول أو إنشاء حساب</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>حسابي</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {me.avatarUrl ? <Image source={me.avatarUrl} style={styles.avatarImage} /> : <Text style={styles.avatarLetter}>{me.name?.slice(0, 1) ?? "إ"}</Text>}
        </View>
        <Text style={styles.name}>{me.name}</Text>
        <Text style={styles.muted}>{me.city?.nameAr} · {me.phone}</Text>
        <View style={styles.photoActions}>
          <Pressable disabled={busy} style={styles.secondary} onPress={() => void uploadAvatar()}>
            <Text style={styles.secondaryText}>{busy ? "جارٍ المعالجة…" : "تغيير الصورة"}</Text>
          </Pressable>
          {!!me.avatarUrl && (
            <Pressable style={styles.secondary} onPress={() => void apiFetch("/me/avatar", { method: "PATCH", body: JSON.stringify({ assetId: null }) }).then(load)}>
              <Text style={styles.danger}>حذف الصورة</Text>
            </Pressable>
          )}
        </View>
      </View>
      {busy && <ActivityIndicator color={colors.brand} style={{ marginTop: 15 }} />}
      <View style={styles.menu}>
        {["إعلاناتي", "منشوراتي", "الإشعارات", "تحليلات الإعلانات"].map((label) => (
          <View key={label} style={styles.menuRow}><Text style={styles.menuText}>{label}</Text></View>
        ))}
      </View>
      <Pressable
        style={styles.logout}
        onPress={() => void apiFetch("/auth/logout", { method: "POST" }).finally(async () => { await clearSession(); setMe(undefined); })}
      >
        <Text style={styles.danger}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.muted },
  content: { padding: 18, paddingTop: 55, paddingBottom: 40 },
  guest: { flex: 1, backgroundColor: colors.muted, padding: 24, paddingTop: 80 },
  heading: { textAlign: "right", fontSize: 30, fontWeight: "900" },
  muted: { color: "#666", textAlign: "center", marginTop: 5 },
  primary: { height: 50, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 22 },
  primaryText: { fontWeight: "900" },
  profileCard: { marginTop: 18, backgroundColor: "white", borderRadius: 22, alignItems: "center", padding: 20 },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.brand, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  avatarLetter: { fontSize: 34, fontWeight: "900" },
  name: { fontSize: 22, fontWeight: "900", marginTop: 12 },
  photoActions: { flexDirection: "row-reverse", gap: 8, marginTop: 14 },
  secondary: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  secondaryText: { fontWeight: "700" },
  danger: { color: "#b91c1c", fontWeight: "800" },
  menu: { backgroundColor: "white", borderRadius: 20, marginTop: 16, overflow: "hidden" },
  menuRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  menuText: { textAlign: "right", fontWeight: "700" },
  logout: { marginTop: 16, height: 50, borderRadius: 14, backgroundColor: "white", alignItems: "center", justifyContent: "center" }
});
