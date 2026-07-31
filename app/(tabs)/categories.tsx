import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const [query, setQuery] = useState("");
  const categories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return productData.categories.filter((item) =>
      `${item.ar} ${item.en}`.toLocaleLowerCase().includes(normalized),
    );
  }, [productData.categories, query]);

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("categories")}</Text>
        <Text style={styles.logo}>إعلاني<Text style={styles.logoDot}>.</Text></Text>
      </View>

      <FlatList
          data={categories}
          numColumns={3}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              {productData.catalogIsError ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("retry")}
                  onPress={productData.retry}
                  style={({ pressed }) => [styles.catalogNotice, pressed && styles.pressed]}
                >
                  <MaterialIcons name="cloud-off" size={18} color={BRAND.warning} />
                  <Text style={styles.catalogNoticeText}>
                    {locale === "ar"
                      ? "نعرض الأقسام المحفوظة مؤقتًا — اضغط لإعادة الاتصال"
                      : "Showing cached categories — tap to reconnect"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={locale === "ar" ? "السوق الحالي: السعودية" : "Current market: Saudi Arabia"}
                onPress={() =>
                  Alert.alert(
                    locale === "ar" ? "السوق الحالي" : "Current market",
                    locale === "ar"
                      ? "السعودية هي السوق المتاح حاليًا، وستتوفر أسواق إضافية قريبًا."
                      : "Saudi Arabia is currently available. More markets are coming soon.",
                  )
                }
                style={({ pressed }) => [
                  styles.market,
                  { flexDirection: isRTL ? "row-reverse" : "row", opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <View style={styles.marketCopy}>
                  <Text style={[styles.marketName, { textAlign: isRTL ? "right" : "left" }]}>
                    {locale === "ar" ? "السعودية" : "Saudi Arabia"}
                  </Text>
                  <Text style={[styles.marketHelp, { textAlign: isRTL ? "right" : "left" }]}>
                    {locale === "ar" ? "السوق الحالي — اضغط للتغيير" : "Current market — tap to change"}
                  </Text>
                </View>
                <View style={styles.marketCode}><Text style={styles.marketCodeText}>SA</Text></View>
              </Pressable>

              <View style={[styles.search, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <MaterialIcons name="search" size={22} color={BRAND.muted} />
                <TextInput
                  accessibilityLabel={locale === "ar" ? "ابحث عن قسم" : "Search categories"}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={locale === "ar" ? "ابحث عن قسم" : "Search categories"}
                  placeholderTextColor={BRAND.muted}
                  style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="search-off" size={36} color={BRAND.muted} />
              <Text style={styles.emptyText}>{t("noAds")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const label = locale === "ar" ? item.ar : item.en;
            return (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={label}
                accessibilityHint={locale === "ar" ? "يعرض إعلانات هذا القسم" : "Shows ads in this category"}
                onPress={() => router.navigate({ pathname: "/", params: { category: item.id } } as never)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <MaterialIcons name={item.icon as never} size={29} color={BRAND.black} />
                <Text numberOfLines={2} style={styles.name}>{label}</Text>
              </Pressable>
            );
          }}
      />
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
  list: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 16, paddingBottom: 32, gap: 10 },
  row: { gap: 10 },
  catalogNotice: {
    minHeight: 42,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFF7D2",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  catalogNoticeText: { color: BRAND.black, fontSize: 10, lineHeight: 15, fontWeight: "800", textAlign: "right" },
  market: {
    width: "100%",
    minHeight: 76,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketCopy: { flex: 1 },
  marketName: { color: BRAND.white, fontSize: 15, lineHeight: 21, fontWeight: "900" },
  marketHelp: { marginTop: 4, color: "#BBBBBB", fontSize: 11, lineHeight: 16 },
  marketCode: {
    minWidth: 47,
    minHeight: 35,
    borderRadius: 11,
    paddingHorizontal: 10,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  marketCodeText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  search: {
    minHeight: 52,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: BRAND.white,
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, minHeight: 50, color: BRAND.black, fontSize: 14, lineHeight: 20 },
  card: {
    width: "31.5%",
    minHeight: 105,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    padding: 8,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  name: { color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "900", textAlign: "center" },
  pressed: { opacity: 0.62, transform: [{ scale: 0.98 }] },
  empty: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: BRAND.muted, fontSize: 13, lineHeight: 19, fontWeight: "800" },
});
