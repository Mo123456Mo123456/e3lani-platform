import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { ACCOUNT_COUNTRIES, guessCountryFromPhone } from "@/lib/countries";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Login() {
  const { login, setAccountCountry } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const [phone, setPhone] = useState("+966");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  const suggested = useMemo(() => guessCountryFromPhone(phone), [phone]);

  const verify = () => {
    if (!acceptedPolicy) {
      return Alert.alert(
        locale === "ar" ? "الموافقة مطلوبة" : "Acceptance required",
        locale === "ar"
          ? "وافق على سياسة المحتوى والإعلانات الممنوعة للمتابعة."
          : "Accept the prohibited content policy to continue.",
      );
    }
    if (code !== "123456") {
      return Alert.alert(
        locale === "ar" ? "رمز غير صحيح" : "Invalid code",
        locale === "ar" ? "استخدم 123456 في وضع الاختبار." : "Use 123456 in sandbox mode.",
      );
    }
    setAccountCountry(countryCode);
    login({ phone, countryCode });
    router.replace("/(tabs)/profile" as never);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === "ar" ? "رجوع" : "Back"}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialIcons
            accessible={false}
            name={isRTL ? "arrow-forward" : "arrow-back"}
            size={26}
            color={BRAND.black}
          />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {t("signIn")}
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <View accessible={false} style={styles.lock}>
          <MaterialIcons accessible={false} name="lock" size={39} color={BRAND.black} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t("signIn")}
        </Text>
        <Text style={styles.help}>
          {sent
            ? locale === "ar"
              ? "أدخل الرمز المرسل. رمز الاختبار: 123456"
              : "Enter the code. Sandbox code: 123456"
            : locale === "ar"
              ? "اختر دولتك (تنظيمية فقط) ثم سجّل الدخول. الموجز يبقى عالميًا."
              : "Choose your country (organizational only), then sign in. The feed stays global."}
        </Text>

        {!sent ? (
          <>
            <Text style={styles.section}>
              {locale === "ar" ? "دولة الحساب" : "Account country"}
            </Text>
            <Text style={styles.hint}>
              {locale === "ar"
                ? `مقترح حسب الرقم: ${ACCOUNT_COUNTRIES.find((c) => c.code === suggested)?.flag ?? ""} ${suggested}`
                : `Suggested from phone: ${ACCOUNT_COUNTRIES.find((c) => c.code === suggested)?.flag ?? ""} ${suggested}`}
            </Text>
            <View style={styles.countries}>
              {ACCOUNT_COUNTRIES.map((country) => {
                const selected = countryCode === country.code;
                return (
                  <Pressable
                    key={country.code}
                    onPress={() => {
                      setCountryCode(country.code);
                      setPhone((current) =>
                        current.startsWith("+") ? country.dialCode : current,
                      );
                    }}
                    style={[styles.countryChip, selected && styles.countryChipOn]}
                  >
                    <Text style={styles.countryText}>
                      {country.flag} {locale === "ar" ? country.nameAr : country.nameEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label={t("phoneNumber")}
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setCountryCode(guessCountryFromPhone(value));
              }}
              keyboardType="phone-pad"
            />
            <Pressable
              onPress={() => setAcceptedPolicy((value) => !value)}
              style={styles.policyRow}
            >
              <MaterialIcons
                name={acceptedPolicy ? "check-box" : "check-box-outline-blank"}
                size={22}
                color={BRAND.black}
              />
              <Text style={styles.policyText}>
                {locale === "ar"
                  ? "أوافق على سياسة المحتوى والإعلانات الممنوعة"
                  : "I accept the prohibited content & ads policy"}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push("/policies/prohibited" as never)}>
              <Text style={styles.policyLink}>
                {locale === "ar" ? "عرض التفاصيل" : "View details"}
              </Text>
            </Pressable>
            <PrimaryButton
              label={locale === "ar" ? "إرسال رمز التحقق" : "Send verification code"}
              icon="sms"
              disabled={phone.length < 8 || !acceptedPolicy}
              onPress={() => setSent(true)}
            />
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              {ACCOUNT_COUNTRIES.find((c) => c.code === countryCode)?.flag}{" "}
              {locale === "ar"
                ? ACCOUNT_COUNTRIES.find((c) => c.code === countryCode)?.nameAr
                : ACCOUNT_COUNTRIES.find((c) => c.code === countryCode)?.nameEn}
            </Text>
            <Field
              label={locale === "ar" ? "رمز التحقق" : "Verification code"}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <PrimaryButton
              label={t("signIn")}
              icon="login"
              disabled={code.length !== 6}
              onPress={verify}
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  headerTitle: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  page: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  lock: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: BRAND.yellow,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: BRAND.black,
    fontSize: 29,
    lineHeight: 39,
    fontWeight: "900",
    textAlign: "center",
  },
  help: { color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  section: {
    color: BRAND.black,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  hint: { color: BRAND.muted, fontSize: 12, textAlign: "right" },
  countries: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  countryChip: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BRAND.white,
  },
  countryChipOn: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF8D6" },
  countryText: { color: BRAND.black, fontSize: 13, fontWeight: "800" },
  policyRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  policyText: {
    flex: 1,
    color: BRAND.black,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "right",
  },
  policyLink: {
    color: BRAND.yellowDark,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    textDecorationLine: "underline",
  },
});
