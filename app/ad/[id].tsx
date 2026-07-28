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
import { useProductData } from "@/lib/use-product-data";

const urls = (type: ContactType, value: string) =>
  type === "whatsapp"
    ? `https://wa.me/${value.replace(/\D/g, "")}`
    : type === "phone"
      ? `tel:${value.replace(/[^\d+]/g, "")}`
      : value.startsWith("http")
        ? value
        : `https://${value}`;

export default function Detail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const store = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const ad = store.ads.find((item) => item.id === id);
  const recordedAdId = useRef("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (ad && recordedAdId.current !== ad.id) {
      recordedAdId.current = ad.id;
      store.recordMetric(ad.id, "views");
    }
  }, [ad, store]);

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
    store.recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
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

  const submitReport = (reason: "misleading" | "prohibited") => {
    store.submitReport(ad.id, reason);
    setReportOpen(false);
    setReportSent(true);
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
              <View style={[s.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{store.brand?.name.slice(0, 1) ?? "إ"}</Text>
                </View>
                <View style={s.brandCopy}>
                  <View style={[s.brandNameRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={s.brandName}>{store.brand?.name}</Text>
                    {ad.verified ? (
                      <MaterialIcons name="verified" size={19} color={BRAND.yellowDark} />
                    ) : null}
                  </View>
                  <Text style={s.muted}>{locale === "ar" ? "المعلن" : "Advertiser"}</Text>
                </View>
              </View>

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
                  onPress={() => store.toggleSave(ad.id)}
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={locale === "ar" ? "الإبلاغ عن محتوى مضلل" : "Report misleading content"}
                      onPress={() => submitReport("misleading")}
                      style={({ pressed }) => [s.reportChoice, pressed && s.pressed]}
                    >
                      <MaterialIcons accessible={false} name="report-problem" size={21} color={BRAND.error} />
                      <Text style={s.reportChoiceText}>
                        {locale === "ar" ? "محتوى مضلل" : "Misleading content"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={locale === "ar" ? "الإبلاغ عن محتوى محظور" : "Report prohibited content"}
                      onPress={() => submitReport("prohibited")}
                      style={({ pressed }) => [s.reportChoice, pressed && s.pressed]}
                    >
                      <MaterialIcons accessible={false} name="gpp-bad" size={21} color={BRAND.error} />
                      <Text style={s.reportChoiceText}>
                        {locale === "ar" ? "محتوى محظور" : "Prohibited content"}
                      </Text>
                    </Pressable>
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
