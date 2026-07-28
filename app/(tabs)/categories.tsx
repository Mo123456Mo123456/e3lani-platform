import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, categories } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";

export default function Categories() {
  const { locale, isRTL, t } = useI18n();
  return (
    <ScreenContainer className="px-5">
      <ScreenTitle
        title={t("categories")}
        subtitle={
          locale === "ar"
            ? "اختر القسم المناسب للوصول إلى الإعلانات بسرعة."
            : "Choose a category to find relevant ads quickly."
        }
      />
      <FlatList
        data={categories}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const label = locale === "ar" ? item.ar : item.en;
          return (
            <Pressable
              accessible
              accessibilityRole="link"
              accessibilityLabel={label}
              accessibilityHint={locale === "ar" ? "يعرض إعلانات هذا القسم" : "Shows ads in this category"}
              onPress={() => router.push({ pathname: "/search", params: { category: item.id } } as never)}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View accessible={false} style={styles.icon}>
                <MaterialIcons accessible={false} name={item.icon as never} size={29} color={BRAND.black} />
              </View>
              <Text style={[styles.name, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
              <MaterialIcons
                accessible={false}
                name={isRTL ? "arrow-back" : "arrow-forward"}
                size={20}
                color={BRAND.muted}
              />
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 18, paddingBottom: 32, gap: 11 },
  row: { gap: 11 },
  card: {
    flex: 1,
    minHeight: 150,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 21,
    padding: 15,
    backgroundColor: BRAND.surface,
    justifyContent: "space-between",
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900" },
});
