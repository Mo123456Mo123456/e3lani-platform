import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { EmptyState } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Saved() {
  const { ads, savedIds, toggleSave } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const items = ads.filter((ad) => savedIds.includes(ad.id));

  return (
    <ScreenContainer>
      <View
        style={[s.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}
      >
        <Text accessibilityRole="header" style={s.headerTitle}>
          {t("saved")}
        </Text>
        <Text style={s.logo}>
          إعلاني<Text style={s.logoDot}>.</Text>
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="favorite-border"
          title={t("emptySaved")}
          text={
            locale === "ar"
              ? "اضغط زر الحفظ داخل أي إعلان."
              : "Tap save on any ad to find it here."
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const category = productData.categories.find(
              (value) => value.id === item.categoryId,
            );
            const city = productData.cities.find(
              (value) => value.id === item.cityId,
            );
            return (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={item.title}
                onPress={() =>
                  router.push({
                    pathname: "/ad/[id]",
                    params: { id: item.id },
                  } as never)
                }
                style={({ pressed }) => [
                  s.card,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                  pressed && s.pressed,
                ]}
              >
                <View style={s.thumb}>
                  <MediaView
                    media={item.media[0]}
                    accessibilityLabel={item.title}
                  />
                </View>
                <View style={s.info}>
                  <Text
                    numberOfLines={1}
                    style={[s.title, { textAlign: isRTL ? "right" : "left" }]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[s.meta, { textAlign: isRTL ? "right" : "left" }]}
                  >
                    {[
                      locale === "ar" ? city?.ar : city?.en,
                      locale === "ar" ? category?.ar : category?.en,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[s.owner, { textAlign: isRTL ? "right" : "left" }]}
                  >
                    {item.ownerName ?? "إعلاني"}
                  </Text>
                  <View
                    style={[
                      s.actions,
                      { flexDirection: isRTL ? "row-reverse" : "row" },
                    ]}
                  >
                    <View style={s.openButton}>
                      <Text style={s.openText}>
                        {locale === "ar" ? "فتح" : "Open"}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        locale === "ar"
                          ? "إزالة من المحفوظات"
                          : "Remove from saved"
                      }
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleSave(item.id);
                      }}
                      style={({ pressed }) => [
                        s.removeButton,
                        pressed && s.pressed,
                      ]}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={17}
                        color={BRAND.error}
                      />
                      <Text style={s.removeText}>
                        {locale === "ar" ? "إزالة" : "Remove"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: BRAND.black,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "900",
  },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  list: { padding: 16, paddingBottom: 32, gap: 11 },
  card: {
    minHeight: 116,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    backgroundColor: BRAND.white,
  },
  thumb: { width: 116, minHeight: 116, backgroundColor: BRAND.charcoal },
  info: { flex: 1, minWidth: 0, padding: 12 },
  title: {
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
  },
  meta: { marginTop: 5, color: BRAND.muted, fontSize: 10, lineHeight: 15 },
  owner: {
    marginTop: 3,
    color: BRAND.black,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
  },
  actions: { marginTop: 8, alignItems: "center", gap: 7 },
  openButton: {
    minHeight: 30,
    borderRadius: 9,
    paddingHorizontal: 11,
    backgroundColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  openText: {
    color: BRAND.black,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },
  removeButton: {
    minHeight: 30,
    borderRadius: 9,
    paddingHorizontal: 8,
    backgroundColor: "#FFF2F1",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },
  removeText: {
    color: BRAND.error,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "900",
  },
  pressed: { opacity: 0.65 },
});
