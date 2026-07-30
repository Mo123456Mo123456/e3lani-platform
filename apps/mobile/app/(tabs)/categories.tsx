import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { useLocale } from "@/lib/app-context";

type Category = {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string | null;
  children: Array<{ id: string; nameAr: string; nameEn: string }>;
};

export default function CategoriesScreen() {
  const { locale, rtl } = useLocale();
  const ar = locale === "ar";
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ categories: Category[] }>("/catalog")
      .then((data) => setCategories(data.categories))
      .finally(() => setLoading(false));
  }, []);
  const filtered = categories.filter((item) =>
    (ar ? item.nameAr : item.nameEn).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{ar ? "الأقسام" : "Categories"}</Text>
        <View style={[styles.search, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <MaterialIcons name="search" size={22} color="#777777" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={ar ? "ابحث في الأقسام" : "Search categories"}
            textAlign={rtl ? "right" : "left"}
            style={styles.input}
          />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#FFC400" />
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.navigate({ pathname: "/", params: { categoryId: item.id } })}
              style={styles.card}
            >
              <View style={styles.icon}>
                <MaterialIcons name={(item.icon as never) ?? "category"} size={28} color="#111111" />
              </View>
              <Text style={styles.cardTitle}>{ar ? item.nameAr : item.nameEn}</Text>
              <Text style={styles.count}>{item.children.length} {ar ? "أقسام فرعية" : "subcategories"}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{ar ? "لا توجد أقسام مطابقة" : "No categories found"}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingBottom: 13 },
  title: { color: "#111111", fontWeight: "900", fontSize: 28, marginBottom: 14 },
  search: { height: 48, borderRadius: 14, backgroundColor: "#F7F7F7", alignItems: "center", paddingHorizontal: 13, gap: 8 },
  input: { flex: 1, color: "#111111", fontSize: 14 },
  list: { padding: 14, gap: 12 },
  card: { flex: 1, minHeight: 145, borderRadius: 20, backgroundColor: "#FFFFFF", padding: 16, borderWidth: 1, borderColor: "#EEEEEE" },
  icon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center" },
  cardTitle: { marginTop: 13, color: "#111111", fontSize: 16, fontWeight: "900", textAlign: "right" },
  count: { marginTop: 4, color: "#777777", fontSize: 10, textAlign: "right" },
  empty: { textAlign: "center", marginTop: 80, color: "#777777" },
});
