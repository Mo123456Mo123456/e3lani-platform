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
import { MARKETS } from "@/lib/e3lani-catalog";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const { marketCode, setMarket } = useE3lani();
  const productData = useProductData();
  const [query, setQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);

  const market = MARKETS.find((item) => item.code === marketCode) ?? MARKETS[0];
  const categories = useMemo(() => {
    const text = query.trim();
    return productData.categories.filter((category) => {
      const label = locale === "ar" ? category.ar : category.en;
      return !text || label.includes(text);
    });
  }, [locale, productData.categories, query]);

  return (
    <ScreenContainer className="px-0" containerClassName="bg-[#F7F7F7]">
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t("categories")}</Text>
        <Text style={styles.logo}>
          إعلاني<Text style={{ color: BRAND.yellowDark }}>.</Text>
        </Text>
      </View>

      <View style={styles.body}>
        <Pressable accessibilityRole="button" onPress={() => setMarketOpen(true)} style={styles.market}>
          <View>
            <Text style={styles.marketName}>{locale === "ar" ? market.ar : market.en}</Text>
            <Text style={styles.marketHelp}>{t("marketHelp")}</Text>
          </View>
          <Text style={styles.marketCode}>{market.code}</Text>
        </Pressable>

        <View style={[styles.searchbox, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
          <MaterialIcons name="search" size={20} color={BRAND.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchCategory")}
            placeholderTextColor={BRAND.muted}
            style={[styles.searchInput, { textAlign: isRTL ? "right" : "left" }]}
          />
        </View>

        <FlatList
          data={categories}
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
                  router.push({ pathname: "/(tabs)", params: { category: item.id } } as never)
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
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("chooseMarket")}</Text>
            {MARKETS.map((item) => (
              <Pressable
                key={item.code}
                onPress={() => {
                  setMarket(item.code);
                  setMarketOpen(false);
                }}
                style={styles.option}
              >
                <Text style={styles.marketCode}>{item.code}</Text>
                <Text style={styles.optionText}>{locale === "ar" ? item.ar : item.en}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setMarketOpen(false)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t("close")}</Text>
            </Pressable>
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headTitle: { fontSize: 21, fontWeight: "900", color: BRAND.black },
  logo: { fontSize: 19, fontWeight: "900", color: BRAND.black },
  body: { flex: 1, padding: 16 },
  market: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: BRAND.black,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketName: { color: BRAND.white, fontWeight: "900", fontSize: 15, textAlign: "right" },
  marketHelp: { marginTop: 4, color: "#bbb", fontSize: 11, textAlign: "right" },
  marketCode: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: BRAND.yellow,
    color: BRAND.black,
    fontWeight: "900",
    overflow: "hidden",
  },
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
  categoryName: { fontSize: 11, lineHeight: 15, fontWeight: "900", color: BRAND.black, textAlign: "center" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    maxHeight: "88%",
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BRAND.white,
  },
  handle: { width: 52, height: 5, borderRadius: 5, backgroundColor: "#ddd", alignSelf: "center", marginBottom: 15 },
  sheetTitle: { marginBottom: 15, fontSize: 20, fontWeight: "900", textAlign: "right" },
  option: {
    marginBottom: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  optionText: { flex: 1, fontWeight: "800", textAlign: "right" },
  secondary: {
    marginTop: 8,
    height: 51,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900" },
});
