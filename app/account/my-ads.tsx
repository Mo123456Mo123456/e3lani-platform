import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, OutlineButton, PrimaryButton, ScreenTitle, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { centralAdToClientAd } from "@/lib/central-data-adapter";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function MyAds() {
  const { locale, isRTL, t } = useI18n();
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const adsQuery = trpc.data.ads.mine.useQuery(
    { limit: 100 },
    { enabled: Boolean(sessionQuery.data), retry: 1 },
  );
  const data = (adsQuery.data ?? []).map(centralAdToClientAd);

  if (sessionQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle
        title={t("myAds")}
        subtitle={locale === "ar" ? "منشوراتك محفوظة في الحساب المركزي، وليست على هذا الجهاز فقط." : "Your posts are stored centrally in your account, not only on this device."}
      />
      {!sessionQuery.data ? (
        <EmptyState
          icon="lock"
          title={t("signIn")}
          text={t("loginHelp")}
          actionLabel={t("signIn")}
          onAction={() => router.push("/login" as never)}
        />
      ) : adsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      ) : adsQuery.isError ? (
        <EmptyState
          icon="cloud-off"
          title={t("error")}
          text={locale === "ar" ? "تعذر جلب إعلانات الحساب من الخادم." : "Your ads could not be loaded from the server."}
          actionLabel={t("retry")}
          onAction={() => void adsQuery.refetch()}
        />
      ) : data.length ? (
        <FlatList
          data={data}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={item.title}
                onPress={() => router.push({ pathname: "/ad/[id]", params: { id: item.id } } as never)}
                style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
              >
                <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={styles.icon}>
                    <MaterialIcons name="campaign" size={24} color={BRAND.black} />
                  </View>
                  <View style={styles.copy}>
                    <Text numberOfLines={2} style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.id, { textAlign: isRTL ? "right" : "left" }]}>
                      {item.id} · v{item.revision}
                    </Text>
                  </View>
                  <MaterialIcons name={isRTL ? "arrow-back-ios" : "arrow-forward-ios"} size={18} color={BRAND.muted} />
                </View>
                <View style={styles.statusRow}>
                  <StatusBadge status={item.status} />
                </View>
                <View style={[styles.metrics, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Metric icon="visibility" value={item.metrics?.views ?? 0} label={t("views")} />
                  <Metric icon="bookmark" value={item.metrics?.saves ?? 0} label={t("saved")} />
                  <Metric icon="share" value={item.metrics?.shares ?? 0} label={t("share")} />
                </View>
              </Pressable>

              <View style={styles.actions}>
                <OutlineButton
                  label={locale === "ar" ? "عرض التفاصيل" : "View details"}
                  icon="visibility"
                  onPress={() => router.push({ pathname: "/ad/[id]", params: { id: item.id } } as never)}
                />
                <PrimaryButton
                  label={locale === "ar" ? "روّج في الرئيسية" : "Promote in home"}
                  icon="rocket-launch"
                  tone="dark"
                  disabled={item.status !== "active"}
                  onPress={() => router.push({ pathname: "/promote/[id]", params: { id: item.id } } as never)}
                />
              </View>

              {item.status !== "active" ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    {locale === "ar"
                      ? "يتاح الترويج فقط بعد قبول الإعلان وتفعيله. لا يتم إنشاء طلب أو دفع قبل ذلك."
                      : "Promotion is available only after the ad is approved and activated. No order or payment is created before that."}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        />
      ) : (
        <EmptyState
          icon="campaign"
          title={t("noAds")}
          text={t("mediaHelp")}
          actionLabel={t("create")}
          onAction={() => router.push("/create-ad" as never)}
        />
      )}
      {sessionQuery.data ? (
        <View style={styles.createButton}>
          <PrimaryButton label={t("createAd")} icon="add" onPress={() => router.push("/create-ad" as never)} />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function Metric({ icon, value, label }: { icon: keyof typeof MaterialIcons.glyphMap; value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.metric}>
      <MaterialIcons name={icon} size={17} color={BRAND.black} />
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center" },
  list: { paddingTop: 16, paddingBottom: 110 },
  card: { marginBottom: 11, borderWidth: 1, borderColor: BRAND.border, borderRadius: 20, padding: 12, backgroundColor: BRAND.white },
  cardMain: { padding: 4 },
  pressed: { opacity: 0.7 },
  row: { alignItems: "center", gap: 11 },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900" },
  id: { marginTop: 4, color: BRAND.muted, fontSize: 11, lineHeight: 16 },
  statusRow: { marginTop: 12, alignItems: "flex-start" },
  metrics: { marginTop: 13, gap: 12 },
  metric: { minHeight: 36, paddingHorizontal: 10, borderRadius: 12, backgroundColor: BRAND.surface, flexDirection: "row", alignItems: "center", gap: 5 },
  metricValue: { color: BRAND.black, fontSize: 11, fontWeight: "900" },
  actions: { marginTop: 12, gap: 8 },
  notice: { marginTop: 10, borderRadius: 14, padding: 11, backgroundColor: "#FFF8D6" },
  noticeText: { color: BRAND.charcoal, fontSize: 10, lineHeight: 17, textAlign: "right" },
  createButton: { position: "absolute", left: 16, right: 16, bottom: 14 },
});
