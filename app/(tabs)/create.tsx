import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
import {
  BRAND,
  DEFAULT_LAUNCH_MODE,
  cityIdsForMarket,
  fallbackCategories,
  fallbackCities,
  type ContactType,
} from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const CONTACT_OPTIONS: { type: ContactType; labelKey: string }[] = [
  { type: "whatsapp", labelKey: "whatsapp" },
  { type: "phone", labelKey: "phone" },
  { type: "store", labelKey: "store" },
  { type: "product", labelKey: "product" },
  { type: "external", labelKey: "externalLink" },
];

export default function Create() {
  const { publishFreeAd, market, launchMode, user } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const categories = productData.categories.length
    ? productData.categories
    : fallbackCategories;
  const allCities = productData.cities.length ? productData.cities : fallbackCities;
  const marketCities = useMemo(() => {
    const ids = new Set(cityIdsForMarket(allCities, market));
    const filtered = allCities.filter((city) => ids.has(city.id));
    return filtered.length ? filtered : allCities.filter((city) => city.region === "sa");
  }, [allCities, market]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "other");
  const [cityId, setCityId] = useState(marketCities[0]?.id ?? "riyadh");
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [mediaUri, setMediaUri] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [error, setError] = useState("");

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
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
    if (launchMode !== "FREE_LAUNCH" && launchMode !== DEFAULT_LAUNCH_MODE) {
      router.push("/create-ad" as never);
      return;
    }
    if (!mediaUri) {
      setError(locale === "ar" ? "أضف صورة أو فيديو أولًا" : "Add a photo or video first");
      return;
    }
    if (!title.trim() || !categoryId || !cityId || !contactValue.trim()) {
      setError(locale === "ar" ? "أكمل جميع الحقول المطلوبة" : "Complete all required fields");
      return;
    }
    if (
      ["store", "product", "external"].includes(contactType) &&
      !/^https?:\/\//i.test(contactValue.trim())
    ) {
      setError(locale === "ar" ? "يجب أن يبدأ الرابط بـ https://" : "Link must start with https://");
      return;
    }

    const ad = publishFreeAd({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      cityId,
      media: [{ id: `m-${Date.now()}`, kind: mediaKind, uri: mediaUri }],
      contacts: [{ type: contactType, value: contactValue.trim() }],
      ownerName: user?.name,
    });

    setTitle("");
    setDescription("");
    setContactValue("");
    setMediaUri("");
    setError("");
    Alert.alert(locale === "ar" ? "تم نشر الإعلان مباشرة" : "Ad published");
    router.replace({ pathname: "/(tabs)", params: { focus: ad.id } } as never);
  };

  const align = { textAlign: isRTL ? ("right" as const) : ("left" as const) };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={[styles.head, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={styles.title}>{t("create")}</Text>
          <Text style={styles.logo}>
            إعلاني<Text style={styles.dot}>.</Text>
          </Text>
        </View>

        <View style={styles.notice}>
          <MaterialIcons name="check-circle" size={20} color={BRAND.yellowDark} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, align]}>{t("freePublish")}</Text>
            <Text style={[styles.noticeText, align]}>{t("freePublishHelp")}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Pressable onPress={pickMedia} style={[styles.upload, mediaUri ? styles.uploadFilled : null]}>
            {mediaUri && mediaKind === "image" ? (
              <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
            <View style={styles.uploadCopy}>
              <Text style={styles.uploadPlus}>＋</Text>
              <Text style={styles.uploadTitle}>{t("addMedia")}</Text>
              <Text style={styles.uploadHelp}>
                {locale === "ar" ? "صورة أو فيديو حتى 60 ثانية" : "Photo or video up to 60 seconds"}
              </Text>
            </View>
          </Pressable>

          <Text style={[styles.label, align]}>
            {t("adTitle")} <Text style={styles.req}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            style={[styles.field, align]}
          />

          <Text style={[styles.label, align]}>{t("description")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={280}
            multiline
            style={[styles.field, styles.textarea, align]}
          />

          <Text style={[styles.label, align]}>
            {t("category")} <Text style={styles.req}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {categories.map((category) => {
              const label = locale === "ar" ? category.ar : category.en;
              const active = categoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, align]}>
            {t("city")} <Text style={styles.req}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {marketCities.map((city) => {
              const label = locale === "ar" ? city.ar : city.en;
              const active = cityId === city.id;
              return (
                <Pressable
                  key={city.id}
                  onPress={() => setCityId(city.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, align]}>{t("communication")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {CONTACT_OPTIONS.map((option) => {
              const active = contactType === option.type;
              return (
                <Pressable
                  key={option.type}
                  onPress={() => setContactType(option.type)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, align]}>
            {locale === "ar" ? "الرابط أو الرقم" : "Link or number"}{" "}
            <Text style={styles.req}>*</Text>
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
            style={[styles.field, align]}
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={publish} style={styles.primary}>
            <Text style={styles.primaryText}>{t("publishNow")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },
  head: { minHeight: 52, alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { color: BRAND.black, fontSize: 21, fontWeight: "900" },
  logo: { fontSize: 19, fontWeight: "900", color: BRAND.black },
  dot: { color: BRAND.yellowDark },
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
  noticeTitle: { color: BRAND.black, fontSize: 13, fontWeight: "900" },
  noticeText: { marginTop: 3, color: BRAND.black, fontSize: 12, lineHeight: 18 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    backgroundColor: BRAND.white,
  },
  upload: {
    height: 170,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d4d4d4",
    borderRadius: 17,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  uploadFilled: { borderStyle: "solid", borderColor: BRAND.border },
  uploadCopy: {
    zIndex: 2,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
  },
  uploadPlus: { color: BRAND.white, fontSize: 28, fontWeight: "900" },
  uploadTitle: { color: BRAND.white, fontWeight: "900" },
  uploadHelp: { marginTop: 4, color: BRAND.white, fontSize: 10 },
  label: { marginTop: 14, marginBottom: 7, fontSize: 12, fontWeight: "900", color: BRAND.black },
  req: { color: "#c00020" },
  field: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    backgroundColor: "#fbfbfb",
    color: BRAND.black,
    fontSize: 14,
  },
  textarea: { height: 94, paddingTop: 12, textAlignVertical: "top" },
  chips: { flexGrow: 0 },
  chip: {
    marginEnd: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  chipActive: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  chipText: { color: BRAND.black, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: BRAND.black },
  error: { marginTop: 10, color: "#b00020", fontSize: 11, fontWeight: "700" },
  primary: {
    marginTop: 18,
    height: 51,
    borderRadius: 14,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: BRAND.black, fontSize: 15, fontWeight: "900" },
});
