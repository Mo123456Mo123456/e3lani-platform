import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { OutlineButton, PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type ContactType } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { mapFeedAd } from "@/lib/map-feed-ad";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";
import { getApiBaseUrl } from "@/constants/oauth";

const urls = (type: ContactType, value: string) =>
  type === "whatsapp"
    ? `https://wa.me/${value.replace(/\D/g, "")}`
    : type === "phone"
      ? `tel:${value.replace(/[^\d+]/g, "")}`
      : value.startsWith("http")
        ? value
        : `https://${value}`;

type ReportReason =
  | "spam"
  | "fraud"
  | "prohibited"
  | "misleading"
  | "copyright"
  | "impersonation"
  | "sexual"
  | "weapons"
  | "drugs"
  | "other";

const REPORT_REASONS: { id: ReportReason; ar: string; en: string }[] = [
  { id: "spam", ar: "محتوى مزعج أو متكرر", en: "Spam or repeated content" },
  { id: "fraud", ar: "احتيال أو طلب مالي مشبوه", en: "Fraud or suspicious payment" },
  { id: "prohibited", ar: "محتوى غير قانوني", en: "Illegal content" },
  { id: "misleading", ar: "معلومات مضللة", en: "Misleading information" },
  { id: "impersonation", ar: "انتحال شركة أو شخص", en: "Impersonation" },
  { id: "sexual", ar: "محتوى جنسي", en: "Sexual content" },
  { id: "weapons", ar: "أسلحة", en: "Weapons" },
  { id: "drugs", ar: "مخدرات", en: "Drugs" },
  { id: "copyright", ar: "انتهاك حقوق النشر", en: "Copyright violation" },
  { id: "other", ar: "سبب آخر", en: "Other" },
];

export default function Detail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const store = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const adQuery = trpc.ads.get.useQuery({ id }, { enabled: Boolean(id) });
  const reportMutation = trpc.ads.report.useMutation();
  const eventMutation = trpc.ads.recordEvent.useMutation();
  const saveMutation = trpc.ads.toggleSave.useMutation();
  const createVideoVariant = trpc.sharing.createVideoVariant.useMutation();
  const retryVideoVariant = trpc.sharing.retryVideoVariant.useMutation();
  const ad = adQuery.data ? mapFeedAd(adQuery.data) : store.ads.find((item) => item.id === id);
  const recordedAdId = useRef("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const reportKey = useRef(
    `report_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`,
  );
  const shareKey = useRef(
    `share_${id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (ad && recordedAdId.current !== ad.id) {
      recordedAdId.current = ad.id;
      store.recordMetric(ad.id, "views");
      void eventMutation.mutateAsync({
        id: ad.id,
        eventType: "view",
        dedupeSuffix: `detail-${ad.id}`,
      }).catch(() => undefined);
    }
  }, [ad, store, eventMutation]);

  if (!ad) {
    return (
      <ScreenContainer>
        <View style={s.center}>
          <Text style={s.title}>{t("noAds")}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find((item) => item.id === ad.categoryId);
  const saved = store.savedIds.includes(ad.id);

  const share = async () => {
    const apiBase = getApiBaseUrl().replace(/\/$/, "");
    let publicUrl = apiBase ? `${apiBase}/share/ad/${ad.id}` : `e3lani://ad/${ad.id}`;
    if (ad.media.some((item) => item.kind === "video")) {
      const variant = await createVideoVariant
        .mutateAsync({ adId: ad.id, idempotencyKey: shareKey.current })
        .catch(() => null);
      if (!variant) return Alert.alert(t("error"));
      if (variant.status === "failed" && variant.id) {
        return Alert.alert(
          locale === "ar" ? "تعذرت معالجة الفيديو" : "Video processing failed",
          locale === "ar" ? "لم يتم تعديل الملف الأصلي. يمكنك إعادة المحاولة." : "The original was not modified. You can retry.",
          [
            { text: t("close"), style: "cancel" },
            {
              text: t("retry"),
              onPress: () =>
                void retryVideoVariant.mutateAsync({ id: variant.id! }).then((value) => {
                  if (value.status === "ready" && value.url) {
                    const url = value.url.startsWith("http") ? value.url : `${apiBase}${value.url}`;
                    void Share.share({ message: `${ad.title}\n${url}`, url });
                  }
                }),
            },
          ],
        );
      }
      if (variant.status !== "ready" || !variant.url) return;
      publicUrl = variant.url.startsWith("http") ? variant.url : `${apiBase}${variant.url}`;
    }
    const result = await Share.share({ message: `${ad.title}\n${publicUrl}`, url: publicUrl });
    if (result.action !== Share.sharedAction) return;
    store.recordMetric(ad.id, "shares");
    await eventMutation.mutateAsync({
      id: ad.id,
      eventType: "share",
      dedupeSuffix: `detail-share-${Date.now()}`,
    }).catch(() => undefined);
  };

  const contact = async (type: ContactType, value: string) => {
    store.recordMetric(ad.id, "contacts");
    try {
      await Linking.openURL(urls(type, value));
    } catch {
      Alert.alert(t("error"));
    }
  };

  const toggleReportForm = () => {
    setReportSent(false);
    setReportOpen((current) => !current);
  };

  const submitReport = async (reason: ReportReason) => {
    try {
      await reportMutation.mutateAsync({
        id: ad.id,
        reason,
        idempotencyKey: reportKey.current,
      });
      setReportOpen(false);
      setReportSent(true);
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[s.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === "ar" ? "رجوع" : "Back"} onPress={() => router.back()} style={s.icon}>
          <MaterialIcons
            accessible={false}
            name={isRTL ? "arrow-forward" : "arrow-back"}
            size={26}
            color={BRAND.black}
          />
        </Pressable>
        <Text style={s.headerTitle}>{t("details")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("share")} onPress={share} style={s.icon}>
          <MaterialIcons accessible={false} name="ios-share" size={24} color={BRAND.black} />
        </Pressable>
      </View>

      <FlatList
        data={[ad]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.page}
        renderItem={() => (
          <View style={s.content}>
            <FlatList
              horizontal
              pagingEnabled
              data={ad.media}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <View style={s.media}>
                  <MediaView media={item} active={index === 0} />
                </View>
              )}
            />

            <View style={s.copy}>
              <Pressable
                onPress={() =>
                  ad.advertiser?.username
                    ? router.push({
                        pathname: "/advertiser/[username]",
                        params: { username: ad.advertiser.username },
                      } as never)
                    : undefined
                }
                style={[s.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{store.brand?.name.slice(0, 1) ?? "إ"}</Text>
                </View>
                <View style={s.brandCopy}>
                  <View style={[s.brandNameRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={s.brandName}>{ad.advertiser?.displayName ?? store.brand?.name}</Text>
                    {store.launchPolicy.brandVerificationEnabled && ad.verified ? (
                      <MaterialIcons name="verified" size={19} color={BRAND.yellowDark} />
                    ) : null}
                  </View>
                  <Text style={s.muted}>{locale === "ar" ? "المعلن" : "Advertiser"}</Text>
                </View>
                  {ad.advertiser?.username ? <Text style={s.muted}>@{ad.advertiser.username}</Text> : null}
              </Pressable>

              <Text style={[s.title, { textAlign: isRTL ? "right" : "left" }]}>{ad.title}</Text>
              <Text style={[s.description, { textAlign: isRTL ? "right" : "left" }]}>
                {ad.description}
              </Text>

              <View style={s.meta}>
                <View style={s.metaCard}>
                  <MaterialIcons name="location-on" size={22} color={BRAND.yellowDark} />
                  <Text style={s.muted}>{t("city")}</Text>
                  <Text style={s.metaValue}>{(locale === "ar" ? city?.ar : city?.en) ?? "—"}</Text>
                </View>
                <View style={s.metaCard}>
                  <MaterialIcons name="category" size={22} color={BRAND.yellowDark} />
                  <Text style={s.muted}>{t("category")}</Text>
                  <Text style={s.metaValue}>{(locale === "ar" ? category?.ar : category?.en) ?? "—"}</Text>
                </View>
              </View>

              <View style={s.status}>
                <StatusBadge status={ad.status} />
              </View>

              {ad.contacts.map((item) => (
                <View key={`${item.type}-${item.value}`} style={s.button}>
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
                    onPress={() => contact(item.type, item.value)}
                  />
                </View>
              ))}

              <View style={s.actions}>
                <OutlineButton
                  label={saved ? t("savedDone") : t("save")}
                  icon={saved ? "bookmark" : "bookmark-border"}
                  onPress={() => {
                    store.toggleSave(ad.id);
                    void saveMutation.mutateAsync({ id: ad.id }).catch(() => store.toggleSave(ad.id));
                  }}
                />
                <OutlineButton label={t("report")} icon="flag" onPress={toggleReportForm} />
                <OutlineButton
                  label={t("block")}
                  icon="block"
                  onPress={() => store.toggleBlock(ad.ownerId)}
                />
              </View>

              {reportOpen ? (
                <View style={s.reportCard} accessibilityRole="summary">
                  <Text style={[s.reportTitle, { textAlign: isRTL ? "right" : "left" }]}>
                    {locale === "ar" ? "ما سبب الإبلاغ؟" : "Why are you reporting this ad?"}
                  </Text>
                  <Text style={[s.reportSubtitle, { textAlign: isRTL ? "right" : "left" }]}>
                    {locale === "ar"
                      ? "اختر السبب الأنسب، وسيصل البلاغ إلى فريق المراجعة."
                      : "Choose the best reason and it will be sent to the review team."}
                  </Text>
                  <View style={s.reportOptions}>
                    {REPORT_REASONS.map((reason) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={locale === "ar" ? reason.ar : reason.en}
                        key={reason.id}
                        onPress={() => void submitReport(reason.id)}
                        style={({ pressed }) => [s.reportChoice, pressed && s.pressed]}
                      >
                        <MaterialIcons accessible={false} name="report-problem" size={21} color={BRAND.error} />
                        <Text style={s.reportChoiceText}>{locale === "ar" ? reason.ar : reason.en}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("close")}
                      onPress={() => setReportOpen(false)}
                      style={({ pressed }) => [s.reportCancel, pressed && s.pressed]}
                    >
                      <Text style={s.reportCancelText}>{t("close")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {reportSent ? (
                <View style={[s.reportSuccess, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <MaterialIcons name="check-circle" size={22} color={BRAND.success} />
                  <Text style={s.reportSuccessText}>
                    {locale === "ar"
                      ? "تم استلام البلاغ وإرساله إلى فريق المراجعة."
                      : "Your report was sent to the review team."}
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

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    minHeight: 58,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
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
  actions: { marginTop: 14, gap: 9 },
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
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 15,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reportChoiceText: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  reportCancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  reportCancelText: { color: BRAND.muted, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  reportSuccess: {
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: `${BRAND.success}14`,
    alignItems: "center",
    gap: 8,
  },
  reportSuccessText: { flex: 1, color: BRAND.black, fontSize: 13, lineHeight: 20, fontWeight: "700" },
  pressed: { opacity: 0.62 },
});
