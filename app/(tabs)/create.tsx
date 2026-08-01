import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { shouldShowPaymentUi } from "@/lib/launch-policy";
import { useI18n } from "@/lib/i18n";

export default function Create() {
  const { user, launchPolicy } = useE3lani();
  const { t, locale } = useI18n();
  const paymentVisible = shouldShowPaymentUi(launchPolicy);

  return (
    <ScreenContainer className="px-6">
      <View style={styles.center}>
        <View style={styles.icon}>
          <MaterialIcons name="add-photo-alternate" size={46} color={BRAND.black} />
        </View>
        <Text style={styles.title}>{t("postTitle")}</Text>

        <View style={styles.notice}>
          <MaterialIcons name="check-circle" size={20} color={BRAND.yellowDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>
              {locale === "ar" ? launchPolicy.bannerMessageAr : launchPolicy.bannerMessageEn}
            </Text>
            <Text style={styles.noticeText}>{t("freePublishHelp")}</Text>
          </View>
        </View>

        <View style={styles.policy}>
          <Text style={styles.policyText}>
            {locale === "ar"
              ? "يُمنع نشر المحتوى المخالف للقوانين أو سياسات المنصة. يتحمل المعلن مسؤولية محتواه، وقد يُحذف الإعلان أو يُوقف الحساب عند المخالفة."
              : "Publishing illegal or policy-violating content is prohibited. Advertisers are responsible for their content; ads or accounts may be removed when violations occur."}
          </Text>
          <Pressable onPress={() => router.push("/policies/prohibited" as never)}>
            <Text style={styles.policyLink}>
              {locale === "ar" ? "المحتوى والإعلانات الممنوعة" : "Prohibited content & ads"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.text}>
          {t("mediaHelp")}
          {paymentVisible
            ? `\n${locale === "ar" ? "السعر يُحسب من إعدادات الإدارة على الخادم." : "Price is calculated from admin settings on the server."}`
            : locale === "ar"
              ? "\nيُنشر الإعلان مباشرة دون انتظار موافقة بشرية."
              : "\nAds publish instantly without waiting for human approval."}
        </Text>

        <View style={styles.button}>
          <PrimaryButton
            label={user ? t("publishNow") : t("signIn")}
            icon={user ? "campaign" : "login"}
            onPress={() => router.push((user ? "/create-ad" : "/login") as never)}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 60,
  },
  icon: {
    width: 90,
    height: 90,
    borderRadius: 29,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 22,
    color: BRAND.black,
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "900",
    textAlign: "center",
  },
  notice: {
    marginTop: 18,
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: "#f0d45e",
    borderRadius: 16,
    backgroundColor: "#fff7d2",
  },
  noticeTitle: { color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" },
  noticeText: { marginTop: 4, color: BRAND.black, fontSize: 12, lineHeight: 18, textAlign: "right" },
  policy: {
    marginTop: 12,
    width: "100%",
    maxWidth: 420,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
    gap: 8,
  },
  policyText: { color: BRAND.black, fontSize: 11, lineHeight: 17, textAlign: "right" },
  policyLink: {
    color: BRAND.yellowDark,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
    textDecorationLine: "underline",
  },
  text: {
    marginTop: 12,
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  button: { width: "100%", maxWidth: 420, marginTop: 24 },
});
