import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function PromoteInHome() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { locale, isRTL, t } = useI18n();
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const detailQuery = trpc.data.ads.detail.useQuery(
    { publicAdId: id },
    { enabled: Boolean(id) && Boolean(sessionQuery.data), retry: 1 },
  );
  const productData = trpc.product.config.useQuery(undefined, { retry: 1 });

  if (sessionQuery.isLoading || detailQuery.isLoading || productData.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  const ad = detailQuery.data;
  const ownsAd = Boolean(ad && sessionQuery.data && ad.ownerId === String(sessionQuery.data.id));

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === "ar" ? "رجوع" : "Back"} onPress={() => router.back()} style={styles.back}>
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={26} color={BRAND.black} />
        </Pressable>
        <Text style={styles.headerTitle}>{locale === "ar" ? "روّج في الرئيسية" : "Promote in home"}</Text>
        <View style={styles.back} />
      </View>

      {!sessionQuery.data ? (
        <View style={styles.center}>
          <MaterialIcons name="lock" size={46} color={BRAND.yellowDark} />
          <Text style={styles.title}>{t("signIn")}</Text>
          <PrimaryButton label={t("signIn")} icon="login" onPress={() => router.replace("/login" as never)} />
        </View>
      ) : detailQuery.isError || !ad ? (
        <View style={styles.center}>
          <MaterialIcons name="cloud-off" size={46} color={BRAND.error} />
          <Text style={styles.title}>{t("error")}</Text>
          <PrimaryButton label={t("retry")} icon="refresh" onPress={() => void detailQuery.refetch()} />
        </View>
      ) : !ownsAd ? (
        <View style={styles.center}>
          <MaterialIcons name="gpp-bad" size={46} color={BRAND.error} />
          <Text style={styles.title}>{locale === "ar" ? "لا تملك هذا الإعلان" : "You do not own this ad"}</Text>
          <Text style={styles.help}>{locale === "ar" ? "الترويج متاح لصاحب الإعلان فقط." : "Promotion is available only to the ad owner."}</Text>
        </View>
      ) : (
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={styles.rocket}>
              <MaterialIcons name="rocket-launch" size={42} color={BRAND.black} />
            </View>
            <Text style={styles.title}>{locale === "ar" ? "روّج إعلانك في الرئيسية" : "Promote your ad in home"}</Text>
            <Text style={styles.help}>{ad.title}</Text>
            <View style={styles.status}><StatusBadge status={ad.status} /></View>
          </View>

          <View style={styles.infoCard}>
            <MaterialIcons name="payments" size={27} color={BRAND.yellow} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>
                {locale === "ar" ? "الدفع والترويج غير مفعّلين حاليًا" : "Payment and promotion are currently disabled"}
              </Text>
              <Text style={styles.infoText}>
                {locale === "ar"
                  ? "لن يظهر سعر، ولن يُنشأ طلب أو دفع تجريبي. هذه الشاشة نقطة دخول آمنة للبنية المستقبلية فقط، وسيُفعّل المنتج بعد اعتماد سعره وربط مزود دفع إنتاجي والتحقق من الدفع في الخادم."
                  : "No price is shown and no sandbox order or payment is created. This screen is only a safe entry point for the future structure. The product will be enabled after its price is approved, a production provider is connected, and payment is verified server-side."}
              </Text>
            </View>
          </View>

          <View style={styles.checklist}>
            <Check label={locale === "ar" ? "الإعلان مملوك للحساب الحالي" : "The ad belongs to the current account"} ready={ownsAd} />
            <Check label={locale === "ar" ? "الإعلان نشط" : "The ad is active"} ready={ad.status === "active"} />
            <Check label={locale === "ar" ? "مزود دفع إنتاجي" : "Production payment provider"} ready={Boolean(productData.data?.paymentEnabled)} />
            <Check label={locale === "ar" ? "سعر ترويج الرئيسية معتمد" : "Approved home promotion price"} ready={false} />
          </View>

          <PrimaryButton
            label={locale === "ar" ? "الترويج غير متاح الآن" : "Promotion is unavailable now"}
            icon="lock"
            disabled
            onPress={() => undefined}
          />
          <PrimaryButton
            label={t("myAds")}
            icon="campaign"
            tone="dark"
            onPress={() => router.replace("/account/my-ads" as never)}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

function Check({ label, ready }: { label: string; ready: boolean }) {
  return (
    <View style={styles.check}>
      <MaterialIcons name={ready ? "check-circle" : "radio-button-unchecked"} size={21} color={ready ? BRAND.success : BRAND.muted} />
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: BRAND.border, alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 17, fontWeight: "900" },
  center: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  page: { flex: 1, width: "100%", maxWidth: 620, alignSelf: "center", padding: 20, justifyContent: "center", gap: 14 },
  hero: { alignItems: "center" },
  rocket: { width: 82, height: 82, borderRadius: 27, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 12, color: BRAND.black, fontSize: 23, lineHeight: 32, fontWeight: "900", textAlign: "center" },
  help: { marginTop: 5, color: BRAND.muted, fontSize: 13, lineHeight: 21, textAlign: "center" },
  status: { marginTop: 10 },
  infoCard: { padding: 17, borderRadius: 20, backgroundColor: BRAND.black, flexDirection: "row-reverse", alignItems: "flex-start", gap: 11 },
  infoCopy: { flex: 1 },
  infoTitle: { color: BRAND.white, fontSize: 15, lineHeight: 22, fontWeight: "900", textAlign: "right" },
  infoText: { marginTop: 5, color: "#DADADA", fontSize: 12, lineHeight: 20, textAlign: "right" },
  checklist: { padding: 15, borderWidth: 1, borderColor: BRAND.border, borderRadius: 18, gap: 10, backgroundColor: BRAND.surface },
  check: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  checkText: { flex: 1, color: BRAND.charcoal, fontSize: 12, lineHeight: 19, textAlign: "right" },
});
