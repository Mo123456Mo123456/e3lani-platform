import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, clearSession } from "@/lib/api";
import { uploadMediaAsset } from "@/lib/media-upload";

type Profile = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  accountType: string;
  avatarUrl: string | null;
  city: { nameAr: string } | null;
  businessProfile: { slug: string; verified: boolean; bio: string | null } | null;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void api<Profile>("/auth/me")
      .then(setProfile)
      .catch(() => setProfile(undefined))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(load);

  if (loading) return <ActivityIndicator style={styles.center} color="#FFC400" size="large" />;
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>مرحبًا بك في إعلاني</Text>
        <Text style={styles.muted}>سجّل الدخول لإدارة إعلاناتك ومحفوظاتك.</Text>
        <Pressable style={styles.primary} onPress={() => router.push("/login")}>
          <Text style={styles.primaryText}>تسجيل الدخول</Text>
        </Pressable>
      </View>
    );
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      await clearSession();
      setProfile(undefined);
    }
  }

  async function removeAvatar() {
    await api("/media/profile-avatar", { method: "DELETE" });
    load();
  }

  async function changeAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const mediaId = await uploadMediaAsset(result.assets[0]);
    await api(`/media/${mediaId}/profile-avatar`, { method: "PATCH" });
    load();
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {profile.avatarUrl ? (
            <Image source={profile.avatarUrl} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarLetter}>{profile.name?.slice(0, 1) ?? "إ"}</Text>
          )}
        </View>
        <Text style={styles.heading}>{profile.name ?? profile.phone}</Text>
        <Text style={styles.muted}>
          {profile.city?.nameAr ?? "لم تحدد المدينة"} • {profile.accountType}
        </Text>
        {profile.businessProfile?.verified && <Text style={styles.verified}>● حساب موثق</Text>}
        <Pressable onPress={() => void changeAvatar()}>
          <Text style={styles.change}>تغيير صورة الحساب</Text>
        </Pressable>
        {profile.avatarUrl && (
          <Pressable onPress={() => void removeAvatar()}>
            <Text style={styles.remove}>العودة للصورة الافتراضية</Text>
          </Pressable>
        )}
      </View>
      <Menu label="الإشعارات" onPress={() => router.push("/notifications")} />
      {profile.businessProfile && (
        <Menu
          label="عرض صفحتي العامة"
          onPress={() => router.push(`/profile/${profile.businessProfile?.slug}`)}
        />
      )}
      <Menu label="المحفوظات" onPress={() => router.push("/saved")} />
      <Pressable style={styles.logout} onPress={() => void logout()}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

function Menu({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menu} onPress={onPress}>
      <Text style={styles.chevron}>‹</Text>
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 25, backgroundColor: "#F7F7F7" },
  content: { padding: 16, gap: 10, backgroundColor: "#F7F7F7", flexGrow: 1 },
  profileCard: { backgroundColor: "white", borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 8 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 92, height: 92 },
  avatarLetter: { fontSize: 40, fontWeight: "900" },
  heading: { fontSize: 23, fontWeight: "900", marginTop: 13, textAlign: "center" },
  muted: { color: "#666", marginTop: 5, textAlign: "center" },
  verified: { color: "#9B7800", fontWeight: "800", marginTop: 8 },
  change: { color: "#7A5C00", marginTop: 12, fontWeight: "800" },
  remove: { color: "#B42318", marginTop: 12, fontWeight: "700" },
  primary: { backgroundColor: "#FFC400", borderRadius: 13, paddingHorizontal: 24, paddingVertical: 13, marginTop: 18 },
  primaryText: { fontWeight: "900" },
  menu: { minHeight: 57, backgroundColor: "white", borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuText: { fontWeight: "800" },
  chevron: { fontSize: 28, color: "#777" },
  logout: { minHeight: 54, borderWidth: 1, borderColor: "#D92D20", borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  logoutText: { color: "#D92D20", fontWeight: "900" },
});
