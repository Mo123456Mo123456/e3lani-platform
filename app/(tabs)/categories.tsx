import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { getMarket, MARKETS, type MarketCode } from "@/lib/feed/rank";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const { marketCode, setMarket, setCategoryFilter } = useE3lani();
  const [query, setQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const market = getMarket(marketCode);

  const categories = useMemo(() => {
    const text = query.trim().toLowerCase();
    return productData.categories.filter((category) => {
      if (!text) return true;
      return `${category.ar} ${category.en}`.toLowerCase().includes(text);
    });
  }, [productData.categories, query]);

  const selectMarket = (code: MarketCode) => {
    setMarket(code);
    setMarketOpen(false);
  };

  return (
    <ScreenContainer className="px-5">
      <ScreenTitle title={t("categories")} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("market")}
        onPress={() => setMarketOpen(true)}
        style={styles.market}
      >
        <View>
          <Text style={styles.marketName}>{locale === "ar" ? market.nameAr : market.nameEn}</Text>
          <Text style={styles.marketHelp}>{t("currentMarket")}</Text>
        </View>
        <Text style={styles.marketCode}>{market.code}</Text>
      </Pressable>

      <View style={styles.searchbox}>
        <MaterialIcons name="search" size={20} color={BRAND.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={locale === "ar" ? "ابحث عن قسم" : "Search categories"}
          placeholderTextColor={BRAND.muted}
          style={[styles.searchInput, { textAlign: isRTL ? "right" : "left" }]}
        />
      </View>

      {productData.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
        </View>
      ) : productData.isError ? (
        <View accessible accessibilityRole="alert" style={styles.state}>
          <Text style={styles.stateText}>
            {locale === "ar" ? "تعذر تحميل التصنيفات" : "Categories could not be loaded"}
          </Text>
          <PrimaryButton label={t("retry")} icon="refresh" onPress={productData.retry} />
        </View>
      ) : (
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
                accessible
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => {
                  setCategoryFilter(item.id);
                  router.push({ pathname: "/(tabs)", params: { category: item.id } } as never);
                }}
                style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View accessible={false} style={styles.icon}>
                  <MaterialIcons accessible={false} name={item.icon as never} size={27} color={BRAND.black} />
                </View>
                <Text style={styles.name}>{label}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={marketOpen} transparent animationType="slide" onRequestClose={() => setMarketOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMarketOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{locale === "ar" ? "اختر السوق" : "Choose market"}</Text>
            {MARKETS.map((item) => (
              <Pressable key={item.code} style={styles.option} onPress={() => selectMarket(item.code)}>
                <Text style={styles.marketCode}>{item.code}</Text>
                <Text style={styles.optionName}>{locale === "ar" ? item.nameAr : item.nameEn}</Text>
              </Pressable>
            ))}
            <PrimaryButton label={t("close")} onPress={() => setMarketOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  market: {
    marginTop: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: BRAND.black,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketName: { color: BRAND.white, fontSize: 16, fontWeight: "900", textAlign: "right" },
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
    flexDirection: "row",
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
  state: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center", gap: 16 },
  stateText: { color: BRAND.black, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: "center" },
  list: { paddingTop: 4, paddingBottom: 32, gap: 10 },
  row: { gap: 10 },
  card: {
    flex: 1,
    minHeight: 96,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    padding: 10,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: BRAND.black, fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "center" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
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
  sheetTitle: { marginBottom: 15, color: BRAND.black, fontSize: 20, fontWeight: "900", textAlign: "right" },
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
  optionName: { color: BRAND.black, fontSize: 15, fontWeight: "800" },
});
