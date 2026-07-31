import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { getMarket, MARKETS, UI_CATEGORIES } from "@/lib/e3lani-ui-data";
import { useI18n } from "@/lib/i18n";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  const { market, selectMarket } = useE3lani();
  const [query, setQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const selectedMarket = getMarket(market);
  const categories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return UI_CATEGORIES.filter((item) =>
      `${item.ar} ${item.en}`.toLocaleLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("categories")}</Text>
        <Text style={styles.logo}>إعلاني<Text style={styles.logoDot}>.</Text></Text>
      </View>

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === "ar" ? `السوق الحالي ${selectedMarket.ar}` : `Current market ${selectedMarket.en}`}
          onPress={() => setMarketOpen(true)}
          style={({ pressed }) => [styles.market, pressed && styles.pressed]}
        >
          <View style={styles.marketCode}>
            <Text style={styles.marketCodeText}>{selectedMarket.code}</Text>
          </View>
          <View style={styles.marketCopy}>
            <Text style={styles.marketName}>{locale === "ar" ? selectedMarket.ar : selectedMarket.en}</Text>
            <Text style={styles.marketHelp}>
              {locale === "ar" ? "السوق الحالي — اضغط للتغيير" : "Current market — tap to change"}
            </Text>
          </View>
        </Pressable>

        <View style={[styles.search, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <MaterialIcons name="search" size={22} color={BRAND.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={locale === "ar" ? "ابحث عن قسم" : "Search categories"}
            placeholder={locale === "ar" ? "ابحث عن قسم" : "Search categories"}
            placeholderTextColor={BRAND.muted}
            style={[styles.searchInput, { textAlign: isRTL ? "right" : "left" }]}
          />
        </View>

        <View style={[styles.grid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {categories.map((item) => {
            const label = locale === "ar" ? item.ar : item.en;
            return (
            <Pressable
              accessible
              accessibilityRole="link"
              accessibilityLabel={label}
              key={item.id}
              onPress={() => router.push({ pathname: "/search", params: { category: item.id } } as never)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View accessible={false} style={styles.icon}>
                <MaterialIcons accessible={false} name={item.icon as never} size={29} color={BRAND.black} />
              </View>
              <Text numberOfLines={2} style={styles.name}>{label}</Text>
            </Pressable>
          );
          })}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={marketOpen}
        onRequestClose={() => setMarketOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("close")}
            onPress={() => setMarketOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{locale === "ar" ? "اختر السوق" : "Choose market"}</Text>
            {MARKETS.map((item) => (
              <Pressable
                key={item.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: market === item.code }}
                onPress={() => {
                  selectMarket(item.code);
                  setMarketOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  market === item.code && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.optionCode}>
                  <Text style={styles.optionCodeText}>{item.code}</Text>
                </View>
                <Text style={styles.optionName}>{locale === "ar" ? item.ar : item.en}</Text>
                {market === item.code ? (
                  <MaterialIcons name="check-circle" size={22} color={BRAND.yellowDark} />
                ) : null}
              </Pressable>
            ))}
            <Pressable onPress={() => setMarketOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>{t("close")}</Text>
            </Pressable>
          </View>
        </View>
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
  headerTitle: { color: BRAND.black, fontSize: 21, lineHeight: 29, fontWeight: "900" },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  page: { padding: 16, paddingBottom: 34 },
  market: {
    minHeight: 78,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: BRAND.black,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  marketCopy: { flex: 1, alignItems: "flex-end" },
  marketName: { color: BRAND.white, fontSize: 15, lineHeight: 21, fontWeight: "900", textAlign: "right" },
  marketHelp: { marginTop: 4, color: "#BBB", fontSize: 10, lineHeight: 15, textAlign: "right" },
  marketCode: {
    minWidth: 48,
    minHeight: 36,
    borderRadius: 11,
    paddingHorizontal: 9,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  marketCodeText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  search: {
    minHeight: 51,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: BRAND.white,
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, minHeight: 49, color: BRAND.black, fontSize: 14, lineHeight: 20 },
  grid: { flexWrap: "wrap", gap: 10 },
  card: {
    width: "31%",
    flexGrow: 1,
    minWidth: 96,
    maxWidth: "32%",
    minHeight: 104,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    padding: 8,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  icon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#FFF6D6",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { minHeight: 30, color: BRAND.black, fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "center" },
  pressed: { opacity: 0.65 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.58)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 28,
    backgroundColor: BRAND.white,
  },
  handle: { width: 52, height: 5, marginBottom: 15, borderRadius: 3, backgroundColor: "#DDD", alignSelf: "center" },
  sheetTitle: { marginBottom: 15, color: BRAND.black, fontSize: 21, lineHeight: 29, fontWeight: "900", textAlign: "right" },
  option: {
    minHeight: 57,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: BRAND.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionSelected: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF9E3" },
  optionCode: { minWidth: 45, minHeight: 32, borderRadius: 10, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  optionCodeText: { color: BRAND.black, fontSize: 12, fontWeight: "900" },
  optionName: { flex: 1, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "right" },
  closeButton: { minHeight: 50, marginTop: 4, borderWidth: 1, borderColor: BRAND.border, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  closeText: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900" },
});
