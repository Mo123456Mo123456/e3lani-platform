import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, promotionPrices } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const promotionLabels = {
  highlight_3: "highlight3",
  highlight_7: "highlight7",
  top_category: "topCategory",
  city_targeting: "cityTargeting",
} as const;

export default function Checkout() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const store = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const [paid, setPaid] = useState(false);
  const ad = store.ads.find((item) => item.id === id);
  const totalHalalas = 5900 + (ad?.promotions ?? []).reduce((sum, promotion) => sum + promotionPrices[promotion], 0);
  const vatHalalas = Math.round((totalHalalas * 15) / 115);
  const channel = Platform.OS === "ios" ? "App Store" : Platform.OS === "android" ? "Google Play" : locale === "ar" ? "دفع ويب مستضاف" : "Hosted web payment";

  if (!ad) {
    return <ScreenContainer><View accessible accessibilityRole="alert" style={styles.center}><Text>{t("noAds")}</Text></View></ScreenContainer>;
  }

  const pay = () => {
    store.checkoutSandbox(ad.id, ad.promotions);
    setPaid(true);
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
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("payment")}</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.page}>
        {paid ? (
          <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.success}>
            <View accessible={false} style={styles.successIcon}>
              <MaterialIcons accessible={false} name="check" size={46} color={BRAND.white} />
            </View>
            <Text accessibilityRole="header" style={styles.successTitle}>{locale === "ar" ? "تم تأكيد الدفع التجريبي" : "Sandbox payment confirmed"}</Text>
            <Text style={styles.successText}>{locale === "ar" ? "أُرسل الإعلان إلى المراجعة، ولن يبدأ عداد 30 يومًا قبل القبول والتفعيل." : "The ad was sent to review. The 30-day timer starts after approval and activation."}</Text>
            <StatusBadge status="pending_review" />
            <PrimaryButton label={t("myAds")} icon="campaign" onPress={() => router.replace("/account/my-ads" as never)} />
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <MaterialIcons accessible={false} name="verified-user" size={39} color={BRAND.yellow} />
              <Text accessibilityRole="header" style={styles.heroTitle}>{t("payment")}</Text>
              <Text style={styles.heroText}>{locale === "ar" ? "لا يُنشر الإعلان قبل تحقق الدفع وموافقة المراجع." : "The ad is not published until payment is verified and review is approved."}</Text>
            </View>
            <Text accessibilityRole="header" style={styles.section}>{locale === "ar" ? "ملخص الطلب" : "Order summary"}</Text>
            <View accessible accessibilityLabel={`${t("total")}: ${(totalHalalas / 100).toFixed(2)} ${t("sar")}. ${t("vatIncluded")}: ${(vatHalalas / 100).toFixed(2)} ${t("sar")}`} style={styles.summary}>
              <View style={styles.line}><Text style={styles.lineLabel}>{t("basePrice")}</Text><Text style={styles.lineValue}>59.00 {t("sar")}</Text></View>
              {ad.promotions.map((promotion) => <View key={promotion} style={styles.line}><Text style={styles.lineLabel}>{t(promotionLabels[promotion])}</Text><Text style={styles.lineValue}>+ {(promotionPrices[promotion] / 100).toFixed(2)} {t("sar")}</Text></View>)}
              <View style={styles.divider} />
              <View style={styles.line}><Text style={styles.total}>{t("total")}</Text><Text style={styles.total}>{(totalHalalas / 100).toFixed(2)} {t("sar")}</Text></View>
              <Text style={styles.vat}>{t("vatIncluded")}: {(vatHalalas / 100).toFixed(2)} {t("sar")}</Text>
            </View>
            <Text accessibilityRole="header" style={styles.section}>{locale === "ar" ? "قناة الدفع" : "Payment channel"}</Text>
            <View accessible accessibilityLabel={`${locale === "ar" ? "قناة الدفع" : "Payment channel"}: ${channel}`} style={styles.channel}><MaterialIcons accessible={false} name={Platform.OS === "web" ? "language" : "phone-iphone"} size={26} color={BRAND.black} /><Text style={styles.channelText}>{channel}</Text></View>
            <View accessible accessibilityRole="alert" style={styles.sandbox}><MaterialIcons accessible={false} name="science" size={23} color={BRAND.white} /><Text style={styles.sandboxText}>{t("sandbox")}</Text></View>
            <PrimaryButton label={locale === "ar" ? "إتمام دفع تجريبي" : "Complete sandbox payment"} icon="payments" onPress={pay} />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  headerTitle: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  page: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 18, paddingBottom: 40, gap: 14 },
  hero: { borderRadius: 23, padding: 22, backgroundColor: BRAND.black, alignItems: "center" },
  heroTitle: { marginTop: 9, color: BRAND.white, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  heroText: { marginTop: 6, color: "#D8D8D8", fontSize: 13, lineHeight: 21, textAlign: "center" },
  section: { marginTop: 9, color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900", textAlign: "right" },
  summary: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 20, padding: 17, gap: 11, backgroundColor: BRAND.surface },
  line: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 12 },
  lineLabel: { flex: 1, color: BRAND.black, fontSize: 13, lineHeight: 19, textAlign: "right" },
  lineValue: { color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  divider: { height: 1, backgroundColor: BRAND.border },
  total: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  vat: { color: BRAND.muted, fontSize: 10, lineHeight: 16, textAlign: "right" },
  channel: { minHeight: 66, borderWidth: 1, borderColor: BRAND.yellowDark, borderRadius: 18, paddingHorizontal: 15, backgroundColor: "#FFF9E4", flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  channelText: { flex: 1, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "right" },
  sandbox: { minHeight: 54, borderRadius: 17, paddingHorizontal: 14, backgroundColor: BRAND.warning, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  sandboxText: { flex: 1, color: BRAND.white, fontSize: 12, lineHeight: 18, fontWeight: "800", textAlign: "right" },
  success: { flex: 1, minHeight: 570, alignItems: "center", justifyContent: "center", gap: 16 },
  successIcon: { width: 88, height: 88, borderRadius: 30, backgroundColor: BRAND.success, alignItems: "center", justifyContent: "center" },
  successTitle: { color: BRAND.black, fontSize: 25, lineHeight: 34, fontWeight: "900", textAlign: "center" },
  successText: { color: BRAND.muted, fontSize: 14, lineHeight: 23, textAlign: "center" },
});
