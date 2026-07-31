import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { getCategory } from "@/lib/e3lani-ui-data";
import { useI18n } from "@/lib/i18n";

export default function Saved() {
  const { ads, savedIds, toggleSave } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const items = ads.filter((ad) => savedIds.includes(ad.id));

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("saved")}</Text>
        <Text style={styles.logo}>إعلاني<Text style={styles.logoDot}>.</Text></Text>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="favorite-border"
          title={t("emptySaved")}
          text={locale === "ar" ? "اضغط زر الحفظ داخل أي إعلان." : "Tap save on any ad to find it here."}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const category = getCategory(item.categoryId);
            const owner = item.displayOwner ?? "إعلاني";
            return (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={item.title}
                onPress={() => router.push({ pathname: "/ad/[id]", params: { id: item.id } } as never)}
                style={({ pressed }) => [
                  styles.card,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                  pressed && styles.pressed,
                ]}
              >
                {item.media[0]?.kind === "image" ? (
                  <Image source={{ uri: item.media[0].uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.videoThumb]}>
                    <MaterialIcons name="play-circle" size={38} color={BRAND.white} />
                  </View>
                )}
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{item.title}</Text>
                  <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
                    {item.cityName ?? item.cityId} · {locale === "ar" ? category?.ar : category?.en}
                  </Text>
                  <Text style={[styles.owner, { textAlign: isRTL ? "right" : "left" }]}>{owner}</Text>
                  <View style={[styles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={styles.mini}>
                      <Text style={styles.miniText}>{locale === "ar" ? "فتح" : "Open"}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={locale === "ar" ? "إزالة من المحفوظات" : "Remove from saved"}
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleSave(item.id);
                      }}
                      style={styles.mini}
                    >
                      <Text style={styles.miniText}>{locale === "ar" ? "إزالة" : "Remove"}</Text>
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
  headerTitle: { color: BRAND.black, fontSize: 21, lineHeight: 29, fontWeight: "900" },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  list: { padding: 16, paddingBottom: 34, gap: 11 },
  card: {
    minHeight: 126,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    backgroundColor: BRAND.white,
  },
  thumb: { width: 120, minWidth: 120, height: "100%", backgroundColor: BRAND.charcoal },
  videoThumb: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, padding: 12 },
  title: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  meta: { marginTop: 6, color: BRAND.muted, fontSize: 11, lineHeight: 16 },
  owner: { marginTop: 4, color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "800" },
  actions: { marginTop: 7, gap: 7 },
  mini: { minHeight: 31, borderRadius: 9, paddingHorizontal: 11, backgroundColor: "#F1F1F1", alignItems: "center", justifyContent: "center" },
  miniText: { color: BRAND.black, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  pressed: { opacity: 0.68 },
});
