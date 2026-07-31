import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, fallbackCategories, fallbackCities } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Saved() {
  const { ads, savedIds, toggleSave } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const cities = productData.cities.length ? productData.cities : fallbackCities;
  const categories = productData.categories.length
    ? productData.categories
    : fallbackCategories;
  const items = ads.filter((ad) => savedIds.includes(ad.id));

  return (
    <ScreenContainer>
      <View style={[styles.head, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={styles.title}>{t("saved")}</Text>
        <Text style={styles.logo}>
          إعلاني<Text style={styles.dot}>.</Text>
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="favorite-border"
            title={t("emptySaved")}
            text={locale === "ar" ? "اضغط زر الحفظ داخل أي إعلان." : "Tap save on any ad."}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const city = cities.find((entry) => entry.id === item.cityId);
            const category = categories.find((entry) => entry.id === item.categoryId);
            return (
              <View style={[styles.card, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                {item.media[0]?.kind === "image" ? (
                  <Image
                    source={{ uri: item.media[0].uri }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]} />
                )}
                <View style={styles.info}>
                  <Text numberOfLines={1} style={[styles.cardTitle, { textAlign: isRTL ? "right" : "left" }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
                    {(locale === "ar" ? city?.ar : city?.en) ?? "—"}
                    {" · "}
                    {(locale === "ar" ? category?.ar : category?.en) ?? item.categoryId}
                  </Text>
                  <Text style={[styles.owner, { textAlign: isRTL ? "right" : "left" }]}>
                    {item.ownerName ?? "إعلاني"}
                  </Text>
                  <View style={[styles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)",
                          params: { focus: item.id },
                        } as never)
                      }
                      style={styles.mini}
                    >
                      <Text style={styles.miniText}>
                        {locale === "ar" ? "فتح" : "Open"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => toggleSave(item.id)} style={styles.mini}>
                      <Text style={styles.miniText}>
                        {locale === "ar" ? "إزالة" : "Remove"}
                      </Text>
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
  head: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 21, fontWeight: "900", color: BRAND.black },
  logo: { fontSize: 19, fontWeight: "900", color: BRAND.black },
  dot: { color: BRAND.yellowDark },
  emptyWrap: { flex: 1, padding: 16 },
  list: { padding: 16, gap: 11, paddingBottom: 30 },
  card: {
    minHeight: 112,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    backgroundColor: BRAND.white,
  },
  thumb: { width: 116, minWidth: 116, backgroundColor: "#333" },
  thumbFallback: { backgroundColor: "#444" },
  info: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: "900", color: BRAND.black },
  meta: { marginTop: 4, color: BRAND.muted, fontSize: 11 },
  owner: { marginTop: 4, color: BRAND.black, fontSize: 11, fontWeight: "800" },
  actions: { marginTop: 8, gap: 8 },
  mini: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#f1f1f1",
  },
  miniText: { fontSize: 11, fontWeight: "900", color: BRAND.black },
});
