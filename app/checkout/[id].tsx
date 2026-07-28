import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";
import {
  requiresPaymentForPublishing,
  resolveFeedAccessMode,
} from "@/shared/feed-access";

export default function Checkout() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const store = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const ad = store.ads.find((item) => item.id === id);

  if (!ad) {
    return <ScreenContainer><View accessible accessibilityRole="alert" style={styles.center}><Text>{t("noAds")}</Text></View></ScreenContainer>;
  }

  if (productData.isLoading) {
    return <ScreenContainer><View style={styles.center}><ActivityIndicator color={BRAND.yellowDark} size="large" /></View></ScreenContainer>;
  }

  if (productData.isError || !productData.config) {
    return (
      <ScreenContainer>
        <View accessible accessibilityRole="alert" style={styles.center}>
          <MaterialIcons name="cloud-off" size={40} color={BRAND.error} />
          <Text style={styles.errorText}>{locale === "ar" ? "تعذر تحميل إعدادات النشر" : "Publishing settings could not be loaded"}</Text>
          <PrimaryButton label={t("retry")} icon="refresh" onPress={productData.retry} />
        </View>
      </ScreenContainer>
    );
  }

  const feedAccessMode = resolveFeedAccessMode(productData.config.feedAccessMode);
  const publishingRequiresPayment = requiresPaymentForPublishing(feedAccessMode);

  if (!publishingRequiresPayment) {
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
          <Text accessibilityRole="header" style={styles.headerTitle}>{locale === "ar" ? "النشر المجاني" : "Free publishing"}</Text>
          <View style={styles.back} />
        </View>
        <View accessible accessibilityRole="alert" style={styles.freeState}>
          <View style={styles.freeIcon}>
            <MaterialIcons name="check-circle" size={48} color={BRAND.black} />
          </View>
          <Text accessibilityRole="header" style={styles.freeTitle}>{locale === "ar" ? "لا توجد خطوة دفع" : "No payment step"}</Text>
          <Text style={styles.freeText}>{locale === "ar" ? "النشر مجاني حاليًا، ولا يظهر سعر ولا تُنشأ عملية دفع تجريبية. إعلانك ينتقل مباشرة إلى المراجعة." : "Publishing is currently free. No price is shown and no sandbox payment is created. Your ad goes directly to review."}</Text>
          <StatusBadge status={ad.status} />
          <PrimaryButton label={t("myAds")} icon="campaign" onPress={() => router.replace("/account/my-ads" as never)} />
        </View>
      </ScreenContainer>
    );
  }

  const quote = productData.calculateQuote(ad.promotions);
  const promotionByCode = new Map(productData.promotions.map((promotion) => [promotion.code, promotion]));
  const productionPaymentReady = productData.config.paymentEnabled && productData.config.paymentMode === "production";

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
        <View style={styles.hero}>
          <MaterialIcons accessible={false} name="verified-user" size={39} color={BRAND.yellow} />
          <Text accessibilityRole="header" style={styles.heroTitle}>{t("payment")}</Text>
          <Text style={styles.heroText}>{locale === "ar" ? "لا يُفعّل أي توزيع مدفوع قبل تحقق الخادم من مزود دفع إنتاجي وموافقة المراجع." : "Paid distribution is never activated before server verification by a production provider and reviewer approval."}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.section}>{locale === "ar" ? "ملخص الطلب" : "Order summary"}</Text>
        <View accessible accessibilityLabel={`${t("total")}: ${(quote.totalHalalas / 100).toFixed(2)} ${t("sar")}. ${t("vatIncluded")}: ${(quote.vatHalalas / 100).toFixed(2)} ${t("sar")}`} style={styles.summary}>
          <View style={styles.line}><Text style={styles.lineLabel}>{t("basePrice")}</Text><Text style={styles.lineValue}>{(productData.config.finalBasePriceHalalas / 100).toFixed(2)} {t("sar")}</Text></View>
          {ad.promotions.map((promotion) => {
            const definition = promotionByCode.get(promotion);
            if (!definition) return null;
            return <View key={promotion} style={styles.line}><Text style={styles.lineLabel}>{locale === "ar" ? definition.ar : definition.en}</Text><Text style={styles.lineValue}>+ {(definition.priceHalalas / 100).toFixed(2)} {t("sar")}</Text></View>;
          })}
          <View style={styles.divider} />
          <View style={styles.line}><Text style={styles.total}>{t("total")}</Text><Text style={styles.total}>{(quote.totalHalalas / 100).toFixed(2)} {t("sar")}</Text></View>
          <Text style={styles.vat}>{t("vatIncluded")}: {(quote.vatHalalas / 100).toFixed(2)} {t("sar")}</Text>
        </View>
        <View accessible accessibilityRole="alert" style={styles.unavailable}>
          <MaterialIcons accessible={false} name={productionPaymentReady ? "hourglass-top" : "payments"} size={23} color={BRAND.white} />
          <Text style={styles.unavailableText}>{locale === "ar" ? "الدفع الحقيقي غير متاح حالياً. لن تُحصّل أي رسوم ولن يُنشأ دفع تجريبي." : "Real payment is currently unavailable. No charge or sandbox payment will be created."}</Text>
        </View>
        <StatusBadge status="draft" />
        <PrimaryButton label={t("myAds")} icon="campaign" onPress={() => router.replace("/account/my-ads" as never)} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { color: BRAND.black, fontSize: 16, lineHeight: 24, fontWeight: "800", textAlign: "center" },
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
  unavailable: { minHeight: 58, borderRadius: 17, paddingHorizontal: 14, backgroundColor: BRAND.warning, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  unavailableText: { flex: 1, color: BRAND.white, fontSize: 12, lineHeight: 19, fontWeight: "800", textAlign: "right" },
  freeState: { flex: 1, minHeight: 560, padding: 26, alignItems: "center", justifyContent: "center", gap: 16 },
  freeIcon: { width: 92, height: 92, borderRadius: 30, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  freeTitle: { color: BRAND.black, fontSize: 25, lineHeight: 34, fontWeight: "900", textAlign: "center" },
  freeText: { maxWidth: 480, color: BRAND.muted, fontSize: 14, lineHeight: 23, textAlign: "center" },
});
