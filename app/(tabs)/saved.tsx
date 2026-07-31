import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Saved() {
  const { ads, savedIds, toggleSave } = useE3lani();
  const { locale, t } = useI18n();
  const productData = useProductData();
  const items = ads.filter((ad) => savedIds.includes(ad.id));

  return (
    <ScreenContainer className="px-0" containerClassName="bg-[#F7F7F7]">
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t("saved")}</Text>
        <Text style={styles.logo}>
          إعلاني<Text style={{ color: BRAND.yellowDark }}>.</Text>
        </Text>
      </View>

      <View style={styles.body}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("emptySaved")}</Text>
            <Text style={styles.emptyText}>{t("emptySavedHelp")}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(ad) => ad.id}
            contentContainerStyle={{ gap: 11, paddingBottom: 30 }}
            renderItem={({ item }) => {
              const city = productData.cities.find((entry) => entry.id === item.cityId);
              const category = productData.categories.find((entry) => entry.id === item.categoryId);
              const thumb = item.media[0]?.kind === "image" ? item.media[0].uri : "";
              return (
                <View style={styles.card}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]} />
                  )}
                  <View style={styles.info}>
                    <Text numberOfLines={1} style={styles.title}>
                      {item.title}
                    </Text>
                    <Text style={styles.meta}>
                      {(locale === "ar" ? city?.ar : city?.en) ?? "—"} · {(locale === "ar" ? category?.ar : category?.en) ?? "—"}
                    </Text>
                    <Text style={styles.owner}>{item.ownerName ?? "إعلاني"}</Text>
                    <View style={styles.row}>
                      <Pressable
                        style={styles.mini}
                        onPress={() =>
                          router.push({ pathname: "/(tabs)", params: { focus: item.id } } as never)
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
      </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headTitle: { fontSize: 21, fontWeight: "900", color: BRAND.black },
  logo: { fontSize: 19, fontWeight: "900", color: BRAND.black },
  body: { flex: 1, padding: 16 },
  empty: {
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 18,
    backgroundColor: BRAND.white,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: BRAND.black },
  emptyText: { marginTop: 8, color: BRAND.muted, textAlign: "center" },
  card: {
    minHeight: 112,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    backgroundColor: BRAND.white,
    flexDirection: "row",
  },
  thumb: { width: 116, minWidth: 116, backgroundColor: "#333" },
  thumbFallback: { backgroundColor: "#e6c75f" },
  info: { flex: 1, padding: 12 },
  title: { marginBottom: 7, fontSize: 14, fontWeight: "900", textAlign: "right" },
  meta: { marginVertical: 2, color: BRAND.muted, fontSize: 11, textAlign: "right" },
  owner: { marginTop: 2, fontSize: 12, fontWeight: "800", textAlign: "right" },
  row: { marginTop: 8, flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  mini: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#f1f1f1",
  },
  miniText: { fontSize: 11, fontWeight: "900" },
});
