import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { EmptyState, OutlineButton, PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { createIdempotencyKey, getOrCreateAnonymousId } from "@/lib/analytics-identity";
import { centralAdToClientAd } from "@/lib/central-data-adapter";
import { BRAND, type ContactType } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

const contactUrl = (type: ContactType, value: string) =>
  type === "whatsapp"
    ? `https://wa.me/${value.replace(/\D/g, "")}`
    : type === "phone"
      ? `tel:${value.replace(/[^\d+]/g, "")}`
      : value.startsWith("http")
        ? value
        : `https://${value}`;

const contactEvent = (type: ContactType) =>
  type === "store"
    ? "store_click" as const
    : type === "product"
      ? "product_click" as const
      : type === "whatsapp"
        ? "whatsapp_click" as const
        : "phone_click" as const;

export default function Detail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { locale, isRTL, t } = useI18n();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const anonymousId = useRef("");
  const recordedAdId = useRef("");
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const detailQuery = trpc.data.ads.detail.useQuery(
    { publicAdId: id },
    { enabled: Boolean(id), retry: 1 },
  );
  const favoritesQuery = trpc.data.favorites.list.useQuery(
    { limit: 100 },
    { enabled: Boolean(sessionQuery.data), retry: false },
  );
  const toggleFavoriteMutation = trpc.data.favorites.toggle.useMutation({
    onSuccess: async () => {
      await favoritesQuery.refetch();
    },
  });
  const reportMutation = trpc.data.reports.create.useMutation();
  const eventMutation = trpc.data.events.record.useMutation();
  const eventMutateRef = useRef(eventMutation.mutate);
  eventMutateRef.current = eventMutation.mutate;

  const ad = detailQuery.data ? centralAdToClientAd(detailQuery.data) : null;
  const savedIds = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((item) => item.id)),
    [favoritesQuery.data],
  );
  const saved = ad ? savedIds.has(ad.id) : false;

  useEffect(() => {
    let mounted = true;
    void getOrCreateAnonymousId().then((value) => {
      if (!mounted) return;
      anonymousId.current = value;
      if (id && recordedAdId.current !== id) {
        recordedAdId.current = id;
        eventMutateRef.current({
          publicAdId: id,
          anonymousId: value,
          eventType: "view",
          idempotencyKey: createIdempotencyKey("view", id),
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, [id]);

  const recordEvent = async (
    eventType: "share" | "store_click" | "product_click" | "whatsapp_click" | "phone_click",
  ) => {
    const identity = anonymousId.current || (await getOrCreateAnonymousId());
    anonymousId.current = identity;
    await eventMutation.mutateAsync({
      publicAdId: id,
      anonymousId: identity,
      eventType,
      idempotencyKey: createIdempotencyKey(eventType, id),
    });
  };

  const share = async () => {
    if (!ad) return;
    await recordEvent("share").catch(() => undefined);
    await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
  };

  const contact = async (type: ContactType, value: string) => {
    await recordEvent(contactEvent(type)).catch(() => undefined);
    try {
      await Linking.openURL(contactUrl(type, value));
    } catch {
      Alert.alert(t("error"));
    }
  };

  const toggleSave = async () => {
    if (!ad) return;
    if (!sessionQuery.data) {
      router.push("/login" as never);
      return;
    }
    try {
      await toggleFavoriteMutation.mutateAsync({ publicAdId: ad.id });
    } catch {
      Alert.alert(locale === "ar" ? "تعذر تحديث المحفوظات" : "Could not update saved ads");
    }
  };

  const toggleReportForm = () => {
    if (!sessionQuery.data) {
      router.push("/login" as never);
      return;
    }
    setReportSent(false);
    setReportOpen((current) => !current);
  };

  const submitReport = async (reason: "misleading" | "prohibited") => {
    if (!ad || reportMutation.isPending) return;
    try {
      await reportMutation.mutateAsync({ publicAdId: ad.id, reason });
      setReportOpen(false);
      setReportSent(true);
    } catch {
      Alert.alert(
        locale === "ar" ? "تعذر إرسال البلاغ" : "Report could not be sent",
        locale === "ar" ? "لم يُحفظ البلاغ في الخادم. أعد المحاولة." : "The report was not saved to the server. Please retry.",
      );
    }
  };

  if (detailQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  if (detailQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-off"
          title={t("error")}
          text={locale === "ar" ? "تعذر جلب الإعلان من الخادم." : "The ad could not be loaded from the server."}
          actionLabel={t("retry")}
          onAction={() => void detailQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (!ad || !detailQuery.data) {
    return (
      <ScreenContainer>
        <EmptyState icon="campaign" title={t("noAds")} text={t("emptyHelp")} />
      </ScreenContainer>
    );
  }

  const cityName = locale === "ar" ? detailQuery.data.city.ar : detailQuery.data.city.en;
  const categoryName = locale === "ar" ? detailQuery.data.category.ar : detailQuery.data.category.en;
  const advertiserName = ad.advertiserName ?? (locale === "ar" ? "المعلن" : "Advertiser");
  const publicInteraction = ad.status === "active";

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === "ar" ? "رجوع" : "Back"} onPress={() => router.back()} style={styles.headerIcon}>
          <MaterialIcons
            accessible={false}
            name={isRTL ? "arrow-forward" : "arrow-back"}
            size={26}
            color={BRAND.black}
          />
        </Pressable>
        <Text style={styles.headerTitle}>{t("details")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("share")} onPress={() => void share()} style={styles.headerIcon}>
          <MaterialIcons accessible={false} name="ios-share" size={24} color={BRAND.black} />
        </Pressable>
      </View>

      <FlatList
        data={[ad]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.page}
        renderItem={() => (
          <View style={styles.content}>
            <FlatList
              horizontal
              pagingEnabled
              data={ad.media}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <View style={styles.media}>
                  <MediaView media={item} active={index === 0} />
                </View>
              )}
            />

            <View style={styles.copy}>
              <View style={[styles.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{advertiserName.slice(0, 1)}</Text>
                </View>
                <View style={styles.brandCopy}>
                  <View style={[styles.brandNameRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={styles.brandName}>{advertiserName}</Text>
                    {ad.verified ? (
                      <MaterialIcons name="verified" size={19} color={BRAND.yellowDark} />
                    ) : null}
                  </View>
                  <Text style={styles.muted}>{locale === "ar" ? "المعلن" : "Advertiser"}</Text>
                </View>
              </View>

              <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{ad.title}</Text>
              {ad.description ? (
                <Text style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>
                  {ad.description}
                </Text>
              ) : null}

              <View style={styles.meta}>
                <View style={styles.metaCard}>
                  <MaterialIcons name="location-on" size={22} color={BRAND.yellowDark} />
                  <Text style={styles.muted}>{t("city")}</Text>
                  <Text style={styles.metaValue}>{cityName}</Text>
                </View>
                <View style={styles.metaCard}>
                  <MaterialIcons name="category" size={22} color={BRAND.yellowDark} />
                  <Text style={styles.muted}>{t("category")}</Text>
                  <Text style={styles.metaValue}>{categoryName}</Text>
                </View>
              </View>

              <View style={styles.status}>
                <StatusBadge status={ad.status} />
              </View>

              {publicInteraction
                ? ad.contacts.map((item) => (
                    <View key={`${item.type}-${item.value}`} style={styles.button}>
                      <PrimaryButton
                        label={t(item.type)}
                        icon={
                          item.type === "phone"
                            ? "phone"
                            : item.type === "whatsapp"
                              ? "chat"
                              : item.type === "store"
                                ? "storefront"
                                : "open-in-new"
                        }
                        onPress={() => void contact(item.type, item.value)}
                      />
                    </View>
                  ))
                : null}

              <View style={styles.metrics}>
                <Metric icon="visibility" label={t("views")} value={ad.metrics?.views ?? 0} />
                <Metric icon="bookmark" label={t("saved")} value={ad.metrics?.saves ?? 0} />
                <Metric icon="share" label={t("share")} value={ad.metrics?.shares ?? 0} />
              </View>

              {publicInteraction ? (
                <View style={styles.actions}>
                  <OutlineButton
                    label={saved ? t("savedDone") : t("save")}
                    icon={saved ? "bookmark" : "bookmark-border"}
                    onPress={() => void toggleSave()}
                  />
                  <OutlineButton label={t("report")} icon="flag" onPress={toggleReportForm} />
                </View>
              ) : (
                <View style={styles.ownerNotice}>
                  <Text style={styles.ownerNoticeText}>
                    {locale === "ar"
                      ? "هذا الإعلان ظاهر لك لأنك مالكه، ولن يظهر في الخلاصة العامة قبل الموافقة والتفعيل."
                      : "This ad is visible because you own it. It will not appear in the public feed before approval and activation."}
                  </Text>
                </View>
              )}

              {reportOpen ? (
                <View style={styles.reportCard} accessibilityRole="summary">
                  <Text style={[styles.reportTitle, { textAlign: isRTL ? "right" : "left" }]}>
                    {locale === "ar" ? "ما سبب الإبلاغ؟" : "Why are you reporting this ad?"}
                  </Text>
                  <Text style={[styles.reportSubtitle, { textAlign: isRTL ? "right" : "left" }]}>
                    {locale === "ar"
                      ? "اختر السبب الأنسب، وسيُحفظ البلاغ مركزيًا لفريق المراجعة."
                      : "Choose the best reason. The report will be stored centrally for the review team."}
                  </Text>
                  <View style={styles.reportOptions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={locale === "ar" ? "الإبلاغ عن محتوى مضلل" : "Report misleading content"}
                      disabled={reportMutation.isPending}
                      onPress={() => void submitReport("misleading")}
                      style={({ pressed }) => [styles.reportChoice, pressed && styles.pressed]}
                    >
                      <MaterialIcons accessible={false} name="report-problem" size={21} color={BRAND.error} />
                      <Text style={styles.reportChoiceText}>
                        {locale === "ar" ? "محتوى مضلل" : "Misleading content"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={locale === "ar" ? "الإبلاغ عن محتوى محظور" : "Report prohibited content"}
                      disabled={reportMutation.isPending}
                      onPress={() => void submitReport("prohibited")}
                      style={({ pressed }) => [styles.reportChoice, pressed && styles.pressed]}
                    >
                      <MaterialIcons accessible={false} name="gpp-bad" size={21} color={BRAND.error} />
                      <Text style={styles.reportChoiceText}>
                        {locale === "ar" ? "محتوى محظور" : "Prohibited content"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("close")}
                      onPress={() => setReportOpen(false)}
                      style={({ pressed }) => [styles.reportCancel, pressed && styles.pressed]}
                    >
                      <Text style={styles.reportCancelText}>{t("close")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {reportSent ? (
                <View style={[styles.reportSuccess, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <MaterialIcons name="check-circle" size={22} color={BRAND.success} />
                  <Text style={styles.reportSuccessText}>
                    {locale === "ar"
                      ? "تم حفظ البلاغ وإرساله إلى فريق المراجعة."
                      : "Your report was saved and sent to the review team."}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.metric}>
      <MaterialIcons name={icon} size={19} color={BRAND.black} />
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    minHeight: 58,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 18, lineHeight: 25, fontWeight: "900" },
  page: { paddingBottom: 35 },
  content: { width: "100%", maxWidth: 780, alignSelf: "center" },
  media: { width: 370, maxWidth: "100%", height: 470, backgroundColor: BRAND.charcoal },
  copy: { padding: 17 },
  brand: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    padding: 11,
    alignItems: "center",
    gap: 11,
    backgroundColor: BRAND.surface,
  },
  brandCopy: { flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: BRAND.black, fontSize: 20, lineHeight: 26, fontWeight: "900" },
  brandNameRow: { alignItems: "center", gap: 5 },
  brandName: { color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900" },
  muted: { color: BRAND.muted, fontSize: 11, lineHeight: 17 },
  title: { marginTop: 20, color: BRAND.black, fontSize: 27, lineHeight: 37, fontWeight: "900" },
  description: { marginTop: 9, color: BRAND.black, fontSize: 15, lineHeight: 25 },
  meta: { marginTop: 18, flexDirection: "row-reverse", gap: 9 },
  metaCard: { flex: 1, minHeight: 108, borderRadius: 18, padding: 13, backgroundColor: BRAND.surface },
  metaValue: { marginTop: 3, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  status: { marginTop: 15 },
  button: { marginTop: 10 },
  metrics: { marginTop: 16, flexDirection: "row-reverse", gap: 8 },
  metric: { flex: 1, minHeight: 70, borderRadius: 16, backgroundColor: BRAND.surface, alignItems: "center", justifyContent: "center", gap: 2 },
  metricValue: { color: BRAND.black, fontSize: 14, fontWeight: "900" },
  metricLabel: { color: BRAND.muted, fontSize: 9 },
  actions: { marginTop: 14, gap: 9 },
  ownerNotice: { marginTop: 14, padding: 13, borderRadius: 16, backgroundColor: "#FFF8D6" },
  ownerNoticeText: { color: BRAND.charcoal, fontSize: 12, lineHeight: 20, textAlign: "right" },
  reportCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    backgroundColor: BRAND.surface,
  },
  reportTitle: { color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900" },
  reportSubtitle: { marginTop: 4, color: BRAND.muted, fontSize: 13, lineHeight: 20 },
  reportOptions: { marginTop: 13, gap: 8 },
  reportChoice: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 15,
    paddingHorizontal: 13,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
  },
  reportChoiceText: { flex: 1, color: BRAND.black, fontSize: 13, fontWeight: "800", textAlign: "right" },
  reportCancel: { minHeight: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  reportCancelText: { color: BRAND.muted, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.6 },
  reportSuccess: { marginTop: 12, minHeight: 54, borderRadius: 16, paddingHorizontal: 13, backgroundColor: "#EAF7EF", alignItems: "center", gap: 8 },
  reportSuccessText: { flex: 1, color: BRAND.success, fontSize: 12, lineHeight: 19, fontWeight: "800", textAlign: "right" },
});
