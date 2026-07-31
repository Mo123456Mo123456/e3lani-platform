import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, isPaymentFlowVisible } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Create() {
  const { user, launchMode } = useE3lani();
  const { t, locale } = useI18n();
  const productData = useProductData();
  const paymentVisible = isPaymentFlowVisible(
    launchMode,
    Boolean(productData.config?.paymentEnabled),
  );

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
            <Text style={styles.noticeTitle}>{t("freePublish")}</Text>
            <Text style={styles.noticeText}>{t("freePublishHelp")}</Text>
          </View>
        </View>

        <Text style={styles.text}>
          {t("mediaHelp")}
          {paymentVisible
            ? `\n${t("basePrice")}: 59 ${t("sar")}`
            : locale === "ar"
              ? "\nلا توجد شاشة دفع في وضع الإطلاق المجاني."
              : "\nNo payment screen in free-launch mode."}
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
  text: {
    marginTop: 12,
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  button: { width: "100%", maxWidth: 420, marginTop: 24 },
});
