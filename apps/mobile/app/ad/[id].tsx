import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { FeedItem } from "@e3lani/types";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FeedCard } from "@/components/feed-card";
import { api } from "@/lib/api";

export default function AdDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { height } = useWindowDimensions();
  const [item, setItem] = useState<FeedItem>();
  useEffect(() => {
    if (id) api<FeedItem>(`/content/distributions/${id}`).then(setItem);
  }, [id]);
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {item ? (
        <FeedCard item={item} height={height} active />
      ) : (
        <ActivityIndicator style={{ flex: 1 }} color="#FFC400" size="large" />
      )}
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="رجوع">
        <MaterialIcons name="arrow-forward" color="#FFFFFF" size={24} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111111" },
  back: {
    position: "absolute",
    top: 54,
    left: 15,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.55)",
  },
});
