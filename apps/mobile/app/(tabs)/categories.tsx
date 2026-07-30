import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";

type Category = {
  id: string;
  nameAr: string;
  children: Array<{ id: string; nameAr: string }>;
};

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<{ categories: Category[] }>("/catalog")
      .then((result) => setCategories(result.categories))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#FFC400" />;
  }
  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={categories}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable onPress={() => router.push({ pathname: "/search", params: { categoryId: item.id } })}>
            <Text style={styles.title}>{item.nameAr}</Text>
          </Pressable>
          <View style={styles.children}>
            {item.children.map((child) => (
              <Pressable
                key={child.id}
                style={styles.pill}
                onPress={() => router.push({ pathname: "/search", params: { subcategoryId: child.id } })}
              >
                <Text>{child.nameAr}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>تعذر تحميل الأقسام.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  list: { padding: 16, gap: 12, backgroundColor: "#F7F7F7", flexGrow: 1 },
  card: { backgroundColor: "white", borderRadius: 18, padding: 17 },
  title: { fontSize: 19, fontWeight: "900", textAlign: "right" },
  children: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 13 },
  pill: { backgroundColor: "#F1F1F1", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  empty: { textAlign: "center", marginTop: 80 },
});
