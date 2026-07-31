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

import { ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, FALLBACK_CATEGORIES, MARKETS, getMarket } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const { market, setMarket } = useE3lani();
  const productData = useProductData();
  const [query, setQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);

  const selected = getMarket(market);
  const categories = useMemo(() => {
    const source = productData.categories.length ? productData.categories : FALLBACK_CATEGORIES;
    const text = query.trim().toLowerCase();
    if (!text) return source;
    return source.filter((item) =>
      `${item.ar} ${item.en}`.toLowerCase().includes(text),
    );
  }, [productData.categories, query]);

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle title={t("categories")} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("chooseMarket")}
        onPress={() => setMarketOpen(true)}
        style={[styles.market, { flexDirection: isRTL ? "row" : "row-reverse" }]}
      >
        <View>
          <Text style={[styles.marketName, { textAlign: isRTL ? "right" : "left" }]}>
            {locale === "ar" ? selected.ar : selected.en}
          </Text>
          <Text style={[styles.marketHelp, { textAlign: isRTL ? "right" : "left" }]}>
            {t("currentMarket")}
          </Text>
        </View>
        <View style={styles.marketCode}>
          <Text style={styles.marketCodeText}>{selected.code}</Text>
        </View>
      </Pressable>

      <View style={[styles.search, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
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
                router.push({ pathname: "/search", params: { category: item.id } } as never)
              }
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
            >
              <MaterialIcons name={item.icon as never} size={27} color={BRAND.black} />
              <Text style={styles.name}>{label}</Text>
            </Pressable>
          );
        }}
      />

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
                style={[styles.option, { flexDirection: isRTL ? "row" : "row-reverse" }]}
              >
                <View style={styles.marketCode}>
                  <Text style={styles.marketCodeText}>{item.code}</Text>
                </View>
                <Text style={styles.optionText}>{locale === "ar" ? item.ar : item.en}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setMarketOpen(false)} style={styles.close}>
              <Text style={styles.closeText}>{t("close")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  market: {
    marginTop: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: BRAND.black,
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketName: { color: BRAND.white, fontSize: 15, fontWeight: "900" },
  marketHelp: { marginTop: 4, color: "#bbb", fontSize: 11 },
  marketCode: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: BRAND.yellow,
  },
  marketCodeText: { color: BRAND.black, fontWeight: "900" },
  search: {
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
  list: { paddingBottom: 32, gap: 10 },
  row: { gap: 10 },
  card: {
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
  name: {
    color: BRAND.black,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.55)",
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
  sheetTitle: {
    marginBottom: 15,
    color: BRAND.black,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  option: {
    marginBottom: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    alignItems: "center",
    gap: 9,
  },
  optionText: { color: BRAND.black, fontSize: 15, fontWeight: "800" },
  close: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: BRAND.black, fontWeight: "900" },
});
