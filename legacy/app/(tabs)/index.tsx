import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { EmptyState, Pill } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { height, width } = useWindowDimensions();
  const { ads, blockedOwners, ready, recordMetric } = useE3lani();
  const { isRTL, t } = useI18n();
  const [tab, setTab] = useState("forYou");
  const [active, setActive] = useState("");
  const seen = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Ad }[] }) => {
      const id = viewableItems[0]?.item.id ?? "";
      setActive(id);
      if (id && !seen.current.has(id)) {
        seen.current.add(id);
        recordMetric(id, "impressions");
        recordMetric(id, "views");
      }
    },
  ).current;
  const itemHeight = Math.min(Math.max(height - 238, 430), 680);
  const visible = ads
    .filter((ad) => ad.status === "active" && !blockedOwners.includes(ad.ownerId))
    .sort((a, b) =>
      tab === "latest"
        ? b.createdAt.localeCompare(a.createdAt)
        : Number(b.sponsored) - Number(a.sponsored),
    );

  if (!ready) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View>
          <Text style={styles.logo}>إعلاني</Text>
          <Text style={styles.logoEn}>E3lani</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("search")} onPress={() => router.push("/search" as never)} style={styles.search}>
          <Text style={styles.searchText}>{t("search")}</Text>
          <MaterialIcons accessible={false} name="search" size={23} color={BRAND.black} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("notifications")}
          onPress={() => router.push("/account/notifications" as never)}
          style={styles.bell}
        >
          <MaterialIcons accessible={false} name="notifications-none" size={25} color={BRAND.black} />
        </Pressable>
      </View>
      <View style={[styles.chips, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {["forYou", "near", "latest"].map((key) => (
          <Pill key={key} label={t(key)} active={tab === key} onPress={() => setTab(key)} />
        ))}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(ad) => ad.id}
        renderItem={({ item }) => (
          <View style={{ height: itemHeight, justifyContent: "center" }}>
            <AdCard ad={item} height={itemHeight - 12} active={active === item.id} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="campaign"
            title={t("empty")}
            text={t("emptyHelp")}
            actionLabel={t("createAd")}
            onAction={() => router.push("/create-ad" as never)}
          />
        }
        contentContainerStyle={[styles.list, width > 700 && styles.web]}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={2}
        windowSize={3}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    minHeight: 68,
    paddingHorizontal: 15,
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  logo: { color: BRAND.black, fontSize: 20, lineHeight: 23, fontWeight: "900" },
  logoEn: {
    color: BRAND.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  search: {
    flex: 1,
    maxWidth: 430,
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 13,
    backgroundColor: BRAND.surface,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  searchText: { flex: 1, color: BRAND.muted, fontSize: 13, lineHeight: 18, textAlign: "right" },
  bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chips: { paddingHorizontal: 13, paddingVertical: 8, gap: 7 },
  list: { flexGrow: 1, paddingHorizontal: 10 },
  web: { maxWidth: 850, width: "100%", alignSelf: "center" },
});
