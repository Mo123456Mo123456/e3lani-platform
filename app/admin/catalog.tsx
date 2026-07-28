import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { BRAND, categories, cities } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";

export default function Catalog() {
  const { locale } = useI18n();
  return <AdminShell title={locale === "ar" ? "الأقسام والمدن" : "Catalog"}><ScrollView contentContainerStyle={s.page}><Text style={s.title}>{locale === "ar" ? "الأقسام الفعالة" : "Active categories"}</Text><View style={s.grid}>{categories.map((category) => <View key={category.id} style={s.card}><MaterialIcons name={category.icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={25} color={BRAND.yellowDark} /><Text style={s.name}>{locale === "ar" ? category.ar : category.en}</Text><Text style={s.active}>{locale === "ar" ? "فعال" : "Active"}</Text></View>)}</View><Text style={s.title}>{locale === "ar" ? "المدن الفعالة" : "Active cities"}</Text><View style={s.grid}>{cities.map((city) => <View key={city.id} style={s.city}><Text style={s.name}>{locale === "ar" ? city.ar : city.en}</Text><Text style={s.active}>{city.region}</Text></View>)}</View></ScrollView></AdminShell>;
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35 }, title: { marginTop: 6, marginBottom: 10, color: BRAND.black, fontSize: 19, lineHeight: 27, fontWeight: "900", textAlign: "right" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, marginBottom: 20 }, card: { width: "48%", minHeight: 112, borderWidth: 1, borderColor: BRAND.border, borderRadius: 18, padding: 14, backgroundColor: BRAND.surface }, city: { minWidth: 135, flexGrow: 1, minHeight: 75, borderWidth: 1, borderColor: BRAND.border, borderRadius: 17, padding: 14, backgroundColor: BRAND.white }, name: { marginTop: 7, color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "900", textAlign: "right" }, active: { marginTop: 3, color: BRAND.success, fontSize: 10, fontWeight: "800", textAlign: "right" } });
