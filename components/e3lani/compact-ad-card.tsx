import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export function CompactAdCard({ ad, removable = false }: { ad: Ad; removable?: boolean }) {
  const { locale, isRTL, t } = useI18n();
  const store = useE3lani();
  const productData = useProductData();
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find((item) => item.id === ad.categoryId);
  const owner = ad.ownerName ?? store.brand?.name ?? "إعلاني";

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={ad.title}
      onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
      style={({ pressed }) => [
        styles.card,
        { flexDirection: isRTL ? "row-reverse" : "row", opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <View style={styles.thumb}>
        <MediaView media={ad.media[0]} accessibilityLabel={ad.title} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.title}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
          {(locale === "ar" ? city?.ar : city?.en) ?? "—"} ·{" "}
          {(locale === "ar" ? category?.ar : category?.en) ?? "—"}
        </Text>
        <Text numberOfLines={1} style={[styles.owner, { textAlign: isRTL ? "right" : "left" }]}>
          {owner}
        </Text>
        <View style={[styles.footer, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.open}>
            <Text style={styles.openText}>{locale === "ar" ? "فتح" : "Open"}</Text>
          </View>
          {removable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={locale === "ar" ? "إزالة من المحفوظات" : "Remove from saved"}
              onPress={(event) => {
                event.stopPropagation();
                store.toggleSave(ad.id);
              }}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
            >
              <MaterialIcons name="delete-outline" size={18} color={BRAND.error} />
              <Text style={styles.removeText}>{locale === "ar" ? "إزالة" : t("clear")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 118,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    backgroundColor: BRAND.white,
  },
  thumb: { width: 120, minHeight: 118, overflow: "hidden", backgroundColor: BRAND.charcoal },
  copy: { flex: 1, minWidth: 0, padding: 12 },
  title: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  meta: { marginTop: 5, color: BRAND.muted, fontSize: 11, lineHeight: 16 },
  owner: { marginTop: 3, color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "800" },
  footer: { marginTop: 8, alignItems: "center", gap: 8 },
  open: {
    minHeight: 31,
    borderRadius: 9,
    paddingHorizontal: 12,
    backgroundColor: BRAND.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  openText: { color: BRAND.black, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  remove: { minHeight: 31, flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  removeText: { color: BRAND.error, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  pressed: { opacity: 0.55 },
});
