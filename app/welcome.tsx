import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useCountries } from "@/lib/use-countries";

export default function Welcome() {
  const { completeCountryGate, accountCountry } = useE3lani();
  const { countries, isLoading, fromDatabase } = useCountries();
  const { locale } = useI18n();
  const [selected, setSelected] = useState(accountCountry || "SA");

  const continueAsGuest = () => {
    completeCountryGate(selected);
    router.replace("/(tabs)" as never);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenTitle
          title={locale === "ar" ? "إعلاني | E3lani" : "E3lani"}
          subtitle={
            locale === "ar"
              ? "اختر دولتك مع العلم. الموجز يبقى عالميًا بعد المتابعة."
              : "Choose your country with its flag. The feed stays global after you continue."
          }
        />

        <Text style={styles.section}>
          {locale === "ar" ? "دولة الحساب / الزائر" : "Account / visitor country"}
        </Text>
        {!fromDatabase && !isLoading ? (
          <Text style={styles.hint}>
            {locale === "ar"
              ? "تعذر جلب الدول من الخادم — تُعرض قائمة احتياطية مؤقتة."
              : "Could not load countries from the server — showing a temporary fallback list."}
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={BRAND.yellowDark} />
        ) : (
          <View style={styles.grid}>
            {countries.map((country) => {
              const active = selected === country.code;
              return (
                <Pressable
                  key={country.code}
                  onPress={() => setSelected(country.code)}
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text style={styles.chipText}>
                    {country.flag} {locale === "ar" ? country.nameAr : country.nameEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <PrimaryButton
          label={locale === "ar" ? "متابعة كزائر" : "Continue as guest"}
          icon="travel-explore"
          onPress={continueAsGuest}
        />
        <PrimaryButton
          label={locale === "ar" ? "إنشاء حساب معلن" : "Create advertiser account"}
          icon="campaign"
          onPress={() => {
            completeCountryGate(selected);
            router.push({ pathname: "/login", params: { mode: "register" } } as never);
          }}
        />
        <Pressable
          onPress={() => {
            completeCountryGate(selected);
            router.push({ pathname: "/login", params: { mode: "login" } } as never);
          }}
          style={styles.linkBtn}
        >
          <Text style={styles.link}>{locale === "ar" ? "تسجيل الدخول" : "Sign in"}</Text>
        </Pressable>
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
  hint: { color: BRAND.muted, fontSize: 12, textAlign: "right" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BRAND.white,
  },
  chipOn: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF8D6" },
  chipText: { color: BRAND.black, fontSize: 13, fontWeight: "800" },
  linkBtn: { alignItems: "center", paddingVertical: 10 },
  link: {
    color: BRAND.yellowDark,
    fontSize: 15,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
});
