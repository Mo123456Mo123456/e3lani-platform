import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch, colors } from "@/lib/api";

type SavedAd = {
  id: string;
  title: string;
  city: { nameAr: string };
  media: Array<{ thumbnailUrl?: string; url?: string }>;
};

export default function SavedScreen() {
  const [ads, setAds] = useState<SavedAd[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void apiFetch<SavedAd[]>("/saved")
        .then(setAds)
        .catch(() => router.push("/login"))
        .finally(() => setLoading(false));
    }, [])
  );
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>المحفوظات</Text>
      {loading ? <ActivityIndicator color={colors.brand} /> : (
        <FlatList
          data={ads}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>لم تحفظ أي إعلان بعد.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => void Linking.openURL(`https://e3lani.sa/ads/${item.id}`)}>
              <Image source={item.media[0]?.thumbnailUrl ?? item.media[0]?.url} style={styles.image} contentFit="cover" />
              <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
              <Text style={styles.city}>{item.city.nameAr}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.muted, paddingTop: 55, paddingHorizontal: 16 },
  heading: { textAlign: "right", fontSize: 30, fontWeight: "900", marginBottom: 18 },
  list: { gap: 12, paddingBottom: 30 },
  row: { gap: 12 },
  card: { flex: 1, overflow: "hidden", borderRadius: 18, backgroundColor: "white", paddingBottom: 12 },
  image: { width: "100%", aspectRatio: 0.9, backgroundColor: "#111" },
  title: { textAlign: "right", fontWeight: "800", marginTop: 10, paddingHorizontal: 10 },
  city: { textAlign: "right", color: "#777", fontSize: 12, paddingHorizontal: 10, marginTop: 3 },
  empty: { textAlign: "center", color: "#777", marginTop: 80 }
});
