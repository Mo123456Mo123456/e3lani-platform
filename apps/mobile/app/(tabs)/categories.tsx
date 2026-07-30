import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch, colors } from "@/lib/api";

type Category = {
  id: string;
  nameAr: string;
  icon?: string;
  children: { id: string; nameAr: string }[];
};

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void apiFetch<{ categories: Category[] }>("/catalog")
      .then((result) => setCategories(result.categories))
      .finally(() => setLoading(false));
  }, []);
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>الأقسام</Text>
      <Text style={styles.subtitle}>اختر قسمًا لاستعراض إعلاناته النشطة.</Text>
      {loading ? <ActivityIndicator color={colors.brand} /> : (
        <FlatList
          data={categories}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.navigate({ pathname: "/(tabs)", params: { categoryId: item.id } })}
            >
              <View style={styles.icon}><Ionicons name="apps" size={23} color={colors.ink} /></View>
              <Text style={styles.name}>{item.nameAr}</Text>
              <Text style={styles.count}>{item.children.length} أقسام فرعية</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.muted, paddingTop: 55, paddingHorizontal: 16 },
  heading: { textAlign: "right", fontSize: 30, fontWeight: "900", color: colors.ink },
  subtitle: { textAlign: "right", color: "#666", marginTop: 5, marginBottom: 18 },
  list: { paddingBottom: 30, gap: 12 },
  row: { gap: 12 },
  card: { flex: 1, minHeight: 145, backgroundColor: "white", borderRadius: 20, padding: 16, alignItems: "flex-end" },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  name: { marginTop: 15, fontSize: 17, fontWeight: "900" },
  count: { marginTop: 3, color: "#777", fontSize: 12 }
});
