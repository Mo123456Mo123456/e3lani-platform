import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import {
  BRAND,
  FALLBACK_CATEGORIES,
  MARKETS,
  getMarket,
  type AudienceScope,
  type ContactType,
  type MarketCode,
} from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

export default function Create() {
  const { publishFreeAd, market, setMarket } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();

  const categories = productData.categories.length ? productData.categories : FALLBACK_CATEGORIES;
  const marketCities = useMemo(() => getMarket(market).cities, [market]);

  const [mediaUri, setMediaUri] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState(marketCities[0]?.id ?? "riyadh");
  const [scope, setScope] = useState<AudienceScope>("CITY");
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [error, setError] = useState("");

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
    if (!mediaUri) return setError(t("addMediaRequired"));
    if (!title.trim() || !categoryId || !cityId || !contactValue.trim()) {
      return setError(t("requiredFields"));
    }
    if (
      ["store", "product", "external"].includes(contactType) &&
      !/^https?:\/\//i.test(contactValue.trim())
    ) {
      return setError(t("httpsRequired"));
    }

    const ad = publishFreeAd({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      cityId,
      countryCode: market,
      audienceScope: scope,
      media: [{ id: `local-${Date.now()}`, kind: mediaKind, uri: mediaUri }],
      contacts: [{ type: contactType, value: contactValue.trim() }],
    });

    setMediaUri("");
    setTitle("");
    setDescription("");
    setContactValue("");
    setError("");
    void ad;
    router.replace("/" as never);
  };

  const select = (
    label: string,
    options: { id: string; label: string }[],
    current: string,
    onChange: (id: string) => void,
  ) => (
    <View style={styles.block}>
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.chip, current === option.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, current === option.id && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={t("create")} />

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t("freePublishNotice")}</Text>
          <Text style={styles.noticeText}>{t("freePublishHelp")}</Text>
        </View>

        <Pressable onPress={pickMedia} style={styles.upload}>
          {mediaUri ? (
            <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : null}
          <View style={[styles.uploadCopy, mediaUri ? styles.uploadCopyOverlay : null]}>
            <Text style={styles.uploadPlus}>＋</Text>
            <Text style={styles.uploadTitle}>{t("addMedia")}</Text>
            <Text style={styles.uploadHelp}>{t("mediaHelp")}</Text>
          </View>
        </Pressable>

        <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
          {t("adTitle")} *
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

        {select(
          `${t("category")} *`,
          categories.map((item) => ({
            id: item.id,
            label: locale === "ar" ? item.ar : item.en,
          })),
          categoryId,
          setCategoryId,
        )}

        {select(
          `${t("country")} *`,
          MARKETS.map((item) => ({
            id: item.code,
            label: locale === "ar" ? item.ar : item.en,
          })),
          market,
          (code) => {
            const next = code as MarketCode;
            setMarket(next);
            setCityId(getMarket(next).cities[0]?.id ?? "");
          },
        )}

        {select(
          `${t("city")} *`,
          marketCities.map((item) => ({
            id: item.id,
            label: locale === "ar" ? item.ar : item.en,
          })),
          cityId,
          setCityId,
        )}

        {select(
          t("scope"),
          [
            { id: "CITY", label: t("scopeCity") },
            { id: "COUNTRY", label: t("scopeCountry") },
            { id: "GLOBAL", label: t("scopeGlobal") },
          ],
          scope,
          (value) => setScope(value as AudienceScope),
        )}

        {select(
          t("communication"),
          [
            { id: "whatsapp", label: t("whatsapp") },
            { id: "phone", label: t("phone") },
            { id: "store", label: t("store") },
            { id: "product", label: t("product") },
            { id: "external", label: t("external") },
          ],
          contactType,
          (value) => setContactType(value as ContactType),
        )}

        <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
          {t("contactValue")} *
        </Text>
        <TextInput
          value={contactValue}
          onChangeText={setContactValue}
          placeholder={
            contactType === "whatsapp" || contactType === "phone"
              ? "+9665XXXXXXXX"
              : "https://example.com"
          }
          placeholderTextColor={BRAND.muted}
          style={[styles.field, { textAlign: isRTL ? "right" : "left" }]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.button}>
          <PrimaryButton label={t("publishNow")} icon="campaign" onPress={publish} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 40 },
  notice: {
    marginTop: 10,
    marginBottom: 14,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0d45e",
    backgroundColor: "#fff7d2",
    gap: 4,
  },
  noticeTitle: { color: BRAND.black, fontSize: 13, fontWeight: "900" },
  noticeText: { color: BRAND.black, fontSize: 12, lineHeight: 18 },
  upload: {
    height: 170,
    borderRadius: 17,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d4d4d4",
    backgroundColor: "#fafafa",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCopy: { alignItems: "center", gap: 4 },
  uploadCopyOverlay: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,.55)",
  },
  uploadPlus: { fontSize: 34, color: BRAND.muted, fontWeight: "700" },
  uploadTitle: { color: BRAND.black, fontSize: 14, fontWeight: "900" },
  uploadHelp: { color: BRAND.muted, fontSize: 10 },
  label: { marginTop: 14, marginBottom: 7, color: BRAND.black, fontSize: 12, fontWeight: "900" },
  field: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    backgroundColor: "#fbfbfb",
    color: BRAND.black,
    fontSize: 14,
  },
  textarea: { minHeight: 94, paddingTop: 12, textAlignVertical: "top" },
  block: { marginTop: 4 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  chipText: { color: BRAND.black, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: BRAND.black },
  error: { marginTop: 10, color: BRAND.error, fontSize: 12, fontWeight: "800" },
  button: { marginTop: 18 },
});
