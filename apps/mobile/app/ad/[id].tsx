import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { AdCard, type Ad } from "@/components/ad-card";
import { api } from "@/lib/api";

export default function AdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ad, setAd] = useState<Ad>();
  useEffect(() => {
    if (id) void api<Ad>(`/ads/${id}`).then(setAd);
  }, [id]);
  if (!ad) return <ActivityIndicator style={styles.center} color="#FFC400" size="large" />;

  function report() {
    Alert.alert("إبلاغ عن الإعلان", "اختر سبب البلاغ", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "محتوى محظور",
        style: "destructive",
        onPress: () =>
          void api(`/ads/${ad.id}/report`, {
            method: "POST",
            body: JSON.stringify({ reason: "PROHIBITED" }),
          }).then(() => Alert.alert("شكرًا", "تم استلام بلاغك.")),
      },
      {
        text: "إعلان مضلل",
        onPress: () =>
          void api(`/ads/${ad.id}/report`, {
            method: "POST",
            body: JSON.stringify({ reason: "MISLEADING" }),
          }).then(() => Alert.alert("شكرًا", "تم استلام بلاغك.")),
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <AdCard
        ad={ad}
        active
        height={Dimensions.get("window").height - 130}
        onSave={(adId) => void api(`/ads/${adId}/save`, { method: "POST" })}
      />
      <Pressable style={styles.report} onPress={report}>
        <Text style={styles.reportText}>إبلاغ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#111" },
  report: { position: "absolute", top: 18, right: 18, backgroundColor: "#000A", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 8 },
  reportText: { color: "white", fontWeight: "800" },
});
