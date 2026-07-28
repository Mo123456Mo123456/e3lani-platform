import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { Field, OutlineButton, Pill, PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import {
  BRAND,
  calculateQuote,
  categories,
  cities,
  promotionPrices,
  type AdContact,
  type AdMedia,
  type ContactType,
  type PromotionCode,
} from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

const promotionOptions: { code: PromotionCode; ar: string; en: string }[] = [
  { code: "highlight_3", ar: "إبراز 3 أيام", en: "3-day highlight" },
  { code: "highlight_7", ar: "إبراز 7 أيام", en: "7-day highlight" },
  { code: "top_category", ar: "أعلى القسم", en: "Top of category" },
  { code: "city_targeting", ar: "استهداف مدينة", en: "City targeting" },
];

export default function CreateAd() {
  const store = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const [step, setStep] = useState(1);
  const [media, setMedia] = useState<AdMedia[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0].id);
  const [cityId, setCityId] = useState(cities[0].id);
  const [storeUrl, setStoreUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("+966");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [promotions, setPromotions] = useState<PromotionCode[]>([]);
  const [progress, setProgress] = useState<number | null>(null);

  if (!store.user) {
    return (
      <ScreenContainer>
        <View style={styles.gate}>
          <MaterialIcons name="lock" size={44} color={BRAND.yellowDark} />
          <Text style={styles.gateTitle}>{t("signIn")}</Text>
          <PrimaryButton label={t("signIn")} icon="login" onPress={() => router.replace("/login" as never)} />
        </View>
      </ScreenContainer>
    );
  }

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const selected = result.assets.slice(0, 5).map(
      (asset, index): AdMedia => ({
        id: `M${Date.now()}${index}`,
        kind: asset.type === "video" ? "video" : "image",
        uri: asset.uri,
      }),
    );
    if (selected.some((item) => item.kind === "video") && selected.length > 1) {
      Alert.alert(t("mediaHelp"));
      return;
    }
    setProgress(35);
    setMedia(selected);
    setTimeout(() => setProgress(100), 180);
    setTimeout(() => setProgress(null), 450);
  };

  const contacts: AdContact[] = (
    [
      { type: "store", value: storeUrl },
      { type: "product", value: product },
      { type: "whatsapp", value: whatsapp },
      { type: "phone", value: phone },
    ] as { type: ContactType; value: string }[]
  ).filter((item) => item.value.trim());

  const togglePromotion = (code: PromotionCode) => {
    setPromotions((current) => {
      if (current.includes(code)) return current.filter((value) => value !== code);
      if (code === "highlight_3") return [...current.filter((value) => value !== "highlight_7"), code];
      if (code === "highlight_7") return [...current.filter((value) => value !== "highlight_3"), code];
      return [...current, code];
    });
  };

  const next = () => {
    if (step === 1 && !media.length) return Alert.alert(t("mediaHelp"));
    if (step === 2 && (title.trim().length < 4 || description.trim().length < 20)) return Alert.alert(t("error"));
    if (step === 3 && !contacts.length) return Alert.alert(t("contact"));
    if (step < 5) {
      setStep((current) => current + 1);
      return;
    }
    const ad = store.createAd({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      cityId,
      contacts,
      promotions,
      media,
    });
    router.push({ pathname: "/checkout/[id]", params: { id: ad.id } } as never);
  };

  const quote = calculateQuote(promotions);
  const cityName = locale === "ar" ? cities.find((item) => item.id === cityId)?.ar : cities.find((item) => item.id === cityId)?.en;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <MaterialIcons name="close" size={27} color={BRAND.black} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("postTitle")}</Text>
        <Text style={styles.step}>{step}/5</Text>
      </View>
      <View style={styles.progressDots}>
        {[1, 2, 3, 4, 5].map((value) => (
          <View key={value} style={[styles.dot, { backgroundColor: value <= step ? BRAND.yellowDark : BRAND.border }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <View>
            <ScreenTitle title={t("media")} subtitle={t("mediaHelp")} />
            <View style={styles.pick}><PrimaryButton label={t("addMedia")} icon="photo-library" onPress={pickMedia} /></View>
            {progress !== null ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress}%` }]} />
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
            ) : null}
            <ScrollView horizontal contentContainerStyle={styles.mediaList} showsHorizontalScrollIndicator={false}>
              {media.map((item) => <View key={item.id} style={styles.thumb}><MediaView media={item} /></View>)}
            </ScrollView>
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <ScreenTitle title={t("data")} />
            <Field label={t("adTitle")} value={title} onChangeText={setTitle} maxLength={120} />
            <Field label={t("description")} value={description} onChangeText={setDescription} multiline maxLength={4000} />
            <Text style={styles.label}>{t("category")}</Text>
            <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
              {categories.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={categoryId === item.id} onPress={() => setCategoryId(item.id)} />)}
            </ScrollView>
            <Text style={styles.label}>{t("city")}</Text>
            <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
              {cities.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={cityId === item.id} onPress={() => setCityId(item.id)} />)}
            </ScrollView>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <ScreenTitle title={t("contact")} />
            <Field label={t("store")} value={storeUrl} onChangeText={setStoreUrl} keyboardType="url" autoCapitalize="none" />
            <Field label={t("product")} value={product} onChangeText={setProduct} keyboardType="url" autoCapitalize="none" />
            <Field label={t("whatsapp")} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
            <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        ) : null}

        {step === 4 ? (
          <View>
            <ScreenTitle title={t("promotion")} />
            {promotionOptions.map((option) => {
              const active = promotions.includes(option.code);
              return (
                <Pressable
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${locale === "ar" ? option.ar : option.en}، ${promotionPrices[option.code] / 100} ${t("sar")}`}
                  accessibilityState={{ checked: active }}
                  key={option.code}
                  onPress={() => togglePromotion(option.code)}
                  style={[styles.promotion, active && styles.promotionActive]}
                >
                  <MaterialIcons accessible={false} name={active ? "check-circle" : "radio-button-unchecked"} size={24} color={active ? BRAND.yellowDark : BRAND.muted} />
                  <Text style={styles.promotionName}>{locale === "ar" ? option.ar : option.en}</Text>
                  <Text style={styles.promotionPrice}>{promotionPrices[option.code] / 100} {t("sar")}</Text>
                </Pressable>
              );
            })}
            <View style={styles.quote}>
              <Text style={styles.quoteLabel}>{t("total")}</Text>
              <Text style={styles.quoteTotal}>{(quote.totalHalalas / 100).toFixed(2)} {t("sar")}</Text>
              <Text style={styles.quoteVat}>{t("vatIncluded")}: {(quote.vatHalalas / 100).toFixed(2)} {t("sar")}</Text>
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View>
            <ScreenTitle title={t("preview")} />
            <View style={styles.preview}>
              <MediaView media={media[0]} active />
              <View style={styles.scrim} />
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle}>{title}</Text>
                <Text numberOfLines={3} style={styles.previewDescription}>{description}</Text>
                <Text style={styles.previewMeta}>{cityName}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.footerBack}>
          {step > 1 ? <OutlineButton label={t("previous")} icon="arrow-forward" onPress={() => setStep((current) => current - 1)} /> : null}
        </View>
        <View style={styles.footerNext}>
          <PrimaryButton label={step === 5 ? t("pay") : t("next")} icon={step === 5 ? "payments" : "arrow-back"} onPress={next} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 18 },
  gateTitle: { color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900" },
  step: { width: 44, color: BRAND.muted, textAlign: "center", fontSize: 12 },
  progressDots: { height: 24, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  dot: { width: 26, height: 5, borderRadius: 3 },
  page: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 18, paddingBottom: 35 },
  pick: { marginTop: 18 },
  track: { height: 34, marginTop: 13, borderRadius: 12, overflow: "hidden", backgroundColor: BRAND.border, justifyContent: "center" },
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: BRAND.yellow },
  progressText: { color: BRAND.black, textAlign: "center", fontSize: 11, fontWeight: "900" },
  mediaList: { gap: 9, paddingTop: 15 },
  thumb: { width: 145, height: 185, borderRadius: 17, overflow: "hidden", backgroundColor: BRAND.charcoal },
  label: { marginTop: 15, marginBottom: 7, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "right" },
  chips: { gap: 7 },
  promotion: { minHeight: 62, marginTop: 9, borderWidth: 1, borderColor: BRAND.border, borderRadius: 17, paddingHorizontal: 14, backgroundColor: BRAND.surface, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  promotionActive: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF9E4" },
  promotionName: { flex: 1, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "right" },
  promotionPrice: { color: BRAND.black, fontSize: 12, fontWeight: "900" },
  quote: { marginTop: 18, borderRadius: 21, padding: 18, backgroundColor: BRAND.black },
  quoteLabel: { color: "#DDD", fontSize: 12, textAlign: "right" },
  quoteTotal: { marginTop: 5, color: BRAND.yellow, fontSize: 29, lineHeight: 38, fontWeight: "900", textAlign: "right" },
  quoteVat: { marginTop: 3, color: "#CCC", fontSize: 10, textAlign: "right" },
  preview: { marginTop: 16, height: 540, borderRadius: 26, overflow: "hidden", backgroundColor: BRAND.charcoal },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.32)" },
  previewCopy: { position: "absolute", left: 18, right: 18, bottom: 18 },
  previewTitle: { color: BRAND.white, fontSize: 25, lineHeight: 34, fontWeight: "900", textAlign: "right" },
  previewDescription: { marginTop: 7, color: "#EEE", fontSize: 14, lineHeight: 22, textAlign: "right" },
  previewMeta: { marginTop: 8, color: BRAND.yellow, fontSize: 12, fontWeight: "900", textAlign: "right" },
  footer: { minHeight: 78, borderTopWidth: 1, borderTopColor: BRAND.border, padding: 11, gap: 9, alignItems: "center" },
  footerBack: { flex: 0.8 },
  footerNext: { flex: 1.3 },
});
