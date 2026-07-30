import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { useAuth, useLocale } from "@/lib/app-context";

type Saved = {
  distributionId: string;
  distribution: {
    id: string;
    status: string;
    post: { title: string; description: string | null };
  };
};

export default function SavedScreen() {
  const { authenticated } = useAuth();
  const { locale, rtl } = useLocale();
  const ar = locale === "ar";
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      if (!authenticated) {
        setLoading(false);
        return;
      }
      api<Saved[]>("/content/saved")
        .then(setItems)
        .finally(() => setLoading(false));
    }, [authenticated]),
  );
  if (!authenticated) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>{ar ? "محفوظاتك مرتبطة بحسابك" : "Saved ads belong to your account"}</Text>
        <Pressable onPress={() => router.push("/login")} style={styles.button}>
          <Text style={styles.buttonText}>{ar ? "تسجيل الدخول" : "Sign in"}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{ar ? "المحفوظات" : "Saved"}</Text>
      {loading ? <ActivityIndicator style={{ flex: 1 }} color="#FFC400" size="large" /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.distributionId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: "/ad/[id]", params: { id: item.distribution.id } })} style={styles.card}>
              <View style={styles.marker} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { textAlign: rtl ? "right" : "left" }]}>{item.distribution.post.title}</Text>
                {item.distribution.post.description ? <Text numberOfLines={2} style={[styles.description, { textAlign: rtl ? "right" : "left" }]}>{item.distribution.post.description}</Text> : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{ar ? "لم تحفظ أي إعلان بعد." : "No saved ads yet."}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F7F7F7" },
  title: { fontSize: 29, fontWeight: "900", color: "#111111", padding: 16, backgroundColor: "#FFFFFF" },
  list: { padding: 14, gap: 10 },
  card: { flexDirection: "row-reverse", gap: 12, borderRadius: 18, backgroundColor: "#FFFFFF", padding: 16, borderWidth: 1, borderColor: "#EEEEEE" },
  marker: { width: 7, borderRadius: 4, backgroundColor: "#FFC400" },
  cardTitle: { fontWeight: "900", fontSize: 16, color: "#111111" },
  description: { marginTop: 5, color: "#666666", fontSize: 12, lineHeight: 18 },
  emptyTitle: { fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 18 },
  empty: { textAlign: "center", marginTop: 80, color: "#777777" },
  button: { minWidth: 180, minHeight: 50, borderRadius: 15, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "900", color: "#111111" },
});
