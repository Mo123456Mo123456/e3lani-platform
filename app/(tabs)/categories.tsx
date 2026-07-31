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

import { PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("SA");
  const [marketOpen, setMarketOpen] = useState(false);
  const markets = [
    { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
    { code: "AE", ar: "الإمارات", en: "United Arab Emirates" },
    { code: "EG", ar: "مصر", en: "Egypt" },
  ];
  const selectedMarket =
    markets.find((item) => item.code === market) ?? markets[0];
  const categories = useMemo(() => {
    const value = query.trim().toLowerCase();
    return productData.categories.filter(
      (item) => !value || `${item.ar} ${item.en}`.toLowerCase().includes(value),
    );
  }, [productData.categories, query]);

  return (
    <ScreenContainer>
      <View
        style={[
          styles.header,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {t("categories")}
        </Text>
        <Text style={styles.logo}>
          إعلاني<Text style={styles.logoDot}>.</Text>
        </Text>
      </View>

      {productData.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
        </View>
      ) : productData.isError ? (
        <View accessible accessibilityRole="alert" style={styles.state}>
          <Text style={styles.stateText}>
            {locale === "ar"
              ? "تعذر تحميل التصنيفات"
              : "Categories could not be loaded"}
          </Text>
          <PrimaryButton
            label={t("retry")}
            icon="refresh"
            onPress={productData.retry}
          />
        </View>
      ) : (
        <FlatList
          data={categories}
          numColumns={3}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  locale === "ar" ? "تغيير السوق" : "Change market"
                }
                onPress={() => setMarketOpen(true)}
                style={({ pressed }) => [
                  styles.market,
                  pressed && styles.pressed,
                ]}
              >
                <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
                  <Text style={styles.marketName}>
                    {locale === "ar" ? selectedMarket.ar : selectedMarket.en}
                  </Text>
                  <Text style={styles.marketHelp}>
                    {locale === "ar"
                      ? "السوق الحالي — اضغط للتغيير"
                      : "Current market — tap to change"}
                  </Text>
                </View>
                <View style={styles.marketCode}>
                  <Text style={styles.marketCodeText}>
                    {selectedMarket.code}
                  </Text>
                </View>
              </Pressable>

              <View
                style={[
                  styles.search,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <MaterialIcons name="search" size={22} color={BRAND.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={
                    locale === "ar" ? "ابحث عن قسم" : "Search categories"
                  }
                  placeholderTextColor={BRAND.muted}
                  style={[
                    styles.searchInput,
                    { textAlign: isRTL ? "right" : "left" },
                  ]}
                />
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="search-off" size={35} color={BRAND.muted} />
              <Text style={styles.stateText}>{t("noAds")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const label = locale === "ar" ? item.ar : item.en;
            return (
              <Pressable
                accessible
                accessibilityRole="link"
                accessibilityLabel={label}
                accessibilityHint={
                  locale === "ar"
                    ? "يعرض إعلانات هذا القسم"
                    : "Shows ads in this category"
                }
                onPress={() =>
                  router.push({
                    pathname: "/search",
                    params: { category: item.id },
                  } as never)
                }
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  accessible={false}
                  name={item.icon as never}
                  size={29}
                  color={BRAND.black}
                />
                <Text numberOfLines={2} style={styles.name}>
                  {label}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={marketOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMarketOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMarketOpen(false)}>
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.handle} />
            <Text
              style={[
                styles.sheetTitle,
                { textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {locale === "ar" ? "اختر السوق" : "Choose market"}
            </Text>
            {markets.map((item) => (
              <Pressable
                key={item.code}
                onPress={() => {
                  setMarket(item.code);
                  setMarketOpen(false);
                }}
                style={[
                  styles.marketOption,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <View style={styles.marketCode}>
                  <Text style={styles.marketCodeText}>{item.code}</Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    { textAlign: isRTL ? "right" : "left" },
                  ]}
                >
                  {locale === "ar" ? item.ar : item.en}
                </Text>
                {market === item.code ? (
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color={BRAND.yellowDark}
                  />
                ) : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
  headerTitle: {
    color: BRAND.black,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "900",
  },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  state: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stateText: {
    color: BRAND.black,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  list: { padding: 16, paddingBottom: 32, gap: 10 },
  row: { gap: 10 },
  market: {
    minHeight: 78,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: BRAND.black,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketName: {
    color: BRAND.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  marketHelp: { marginTop: 4, color: "#BBB", fontSize: 10, lineHeight: 15 },
  marketCode: {
    minWidth: 46,
    minHeight: 34,
    borderRadius: 11,
    paddingHorizontal: 9,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  marketCodeText: {
    color: BRAND.black,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  search: {
    minHeight: 50,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: BRAND.white,
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    flex: 1,
    maxWidth: "33.333%",
    minHeight: 103,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    padding: 9,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  name: {
    color: BRAND.black,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  pressed: { opacity: 0.66, transform: [{ scale: 0.98 }] },
  empty: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.58)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxHeight: "84%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 28,
    backgroundColor: BRAND.white,
  },
  handle: {
    width: 52,
    height: 5,
    marginBottom: 15,
    borderRadius: 3,
    backgroundColor: "#DDD",
    alignSelf: "center",
  },
  sheetTitle: {
    marginBottom: 15,
    color: BRAND.black,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
  },
  marketOption: {
    minHeight: 58,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    padding: 10,
    backgroundColor: BRAND.white,
    alignItems: "center",
    gap: 10,
  },
  optionText: {
    flex: 1,
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
});
