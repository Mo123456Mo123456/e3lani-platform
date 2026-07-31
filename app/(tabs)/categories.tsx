import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  BRAND,
  fallbackCategories,
  markets,
} from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const { market, setMarket } = useE3lani();
  const productData = useProductData();
  const categories = productData.categories.length
    ? productData.categories
    : fallbackCategories;
  const [query, setQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);

  const selected = markets.find((item) => item.code === market) ?? markets[0];
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return categories;
    return categories.filter((category) => {
      const label = (locale === "ar" ? category.ar : category.en).toLowerCase();
      return label.includes(text) || category.id.includes(text);
    });
  }, [categories, locale, query]);

  return (
    <ScreenContainer>
      <View style={[styles.head, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={styles.title}>{t("categories")}</Text>
        <Text style={styles.logo}>
          إعلاني<Text style={styles.dot}>.</Text>
        </Text>
      </View>

      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMarketOpen(true)}
          style={[styles.market, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.marketName, { textAlign: isRTL ? "right" : "left" }]}>
              {locale === "ar" ? selected.ar : selected.en}
            </Text>
            <Text style={[styles.marketHelp, { textAlign: isRTL ? "right" : "left" }]}>
              {t("market")} — {t("changeMarket")}
            </Text>
          </View>
          <View style={styles.marketCode}>
            <Text style={styles.marketCodeText}>{selected.code}</Text>
          </View>
        </Pressable>

        <View style={[styles.searchbox, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <MaterialIcons name="search" size={20} color={BRAND.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={locale === "ar" ? "ابحث عن قسم" : "Search categories"}
            placeholderTextColor={BRAND.muted}
            style={[styles.searchInput, { textAlign: isRTL ? "right" : "left" }]}
          />
        </View>

        <FlatList
          data={filtered}
          numColumns={3}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const label = locale === "ar" ? item.ar : item.en;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)",
                    params: { category: item.id },
                  } as never)
                }
                style={styles.category}
              >
                <MaterialIcons name={item.icon as never} size={27} color={BRAND.black} />
                <Text style={styles.categoryName}>{label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <Modal visible={marketOpen} transparent animationType="slide" onRequestClose={() => setMarketOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMarketOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("selectMarket")}</Text>
            {markets.map((item) => (
              <Pressable
                key={item.code}
                onPress={() => {
                  setMarket(item.code);
                  setMarketOpen(false);
                }}
                style={[styles.option, { flexDirection: isRTL ? "row-reverse" : "row" }]}
              >
                <View style={styles.marketCode}>
                  <Text style={styles.marketCodeText}>{item.code}</Text>
                </View>
                <Text style={styles.optionText}>{locale === "ar" ? item.ar : item.en}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setMarketOpen(false)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t("close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  body: { flex: 1, padding: 16 },
  market: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  marketName: { color: BRAND.white, fontWeight: "900", fontSize: 15 },
  marketHelp: { marginTop: 4, color: "#bbb", fontSize: 11 },
  marketCode: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: BRAND.yellow,
  },
  marketCodeText: { color: BRAND.black, fontWeight: "900" },
  searchbox: {
    alignItems: "center",
    gap: 9,
    marginBottom: 15,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    backgroundColor: BRAND.white,
  },
  searchInput: { flex: 1, height: 50, color: BRAND.black },
  list: { paddingBottom: 30, gap: 10 },
  row: { gap: 10 },
  category: {
    flex: 1,
    minHeight: 96,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  categoryName: {
    color: BRAND.black,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "88%",
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BRAND.white,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 15,
  },
  sheetTitle: { marginBottom: 15, fontSize: 20, fontWeight: "900", color: BRAND.black },
  option: {
    marginBottom: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    alignItems: "center",
    gap: 9,
  },
  optionText: { color: BRAND.black, fontWeight: "900", fontSize: 15 },
  secondary: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: BRAND.black, fontWeight: "900" },
});
