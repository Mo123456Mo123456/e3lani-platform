import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { APP_ID, OAUTH_PORTAL_URL, startOAuthLogin } from "@/constants/oauth";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const { locale, isRTL, t } = useI18n();
  const [opening, setOpening] = useState(false);
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (sessionQuery.data) {
      router.replace("/(tabs)/profile" as never);
    }
  }, [sessionQuery.data]);

  const signIn = async () => {
    if (!OAUTH_PORTAL_URL || !APP_ID) {
      Alert.alert(
        locale === "ar" ? "تسجيل الدخول غير مهيأ" : "Sign-in is not configured",
        locale === "ar"
          ? "يجب ضبط بوابة المصادقة ومعرّف التطبيق في بيئة الخادم قبل تسجيل الدخول الحقيقي."
          : "The authentication portal and application ID must be configured before real sign-in can be used.",
      );
      return;
    }

    setOpening(true);
    try {
      await startOAuthLogin();
    } catch {
      Alert.alert(
        locale === "ar" ? "تعذر فتح تسجيل الدخول" : "Could not open sign-in",
        locale === "ar" ? "تحقق من الاتصال وإعدادات المصادقة." : "Check the connection and authentication settings.",
      );
      setOpening(false);
    }
  };

  if (sessionQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
        </View>
      </ScreenContainer>
    );
  }

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
          <MaterialIcons accessible={false} name="verified-user" size={39} color={BRAND.black} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{t("signIn")}</Text>
        <Text style={styles.help}>
          {locale === "ar"
            ? "استخدم تسجيل الدخول الآمن المرتبط بالخادم. أزلنا رمز الاختبار 123456 لأنه لا ينشئ جلسة حقيقية ولا يجوز استخدامه للنشر."
            : "Use secure server-backed sign-in. The 123456 sandbox code was removed because it does not create a real session and must not be used for publishing."}
        </Text>
        <View style={styles.notice}>
          <MaterialIcons name="sms" size={23} color={BRAND.yellow} />
          <Text style={styles.noticeText}>
            {locale === "ar"
              ? "OTP عبر الجوال ما زال غير مكتمل، وسيُنفذ لاحقًا عبر مزود رسائل حقيقي مع تحديد المحاولات وانتهاء الرمز."
              : "Mobile OTP is not complete yet. It will be implemented with a real SMS provider, attempt limits, and code expiry."}
          </Text>
        </View>
        <PrimaryButton
          label={opening ? (locale === "ar" ? "جارٍ فتح الدخول..." : "Opening sign-in...") : (locale === "ar" ? "الدخول الآمن عبر الخادم" : "Secure server sign-in")}
          icon="login"
          disabled={opening}
          onPress={() => void signIn()}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  headerTitle: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  page: { flex: 1, width: "100%", maxWidth: 500, alignSelf: "center", justifyContent: "center", padding: 24, gap: 16 },
  lock: { width: 78, height: 78, borderRadius: 26, backgroundColor: BRAND.yellow, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  title: { color: BRAND.black, fontSize: 29, lineHeight: 39, fontWeight: "900", textAlign: "center" },
  help: { color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  notice: { padding: 14, borderRadius: 17, backgroundColor: BRAND.black, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  noticeText: { flex: 1, color: BRAND.white, fontSize: 12, lineHeight: 20, textAlign: "right" },
});
