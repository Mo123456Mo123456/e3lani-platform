import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AdCard, type Ad } from "@/components/ad-card";
import { api } from "@/lib/api";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; subcategoryId?: string }>();
  const [query, setQuery] = useState("");
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string>();

  async function search() {
    setLoading(true);
    try {
      const search = new URLSearchParams({ q: query, limit: "20" });
      if (params.categoryId) search.set("categoryId", params.categoryId);
      if (params.subcategoryId) search.set("subcategoryId", params.subcategoryId);
      const result = await api<Ad[]>(`/ads/search?${search}`);
      setAds(result);
      setActiveId(result[0]?.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          textAlign="right"
          placeholder="ابحث في الإعلانات"
          returnKeyType="search"
          onSubmitEditing={() => void search()}
        />
        <Pressable style={styles.button} onPress={() => void search()}>
          <Text style={styles.buttonText}>بحث</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.center} color="#FFC400" size="large" />
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => item.id}
          pagingEnabled
          renderItem={({ item }) => (
            <AdCard
              ad={item}
              active={item.id === activeId}
              height={Dimensions.get("window").height - 150}
              onSave={(id) => void api(`/ads/${id}/save`, { method: "POST" })}
            />
          )}
          onViewableItemsChanged={({ viewableItems }) => setActiveId(viewableItems[0]?.item.id)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          ListEmptyComponent={<Text style={styles.empty}>ابدأ البحث لعرض النتائج.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },
  form: { padding: 12, flexDirection: "row-reverse", gap: 8, backgroundColor: "#F7F7F7" },
  input: { minHeight: 48, backgroundColor: "white", borderRadius: 13, paddingHorizontal: 14, flex: 1, borderWidth: 1, borderColor: "#ddd" },
  button: { backgroundColor: "#FFC400", borderRadius: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "900" },
  center: { flex: 1 },
  empty: { color: "white", textAlign: "center", marginTop: 100, fontWeight: "700" },
});
