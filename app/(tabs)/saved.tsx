import { FlatList, StyleSheet, Text, View } from "react-native";

import { CompactAdCard } from "@/components/e3lani/compact-ad-card";
import { EmptyState } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Saved() {
  const { ads, savedIds } = useE3lani();
  const { isRTL, t } = useI18n();
  const items = ads.filter((ad) => savedIds.includes(ad.id));

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("saved")}</Text>
        <Text style={styles.logo}>إعلاني<Text style={styles.logoDot}>.</Text></Text>
      </View>
      {items.length ? (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CompactAdCard ad={item} removable />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <EmptyState icon="favorite-border" title={t("emptySaved")} text={t("save")} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: BRAND.black, fontSize: 21, lineHeight: 28, fontWeight: "900" },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  list: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 16, paddingBottom: 32 },
  separator: { height: 11 },
});
