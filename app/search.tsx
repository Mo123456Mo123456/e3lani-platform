import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CompactAdCard } from "@/components/e3lani/compact-ad-card";
import { EmptyState, Pill, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Search() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { ads, blockedOwners } = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(params.category ?? "");
  const [city, setCity] = useState("");

  const data = ads.filter(
    (ad) =>
      ad.status === "active" &&
      !blockedOwners.includes(ad.ownerId) &&
      (!category || ad.categoryId === category) &&
      (!city || ad.cityId === city) &&
      (!query.trim() || `${ad.title} ${ad.description}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === "ar" ? "رجوع" : "Back"}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialIcons accessible={false} name={isRTL ? "arrow-forward" : "arrow-back"} size={26} color={BRAND.black} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t("search")}</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.body}>
        <View style={[styles.search, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <MaterialIcons accessible={false} name="search" size={23} color={BRAND.muted} />
          <TextInput
            accessibilityLabel={t("search")}
            value={query}
            onChangeText={setQuery}
            placeholder={t("search")}
            placeholderTextColor={BRAND.muted}
            returnKeyType="search"
            style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={locale === "ar" ? "مسح البحث" : "Clear search"}
              onPress={() => setQuery("")}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            >
              <MaterialIcons accessible={false} name="close" size={21} color={BRAND.muted} />
            </Pressable>
          ) : null}
        </View>

        {productData.isLoading ? (
          <View style={styles.catalogState}><ActivityIndicator color={BRAND.yellowDark} /></View>
        ) : productData.isError ? (
          <View accessible accessibilityRole="alert" style={styles.catalogError}>
            <Text style={styles.catalogErrorText}>{locale === "ar" ? "تعذر تحميل فلاتر البحث" : "Search filters could not be loaded"}</Text>
            <PrimaryButton label={t("retry")} icon="refresh" onPress={productData.retry} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pill label={locale === "ar" ? "كل الأقسام" : "All categories"} active={!category} onPress={() => setCategory("")} />
              {productData.categories.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={category === item.id} onPress={() => setCategory(item.id)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pill label={locale === "ar" ? "كل المدن" : "All cities"} active={!city} onPress={() => setCity("")} />
              {productData.cities.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={city === item.id} onPress={() => setCity(item.id)} />)}
            </ScrollView>
          </>
        )}

        {data.length ? (
          <FlatList
            data={data}
            keyExtractor={(ad) => ad.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <View style={styles.item}><CompactAdCard ad={item} /></View>}
          />
        ) : (
          <EmptyState icon="search-off" title={t("noAds")} text={locale === "ar" ? "جرّب كلمات أو فلاتر أخرى." : "Try different words or filters."} />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  body: { flex: 1, width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: 13 },
  search: { marginTop: 12, minHeight: 52, borderWidth: 1, borderColor: BRAND.border, borderRadius: 17, paddingHorizontal: 8, alignItems: "center", gap: 4, backgroundColor: BRAND.surface },
  input: { flex: 1, minHeight: 50, color: BRAND.black, fontSize: 14, lineHeight: 20 },
  clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  catalogState: { minHeight: 96, alignItems: "center", justifyContent: "center" },
  catalogError: { minHeight: 112, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 10 },
  catalogErrorText: { color: BRAND.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  chips: { gap: 7, paddingVertical: 8 },
  list: { paddingTop: 7, paddingBottom: 25 },
  item: { marginBottom: 13 },
});
