import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useCountries } from "@/lib/use-countries";

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "");
}

export default function Welcome() {
  const { completeCountryGate, accountCountry } = useE3lani();
  const { countries, isLoading, fromDatabase, retry } = useCountries();
  const { locale } = useI18n();
  const [selected, setSelected] = useState(accountCountry || "SA");
  const [search, setSearch] = useState("");

  const filteredCountries = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return countries;
    return countries.filter((country) =>
      normalizeSearch(
        `${country.nameAr} ${country.nameEn} ${country.code} ${country.dialCode} ${country.currency}`,
      ).includes(query),
    );
  }, [countries, search]);

  const continueAsGuest = () => {
    completeCountryGate(selected);
    router.replace("/(tabs)" as never);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={locale === "ar" ? "اختر دولتك" : "Choose your country"}
          subtitle={
            locale === "ar"
              ? "لا يلزم تسجيل أو رقم جوال. يمكنك التصفح والنشر مباشرة، وسيبقى الموجز عالميًا."
              : "No account or phone number is required. Browse and publish immediately while the feed stays global."
          }
        />

        <Text style={styles.section}>
          {locale === "ar" ? "دولة الزائر" : "Visitor country"}
        </Text>
        {!fromDatabase && !isLoading ? (
          <Pressable onPress={retry} style={styles.fallbackNotice}>
            <MaterialIcons name="cloud-off" size={18} color={BRAND.warning} />
            <Text style={styles.hint}>
              {locale === "ar"
                ? "تعذر جلب الدول من الخادم — اضغط لإعادة المحاولة."
                : "Could not load countries from the server — tap to retry."}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={21} color={BRAND.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              locale === "ar"
                ? "ابحث باسم الدولة أو الرمز أو مفتاح الاتصال"
                : "Search country, code or dial prefix"
            }
            placeholderTextColor={BRAND.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { textAlign: locale === "ar" ? "right" : "left" }]}
          />
          {search ? (
            <Pressable accessibilityRole="button" onPress={() => setSearch("")}>
              <MaterialIcons name="close" size={20} color={BRAND.black} />
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <ActivityIndicator color={BRAND.yellowDark} />
        ) : filteredCountries.length ? (
          <View style={styles.grid}>
            {filteredCountries.map((country) => {
              const active = selected === country.code;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  key={country.code}
                  onPress={() => setSelected(country.code)}
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text style={styles.flag}>{country.flag}</Text>
                  <View style={styles.countryCopy}>
                    <Text numberOfLines={1} style={styles.chipText}>
                      {locale === "ar" ? country.nameAr : country.nameEn}
                    </Text>
                    <Text style={styles.countryMeta}>
                      {country.code} · {country.dialCode}
                    </Text>
                  </View>
                  {active ? (
                    <MaterialIcons name="check-circle" size={20} color={BRAND.yellowDark} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <MaterialIcons name="public-off" size={34} color={BRAND.muted} />
            <Text style={styles.emptyText}>
              {locale === "ar" ? "لا توجد دولة مطابقة للبحث" : "No country matches your search"}
            </Text>
          </View>
        )}

        <PrimaryButton
          label={locale === "ar" ? "دخول إلى إعلاني" : "Enter E3lani"}
          icon="travel-explore"
          onPress={continueAsGuest}
        />
        <Text style={styles.launchNote}>
          {locale === "ar"
            ? "الإطلاق مجاني الآن. التسجيل والدفع محفوظان للمرحلة اللاحقة وغير ظاهرين للمستخدم."
            : "Launch access is free. Registration and payments are reserved for a later stage and hidden from users."
          }
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: 24, paddingBottom: 48, gap: 14 },
  section: {
    color: BRAND.black,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  fallbackNotice: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 13,
    padding: 10,
    backgroundColor: BRAND.surface,
  },
  hint: { flex: 1, color: BRAND.muted, fontSize: 12, textAlign: "right" },
  searchBox: {
    minHeight: 52,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: BRAND.white,
  },
  searchInput: {
    flex: 1,
    minHeight: 50,
    color: BRAND.black,
    fontSize: 14,
  },
  grid: { gap: 8 },
  chip: {
    minHeight: 62,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: BRAND.white,
  },
  chipOn: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF8D6" },
  flag: { fontSize: 25 },
  countryCopy: { flex: 1 },
  chipText: { color: BRAND.black, fontSize: 14, fontWeight: "800", textAlign: "right" },
  countryMeta: { marginTop: 3, color: BRAND.muted, fontSize: 11, textAlign: "right" },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 28 },
  emptyText: { color: BRAND.muted, fontSize: 13, fontWeight: "700", textAlign: "center" },
  launchNote: {
    color: BRAND.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
});
