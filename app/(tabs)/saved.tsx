import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, FALLBACK_CATEGORIES, allMarketCities } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Saved() {
  const { ads, savedIds, toggleSave } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const cities = productData.cities.length ? productData.cities : allMarketCities();
  const categories = productData.categories.length ? productData.categories : FALLBACK_CATEGORIES;
  const items = ads.filter((ad) => savedIds.includes(ad.id));

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle title={t("saved")} />
      {items.length === 0 ? (
        <EmptyState icon="favorite-border" title={t("emptySaved")} text={t("save")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const city = cities.find((entry) => entry.id === item.cityId);
            const category = categories.find((entry) => entry.id === item.categoryId);
            const thumb = item.media[0];
            return (
              <View style={[styles.card, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                {thumb?.kind === "image" && !thumb.localAsset ? (
                  <Image source={{ uri: thumb.uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]} />
                )}
                <View style={styles.info}>
                  <Text numberOfLines={1} style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
                    {(locale === "ar" ? city?.ar : city?.en) ?? item.cityId}
                    {" · "}
                    {(locale === "ar" ? category?.ar : category?.en) ?? item.categoryId}
                  </Text>
                  <Text style={[styles.owner, { textAlign: isRTL ? "right" : "left" }]}>
                    {item.ownerName ?? "إعلاني"}
                  </Text>
                  <View style={[styles.actions, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                    <Pressable
                      style={styles.mini}
                      onPress={() =>
                        router.push({ pathname: "/ad/[id]", params: { id: item.id } } as never)
                      }
                    >
                      <Text style={styles.miniText}>{t("open")}</Text>
                    </Pressable>
                    <Pressable style={styles.mini} onPress={() => toggleSave(item.id)}>
                      <Text style={styles.miniText}>{t("remove")}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, paddingBottom: 30, gap: 11 },
  card: {
    minHeight: 112,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    backgroundColor: BRAND.white,
  },
  thumb: { width: 116, minWidth: 116, backgroundColor: "#333" },
  thumbFallback: {
    backgroundColor: BRAND.yellowDark,
  },
  info: { flex: 1, minWidth: 0, padding: 12 },
  title: { marginBottom: 7, color: BRAND.black, fontSize: 14, fontWeight: "900" },
  meta: { marginVertical: 2, color: BRAND.muted, fontSize: 11 },
  owner: { marginTop: 2, color: BRAND.black, fontSize: 12, fontWeight: "800" },
  actions: { marginTop: 8, gap: 8 },
  mini: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#f1f1f1",
  },
  miniText: { color: BRAND.black, fontSize: 11, fontWeight: "900" },
});
