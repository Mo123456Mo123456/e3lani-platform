import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { guessCountryFromPhone } from "@/lib/countries";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { useCountries } from "@/lib/use-countries";

export default function Login() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const purpose = params.mode === "register" ? "register_advertiser" : "login";
  const { login, setAccountCountry, accountCountry } = useE3lani();
  const { countries, fromDatabase } = useCountries();
  const { locale, isRTL, t } = useI18n();
  const [phone, setPhone] = useState("+966");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [countryCode, setCountryCode] = useState(accountCountry || "SA");
  const [acceptedPolicy, setAcceptedPolicy] = useState(purpose === "login");
  const [sandboxHint, setSandboxHint] = useState<string | undefined>();

  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();

  const suggested = useMemo(
    () => guessCountryFromPhone(phone, countries),
    [phone, countries],
  );

  const sendCode = async () => {
    if (purpose === "register_advertiser" && !acceptedPolicy) {
      return Alert.alert(
        locale === "ar" ? "الموافقة مطلوبة" : "Acceptance required",
        locale === "ar"
          ? "وافق على سياسة المحتوى والإعلانات الممنوعة للمتابعة."
          : "Accept the prohibited content policy to continue.",
      );
    }
    try {
      const result = await requestOtp.mutateAsync({ phone, purpose });
      setSandboxHint(result.sandboxCode);
      setSent(true);
      setAccountCountry(countryCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP_FAILED";
      if (message.includes("Database") || message.includes("OTP_")) {
        Alert.alert(
          locale === "ar" ? "تعذر إرسال الرمز" : "Could not send code",
          locale === "ar"
            ? "يلزم اتصال الخادم وقاعدة البيانات لإرسال رمز التحقق. لا يُستخدم مستخدم محلي وهمي في الإنتاج."
            : "Server and database are required to send OTP. Production never uses a fake local user.",
        );
        return;
      }
      Alert.alert(t("error"), message);
    }
  };

  const verify = async () => {
    try {
      const result = await verifyOtp.mutateAsync({
        phone,
        code,
        purpose,
        countryCode,
        clientType: "web",
      });
      if (result.token) await Auth.setSessionToken(result.token);
      setAccountCountry(countryCode);
      login({
        id: String(result.user?.id ?? ""),
        name: result.user?.name ?? undefined,
        phone,
        countryCode: result.user?.countryCode ?? countryCode,
        accountType: result.user?.accountType ?? "advertiser",
        role: result.user?.role ?? "user",
      });
      router.replace("/(tabs)/profile" as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP_INVALID";
      Alert.alert(
        locale === "ar" ? "رمز غير صحيح" : "Invalid code",
        message === "OTP_INVALID"
          ? locale === "ar"
            ? "تحقق من الرمز أو اطلب رمزًا جديدًا."
            : "Check the code or request a new one."
          : message,
      );
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialIcons
            name={isRTL ? "arrow-forward" : "arrow-back"}
            size={26}
            color={BRAND.black}
          />
        </Pressable>
        <Text style={styles.headerTitle}>
          {purpose === "register_advertiser"
            ? locale === "ar"
              ? "حساب معلن"
              : "Advertiser account"
            : t("signIn")}
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.lock}>
          <MaterialIcons name="lock" size={39} color={BRAND.black} />
        </View>
        <Text style={styles.title}>
          {purpose === "register_advertiser"
            ? locale === "ar"
              ? "إنشاء حساب معلن"
              : "Create advertiser account"
            : t("signIn")}
        </Text>
        <Text style={styles.help}>
          {sent
            ? locale === "ar"
              ? "أدخل رمز التحقق المرسل إلى جوالك."
              : "Enter the verification code sent to your phone."
            : locale === "ar"
              ? "اختر دولتك ثم اطلب رمز التحقق من الخادم."
              : "Choose your country, then request a server OTP."}
        </Text>
        {!fromDatabase ? (
          <Text style={styles.hint}>
            {locale === "ar"
              ? "قائمة الدول الاحتياطية — المصدر الإنتاجي هو قاعدة البيانات."
              : "Fallback country list — production source is the database."}
          </Text>
        ) : null}

        {!sent ? (
          <>
            <View style={styles.countries}>
              {countries.map((country) => {
                const selected = countryCode === country.code;
                return (
                  <Pressable
                    key={country.code}
                    onPress={() => {
                      setCountryCode(country.code);
                      setPhone(country.dialCode);
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
            <Text style={styles.hint}>
              {locale === "ar" ? `مقترح: ${suggested}` : `Suggested: ${suggested}`}
            </Text>
            <Field
              label={t("phoneNumber")}
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setCountryCode(guessCountryFromPhone(value, countries));
              }}
              keyboardType="phone-pad"
            />
            {purpose === "register_advertiser" ? (
              <>
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
              </>
            ) : null}
            <PrimaryButton
              label={locale === "ar" ? "إرسال رمز التحقق" : "Send verification code"}
              icon="sms"
              disabled={phone.length < 8 || requestOtp.isPending}
              onPress={() => void sendCode()}
            />
          </>
        ) : (
          <>
            {sandboxHint ? (
              <Text style={styles.sandbox}>
                {locale === "ar"
                  ? `Sandbox فقط: رمز الاختبار ${sandboxHint}`
                  : `Sandbox only: test code ${sandboxHint}`}
              </Text>
            ) : null}
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
              disabled={code.length < 4 || verifyOtp.isPending}
              onPress={() => void verify()}
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
    fontSize: 26,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  help: { color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  hint: { color: BRAND.muted, fontSize: 12, textAlign: "right" },
  sandbox: {
    color: BRAND.warning,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
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
  policyRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
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
