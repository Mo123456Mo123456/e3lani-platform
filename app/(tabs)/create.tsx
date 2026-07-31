import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { citiesForMarket, MARKETS } from "@/lib/e3lani-catalog";
import { BRAND, type ContactType } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const CONTACT_OPTIONS: { value: ContactType; ar: string; en: string }[] = [
  { value: "whatsapp", ar: "واتساب", en: "WhatsApp" },
  { value: "phone", ar: "اتصال", en: "Phone" },
  { value: "store", ar: "رابط متجر", en: "Store URL" },
  { value: "product", ar: "رابط منتج", en: "Product URL" },
  { value: "external", ar: "رابط خارجي", en: "External URL" },
];

export default function Create() {
  const store = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [country, setCountry] = useState(store.marketCode);
  const [cityId, setCityId] = useState("");
  const [contactMethod, setContactMethod] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [mediaUri, setMediaUri] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [error, setError] = useState("");

  const cities = useMemo(
    () => citiesForMarket(country, productData.cities),
    [country, productData.cities],
  );

  useEffect(() => {
    if (!categoryId && productData.categories[0]) setCategoryId(productData.categories[0].id);
  }, [categoryId, productData.categories]);

  useEffect(() => {
    if (!cities.find((city) => city.id === cityId)) {
      setCityId(cities[0]?.id ?? "");
    }
  }, [cities, cityId]);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.82,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setMediaUri(asset.uri);
    setMediaKind(asset.type === "video" ? "video" : "image");
    setError("");
  };

  const publish = () => {
    setError("");
    if (!mediaUri) return setError(locale === "ar" ? "أضف صورة أو فيديو أولًا" : "Add an image or video first");
    if (!title.trim() || !categoryId || !cityId || !contactValue.trim()) {
      return setError(locale === "ar" ? "أكمل جميع الحقول المطلوبة" : "Complete all required fields");
    }
    if (
      ["store", "product", "external"].includes(contactMethod) &&
      !/^https?:\/\//i.test(contactValue.trim())
    ) {
      return setError(locale === "ar" ? "يجب أن يبدأ الرابط بـ https://" : "URL must start with https://");
    }

    const user = store.ensureLocalUser();
    const ad = store.createAd(
      {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        cityId,
        media: [{ id: `local-${Date.now()}`, kind: mediaKind, uri: mediaUri }],
        contacts: [{ type: contactMethod, value: contactValue.trim() }],
        promotions: [],
        ownerName: user.name,
      },
      { freeLaunch: true },
    );

    setTitle("");
    setDescription("");
    setContactValue("");
    setMediaUri("");
    Alert.alert(
      locale === "ar" ? "تم النشر" : "Published",
      locale === "ar" ? "تم نشر الإعلان مباشرة في الموجز" : "Your ad is live in the feed",
      [{ text: t("home"), onPress: () => router.replace({ pathname: "/", params: { focus: ad.id } } as never) }],
    );
  };

  return (
    <ScreenContainer className="px-0" containerClassName="bg-[#F7F7F7]">
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t("create")}</Text>
        <Text style={styles.logo}>
          إعلاني<Text style={{ color: BRAND.yellowDark }}>.</Text>
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <MaterialIcons name="check-circle" size={20} color={BRAND.yellowDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>{t("freePublish")}</Text>
            <Text style={styles.noticeText}>{t("freePublishHelp")}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Pressable accessibilityRole="button" onPress={pickMedia} style={styles.upload}>
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : null}
            <View style={[styles.uploadCopy, mediaUri ? styles.uploadCopyOver : null]}>
              <Text style={styles.uploadPlus}>＋</Text>
              <Text style={styles.uploadTitle}>{t("addMedia")}</Text>
              <Text style={styles.uploadHelp}>{t("mediaHelp")}</Text>
            </View>
          </Pressable>

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("adTitle")} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            style={[styles.field, { textAlign: isRTL ? "right" : "left" }]}
          />

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{t("description")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={280}
            multiline
            style={[styles.field, styles.textarea, { textAlign: isRTL ? "right" : "left" }]}
          />

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("category")} <Text style={styles.required}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {productData.categories.map((category) => {
              const label = locale === "ar" ? category.ar : category.en;
              const active = category.id === categoryId;
              return (
                <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("market")} <Text style={styles.required}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {MARKETS.map((market) => {
              const active = market.code === country;
              return (
                <Pressable key={market.code} onPress={() => setCountry(market.code)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {locale === "ar" ? market.ar : market.en}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("city")} <Text style={styles.required}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {cities.map((city) => {
              const active = city.id === cityId;
              return (
                <Pressable key={city.id} onPress={() => setCityId(city.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {locale === "ar" ? city.ar : city.en}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{t("communication")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CONTACT_OPTIONS.map((option) => {
              const active = option.value === contactMethod;
              return (
                <Pressable key={option.value} onPress={() => setContactMethod(option.value)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {locale === "ar" ? option.ar : option.en}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("contactValue")} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            value={contactValue}
            onChangeText={setContactValue}
            placeholder={contactMethod === "whatsapp" || contactMethod === "phone" ? "+9665XXXXXXXX" : "https://example.com"}
            placeholderTextColor={BRAND.muted}
            style={[styles.field, { textAlign: isRTL ? "right" : "left" }]}
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" onPress={publish} style={styles.primary}>
            <Text style={styles.primaryText}>{t("publishNow")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  head: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headTitle: { fontSize: 21, fontWeight: "900", color: BRAND.black },
  logo: { fontSize: 19, fontWeight: "900", color: BRAND.black },
  body: { padding: 16, paddingBottom: 40 },
  notice: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: "#f0d45e",
    borderRadius: 16,
    backgroundColor: "#fff7d2",
  },
  noticeTitle: { color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" },
  noticeText: { marginTop: 4, color: BRAND.black, fontSize: 12, lineHeight: 18, textAlign: "right" },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    backgroundColor: BRAND.white,
  },
  upload: {
    height: 170,
    overflow: "hidden",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d4d4d4",
    borderRadius: 17,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCopy: { alignItems: "center", padding: 10 },
  uploadCopyOver: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12 },
  uploadPlus: { fontSize: 34, color: BRAND.muted },
  uploadTitle: { color: BRAND.black, fontWeight: "900" },
  uploadHelp: { marginTop: 5, fontSize: 10, color: BRAND.muted },
  label: { marginTop: 14, marginBottom: 7, fontSize: 12, fontWeight: "900", color: BRAND.black },
  required: { color: "#c00020" },
  field: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    backgroundColor: "#fbfbfb",
    color: BRAND.black,
  },
  textarea: { height: 94, paddingTop: 12, textAlignVertical: "top" },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  chipActive: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  chipText: { fontSize: 12, fontWeight: "800", color: BRAND.black },
  chipTextActive: { color: BRAND.black },
  error: { marginTop: 9, color: "#b00020", fontSize: 11, textAlign: "right" },
  primary: {
    marginTop: 18,
    height: 51,
    borderRadius: 14,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: BRAND.black, fontWeight: "900", fontSize: 15 },
});
