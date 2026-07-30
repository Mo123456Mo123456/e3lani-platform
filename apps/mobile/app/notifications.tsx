import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";

type Notification = {
  id: string;
  titleAr: string;
  bodyAr: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api<Notification[]>("/notifications")
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <ActivityIndicator style={styles.center} color="#FFC400" size="large" />;
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, !item.readAt && styles.unread]}
          onPress={() => {
            void api(`/notifications/${item.id}/read`, { method: "PATCH" });
            setItems((current) =>
              current.map((notification) =>
                notification.id === item.id
                  ? { ...notification, readAt: new Date().toISOString() }
                  : notification,
              ),
            );
          }}
        >
          <Text style={styles.title}>{item.titleAr}</Text>
          <Text style={styles.body}>{item.bodyAr}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString("ar-SA")}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text>لا توجد إشعارات.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 14, gap: 10, backgroundColor: "#F7F7F7", flexGrow: 1 },
  card: { backgroundColor: "white", borderRadius: 15, padding: 16 },
  unread: { borderRightWidth: 5, borderRightColor: "#FFC400" },
  title: { fontWeight: "900", textAlign: "right" },
  body: { color: "#555", textAlign: "right", marginTop: 5, lineHeight: 20 },
  date: { color: "#999", textAlign: "left", marginTop: 8, fontSize: 11 },
});
