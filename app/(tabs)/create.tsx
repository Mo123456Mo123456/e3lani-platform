import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { Field, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type AdContact, type AdMedia, type ContactType, type MarketCode } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { getMarket, MARKETS, UI_CATEGORIES } from "@/lib/e3lani-ui-data";
import { useI18n } from "@/lib/i18n";
import { persistPickedMedia } from "@/lib/local-media";

type Selector = "category" | "country" | "city" | "contact" | null;

const CONTACTS: { type: ContactType; ar: string; en: string }[] = [
  { type: "whatsapp", ar: "واتساب", en: "WhatsApp" },
  { type: "phone", ar: "اتصال", en: "Phone" },
  { type: "store", ar: "رابط متجر", en: "Store URL" },
  { type: "product", ar: "رابط منتج", en: "Product URL" },
];

function SelectField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.selectWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onPress}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}
      >
        <MaterialIcons name="expand-more" size={22} color={BRAND.muted} />
        <Text numberOfLines={1} style={styles.selectText}>{value}</Text>
      </Pressable>
    </View>
  );
}

export default function Create() {
  const store = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const [media, setMedia] = useState<AdMedia | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(UI_CATEGORIES[0].id);
  const [countryCode, setCountryCode] = useState<MarketCode>(store.market);
  const [cityId, setCityId] = useState(getMarket(store.market).cities[0].id);
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [selector, setSelector] = useState<Selector>(null);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);

  const selectedCategory = UI_CATEGORIES.find((item) => item.id === categoryId) ?? UI_CATEGORIES[0];
  const selectedMarket = getMarket(countryCode);
  const selectedCity = selectedMarket.cities.find((item) => item.id === cityId) ?? selectedMarket.cities[0];
  const selectedContact = CONTACTS.find((item) => item.type === contactType) ?? CONTACTS[0];

  const options = useMemo(() => {
    if (selector === "category") {
      return UI_CATEGORIES.map((item) => ({
        id: item.id,
        label: locale === "ar" ? item.ar : item.en,
        icon: item.icon,
      }));
    }
    if (selector === "country") {
      return MARKETS.map((item) => ({
        id: item.code,
        label: locale === "ar" ? item.ar : item.en,
        icon: "public",
      }));
    }
    if (selector === "city") {
      return selectedMarket.cities.map((item) => ({
        id: item.id,
        label: locale === "ar" ? item.ar : item.en,
        icon: "location-on",
      }));
    }
    if (selector === "contact") {
      return CONTACTS.map((item) => ({
        id: item.type,
        label: locale === "ar" ? item.ar : item.en,
        icon: item.type === "whatsapp" ? "chat" : item.type === "phone" ? "phone" : "link",
      }));
    }
    return [];
  }, [locale, selectedMarket.cities, selector]);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      quality: 0.82,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const uri = await persistPickedMedia(asset);
      setMedia({
        id: `local-${Date.now()}`,
        kind: asset.type === "video" ? "video" : "image",
        uri,
        processingStatus: "ready",
      });
      setError("");
    } catch {
      setError(locale === "ar" ? "تعذر تجهيز الوسائط. اختر ملفًا آخر." : "Media could not be prepared. Choose another file.");
    }
  };

  const choose = (id: string) => {
    if (selector === "category") setCategoryId(id);
    if (selector === "country") {
      const code = id as MarketCode;
      setCountryCode(code);
      setCityId(getMarket(code).cities[0].id);
    }
    if (selector === "city") setCityId(id);
    if (selector === "contact") setContactType(id as ContactType);
    setSelector(null);
  };

  const publish = () => {
    setPublished(false);
    if (!media) {
      setError(locale === "ar" ? "أضف صورة أو فيديو أولًا" : "Add a photo or video first");
      return;
    }
    if (!title.trim() || !contactValue.trim()) {
      setError(locale === "ar" ? "أكمل جميع الحقول المطلوبة" : "Complete all required fields");
      return;
    }
    if (
      (contactType === "store" || contactType === "product") &&
      !/^https?:\/\//i.test(contactValue.trim())
    ) {
      setError(locale === "ar" ? "يجب أن يبدأ الرابط بـ https://" : "The URL must start with https://");
      return;
    }

    const contact: AdContact = { type: contactType, value: contactValue.trim() };
    store.publishFreeAd({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      cityId,
      countryCode,
      cityName: locale === "ar" ? selectedCity.ar : selectedCity.en,
      displayOwner: store.user?.name ?? "حسابي",
      media: [media],
      contacts: [contact],
      promotions: [],
    });
    setMedia(null);
    setTitle("");
    setDescription("");
    setContactValue("");
    setError("");
    setPublished(true);
    setTimeout(() => router.replace("/" as never), 900);
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{locale === "ar" ? "أضف إعلانًا" : "Post an ad"}</Text>
        <Text style={styles.logo}>إعلاني<Text style={styles.logoDot}>.</Text></Text>
      </View>

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={[styles.notice, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <MaterialIcons name="check-circle" size={20} color={BRAND.black} />
          <Text style={[styles.noticeText, { textAlign: isRTL ? "right" : "left" }]}>
            <Text style={styles.noticeStrong}>{locale === "ar" ? "النشر مجاني حاليًا" : "Publishing is currently free"}</Text>
            {"\n"}
            {locale === "ar"
              ? "ينشر الإعلان مباشرة بعد التحقق من البيانات."
              : "Your ad is published after validating the details."}
          </Text>
        </View>

        <View style={styles.form}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("addMedia")}
            onPress={pickMedia}
            style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
          >
            {media ? <MediaView media={media} active muted /> : null}
            <View style={[styles.uploadCopy, media && styles.uploadCopyWithMedia]}>
              <MaterialIcons name={media ? "edit" : "add"} size={34} color={media ? BRAND.white : BRAND.muted} />
              <Text style={[styles.uploadTitle, media && styles.uploadTextWithMedia]}>
                {media ? (locale === "ar" ? "تغيير الوسائط" : "Change media") : t("addMedia")}
              </Text>
              {!media ? <Text style={styles.uploadHelp}>{t("mediaHelp")}</Text> : null}
            </View>
          </Pressable>

          <View style={styles.fieldGap}>
            <Field
              label={locale === "ar" ? "عنوان الإعلان *" : "Ad title *"}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </View>
          <View style={styles.fieldGap}>
            <Field
              label={t("description")}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={280}
            />
          </View>

          <View style={[styles.two, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <SelectField
              label={t("category")}
              value={locale === "ar" ? selectedCategory.ar : selectedCategory.en}
              onPress={() => setSelector("category")}
            />
            <SelectField
              label={locale === "ar" ? "الدولة" : "Country"}
              value={locale === "ar" ? selectedMarket.ar : selectedMarket.en}
              onPress={() => setSelector("country")}
            />
          </View>
          <View style={[styles.two, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <SelectField
              label={t("city")}
              value={locale === "ar" ? selectedCity.ar : selectedCity.en}
              onPress={() => setSelector("city")}
            />
            <SelectField
              label={t("contact")}
              value={locale === "ar" ? selectedContact.ar : selectedContact.en}
              onPress={() => setSelector("contact")}
            />
          </View>

          <View style={styles.fieldGap}>
            <Field
              label={locale === "ar" ? "الرابط أو الرقم *" : "URL or number *"}
              value={contactValue}
              onChangeText={setContactValue}
              keyboardType={contactType === "phone" || contactType === "whatsapp" ? "phone-pad" : "url"}
              autoCapitalize="none"
              placeholder={contactType === "whatsapp" ? "+9665XXXXXXXX" : contactType === "phone" ? "+966XXXXXXXXX" : "https://example.com"}
            />
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.error}>
              <MaterialIcons name="error-outline" size={19} color={BRAND.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {published ? (
            <View accessibilityRole="alert" style={styles.success}>
              <MaterialIcons name="check-circle" size={19} color={BRAND.success} />
              <Text style={styles.successText}>{locale === "ar" ? "تم نشر الإعلان — جارٍ فتح الموجز" : "Ad published — opening the feed"}</Text>
            </View>
          ) : null}

          <View style={styles.publish}>
            <PrimaryButton
              label={locale === "ar" ? "نشر الإعلان الآن" : "Publish now"}
              icon="campaign"
              onPress={publish}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selector)}
        onRequestClose={() => setSelector(null)}
      >
        <View style={styles.overlay}>
          <Pressable onPress={() => setSelector(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.options}>
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => choose(option.id)}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <MaterialIcons name={option.icon as never} size={22} color={BRAND.black} />
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: BRAND.black, fontSize: 21, lineHeight: 29, fontWeight: "900" },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  page: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 16, paddingBottom: 38 },
  notice: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F0D45E",
    borderRadius: 16,
    padding: 13,
    backgroundColor: "#FFF7D2",
    gap: 10,
  },
  noticeText: { flex: 1, color: BRAND.black, fontSize: 12, lineHeight: 19 },
  noticeStrong: { fontWeight: "900" },
  form: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 20, padding: 16, backgroundColor: BRAND.white },
  upload: {
    height: 180,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D4D4D4",
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCopy: { zIndex: 2, alignItems: "center", justifyContent: "center" },
  uploadCopyWithMedia: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,.62)" },
  uploadTitle: { marginTop: 3, color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "900" },
  uploadTextWithMedia: { color: BRAND.white },
  uploadHelp: { marginTop: 4, color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  fieldGap: { marginTop: 14 },
  two: { marginTop: 14, gap: 10 },
  selectWrap: { flex: 1, minWidth: 0 },
  label: { marginBottom: 7, color: BRAND.black, fontSize: 12, lineHeight: 18, fontWeight: "900", textAlign: "right" },
  select: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 11,
    backgroundColor: "#FBFBFB",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  selectText: { flex: 1, color: BRAND.black, fontSize: 12, lineHeight: 18, textAlign: "right" },
  publish: { marginTop: 18 },
  error: { minHeight: 46, marginTop: 13, borderRadius: 12, paddingHorizontal: 11, backgroundColor: `${BRAND.error}12`, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  errorText: { flex: 1, color: BRAND.error, fontSize: 11, lineHeight: 17, fontWeight: "800", textAlign: "right" },
  success: { minHeight: 46, marginTop: 13, borderRadius: 12, paddingHorizontal: 11, backgroundColor: `${BRAND.success}12`, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  successText: { flex: 1, color: BRAND.success, fontSize: 11, lineHeight: 17, fontWeight: "800", textAlign: "right" },
  pressed: { opacity: 0.65 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.58)", justifyContent: "flex-end" },
  sheet: { maxHeight: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, backgroundColor: BRAND.white },
  handle: { width: 52, height: 5, marginBottom: 12, borderRadius: 3, backgroundColor: "#DDD", alignSelf: "center" },
  options: { paddingBottom: 20 },
  option: {
    minHeight: 53,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  optionText: { flex: 1, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "right" },
});
