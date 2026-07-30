import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { Ad } from "@/components/ad-card";
import { api } from "@/lib/api";

function imageUrl(ad: Ad) {
  const media = ad.media[0]?.mediaAsset;
  return media?.variants?.medium ?? media?.thumbnailUrl;
}

export default function SavedScreen() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void api<{ ads: Ad[] }>("/saved")
        .then((result) => setAds(result.ads))
        .catch(() => setSignedOut(true))
        .finally(() => setLoading(false));
    }, []),
  );

  if (loading) return <ActivityIndicator style={styles.center} size="large" color="#FFC400" />;
  if (signedOut) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>سجّل الدخول لعرض محفوظاتك.</Text>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>تسجيل الدخول</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList
      data={ads}
      numColumns={2}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/ad/${item.id}`)}>
          <Image source={imageUrl(item)} style={styles.image} contentFit="cover" />
          <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>لم تحفظ أي إعلان بعد.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 25, backgroundColor: "#F7F7F7" },
  list: { padding: 12, flexGrow: 1, backgroundColor: "#F7F7F7" },
  row: { gap: 12 },
  card: { flex: 1, backgroundColor: "white", borderRadius: 15, overflow: "hidden", marginBottom: 12 },
  image: { width: "100%", aspectRatio: 1 },
  title: { fontWeight: "800", textAlign: "right", padding: 10 },
  empty: { textAlign: "center", color: "#666", marginTop: 80 },
  button: { marginTop: 15, backgroundColor: "#FFC400", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { fontWeight: "900" },
});
