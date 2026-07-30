import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Login() {
  const { login } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const [phone, setPhone] = useState("+966");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");

  const verify = () => {
    if (code !== "123456") {
      return Alert.alert(
        locale === "ar" ? "رمز غير صحيح" : "Invalid code",
        locale === "ar" ? "استخدم 123456 في وضع الاختبار." : "Use 123456 in sandbox mode.",
      );
    }
    login({ phone });
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
          <MaterialIcons accessible={false} name={isRTL ? "arrow-forward" : "arrow-back"} size={26} color={BRAND.black} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("signIn")}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.page}>
        <View accessible={false} style={styles.lock}>
          <MaterialIcons accessible={false} name="lock" size={39} color={BRAND.black} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{t("signIn")}</Text>
        <Text style={styles.help}>
          {sent
            ? locale === "ar"
              ? "أدخل الرمز المرسل. رمز الاختبار: 123456"
              : "Enter the code. Sandbox code: 123456"
            : locale === "ar"
              ? "استخدم رقم جوالك للدخول الآمن."
              : "Use your mobile number to sign in securely."}
        </Text>
        {!sent ? (
          <>
            <Field label={t("phoneNumber")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <PrimaryButton label={locale === "ar" ? "إرسال رمز التحقق" : "Send verification code"} icon="sms" disabled={phone.length < 8} onPress={() => setSent(true)} />
          </>
        ) : (
          <>
            <Field label={locale === "ar" ? "رمز التحقق" : "Verification code"} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            <PrimaryButton label={t("signIn")} icon="login" disabled={code.length !== 6} onPress={verify} />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  headerTitle: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  page: { flex: 1, width: "100%", maxWidth: 500, alignSelf: "center", justifyContent: "center", padding: 24, gap: 16 },
  lock: { width: 78, height: 78, borderRadius: 26, backgroundColor: BRAND.yellow, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  title: { color: BRAND.black, fontSize: 29, lineHeight: 39, fontWeight: "900", textAlign: "center" },
  help: { color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
});
