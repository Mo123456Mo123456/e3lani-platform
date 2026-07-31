import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type AdMedia, type ContactType } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const contactTypes: {
  type: ContactType;
  ar: string;
  en: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
}[] = [
  { type: "whatsapp", ar: "واتساب", en: "WhatsApp", icon: "chat" },
  { type: "phone", ar: "اتصال", en: "Phone", icon: "phone" },
  { type: "store", ar: "رابط متجر", en: "Store URL", icon: "storefront" },
  { type: "product", ar: "رابط منتج", en: "Product URL", icon: "link" },
];

export default function Create() {
  const { publishFreeAd } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const productData = useProductData();
  const [media, setMedia] = useState<AdMedia | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("+966");

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setMedia({
      id: `local-${Date.now()}`,
      kind: asset.type === "video" ? "video" : "image",
      uri: asset.uri,
    });
  };

  const publish = () => {
    const selectedCategory = categoryId || productData.categories[0]?.id;
    const selectedCity = cityId || productData.cities[0]?.id;
    if (!media) {
      Alert.alert(
        locale === "ar"
          ? "أضف صورة أو فيديو أولًا"
          : "Add a photo or video first",
      );
      return;
    }
    if (
      !title.trim() ||
      !selectedCategory ||
      !selectedCity ||
      !contactValue.trim()
    ) {
      Alert.alert(
        locale === "ar"
          ? "أكمل جميع الحقول المطلوبة"
          : "Complete all required fields",
      );
      return;
    }
    if (
      (contactType === "store" || contactType === "product") &&
      !/^https?:\/\//i.test(contactValue.trim())
    ) {
      Alert.alert(
        locale === "ar"
          ? "يجب أن يبدأ الرابط بـ https://"
          : "The URL must start with https://",
      );
      return;
    }

    publishFreeAd({
      title: title.trim(),
      description: description.trim(),
      categoryId: selectedCategory,
      cityId: selectedCity,
      media: [media],
      contacts: [{ type: contactType, value: contactValue.trim() }],
      promotions: [],
    });
    setMedia(null);
    setTitle("");
    setDescription("");
    setCategoryId("");
    setCityId("");
    setContactType("whatsapp");
    setContactValue("+966");
    Alert.alert(
      locale === "ar" ? "تم نشر الإعلان مباشرة" : "Your ad is now live",
    );
    router.replace("/" as never);
  };

  if (productData.isLoading) {
    return (
      <ScreenContainer>
        <View style={s.state}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  if (
    productData.isError ||
    !productData.categories.length ||
    !productData.cities.length
  ) {
    return (
      <ScreenContainer>
        <View style={s.state}>
          <MaterialIcons name="cloud-off" size={42} color={BRAND.error} />
          <Text style={s.stateTitle}>{t("error")}</Text>
          <PrimaryButton
            label={t("retry")}
            icon="refresh"
            onPress={productData.retry}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View
        style={[s.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}
      >
        <Text accessibilityRole="header" style={s.headerTitle}>
          {t("create")}
        </Text>
        <Text style={s.logo}>
          إعلاني<Text style={s.logoDot}>.</Text>
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[s.notice, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          <MaterialIcons name="verified" size={21} color={BRAND.black} />
          <Text style={[s.noticeText, { textAlign: isRTL ? "right" : "left" }]}>
            <Text style={s.noticeStrong}>
              {locale === "ar"
                ? "النشر مجاني حاليًا\n"
                : "Publishing is free right now\n"}
            </Text>
            {locale === "ar"
              ? "ينشر الإعلان مباشرة بعد التحقق من البيانات."
              : "Your ad is published after validating the details."}
          </Text>
        </View>

        <View style={s.formCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("addMedia")}
            onPress={() => void pickMedia()}
            style={({ pressed }) => [s.upload, pressed && s.pressed]}
          >
            {media ? <MediaView media={media} active /> : null}
            <View style={[s.uploadCopy, media && s.uploadCopyMedia]}>
              <MaterialIcons
                name={media ? "edit" : "add"}
                size={media ? 22 : 34}
                color={media ? BRAND.white : BRAND.muted}
              />
              <Text style={[s.uploadTitle, media && { color: BRAND.white }]}>
                {t("addMedia")}
              </Text>
              {!media ? (
                <Text style={s.uploadHelp}>{t("mediaHelp")}</Text>
              ) : null}
            </View>
          </Pressable>

          <Text style={[s.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("adTitle")} <Text style={s.required}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            style={[s.field, { textAlign: isRTL ? "right" : "left" }]}
          />

          <Text style={[s.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("description")}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={280}
            multiline
            style={[
              s.field,
              s.multiline,
              { textAlign: isRTL ? "right" : "left" },
            ]}
          />

          <Text style={[s.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("category")} <Text style={s.required}>*</Text>
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            {productData.categories.map((item) => {
              const selected =
                (categoryId || productData.categories[0]?.id) === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategoryId(item.id)}
                  style={[s.chip, selected && s.chipActive]}
                >
                  <Text style={s.chipText}>
                    {locale === "ar" ? item.ar : item.en}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("city")} <Text style={s.required}>*</Text>
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            {productData.cities.map((item) => {
              const selected =
                (cityId || productData.cities[0]?.id) === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCityId(item.id)}
                  style={[s.chip, selected && s.chipActive]}
                >
                  <Text style={s.chipText}>
                    {locale === "ar" ? item.ar : item.en}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("contact")}
          </Text>
          <View style={s.contactGrid}>
            {contactTypes.map((item) => {
              const selected = contactType === item.type;
              return (
                <Pressable
                  key={item.type}
                  onPress={() => {
                    setContactType(item.type);
                    setContactValue(item.type === "whatsapp" ? "+966" : "");
                  }}
                  style={[s.contactOption, selected && s.contactOptionActive]}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={19}
                    color={BRAND.black}
                  />
                  <Text style={s.contactOptionText}>
                    {locale === "ar" ? item.ar : item.en}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[s.label, { textAlign: isRTL ? "right" : "left" }]}>
            {locale === "ar" ? "الرابط أو الرقم" : "URL or number"}{" "}
            <Text style={s.required}>*</Text>
          </Text>
          <TextInput
            value={contactValue}
            onChangeText={setContactValue}
            autoCapitalize="none"
            keyboardType={
              contactType === "phone" || contactType === "whatsapp"
                ? "phone-pad"
                : "url"
            }
            placeholder={
              contactType === "phone" || contactType === "whatsapp"
                ? "+9665XXXXXXXX"
                : "https://example.com"
            }
            placeholderTextColor={BRAND.muted}
            style={[s.field, { textAlign: isRTL ? "right" : "left" }]}
          />

          <Pressable
            onPress={publish}
            style={({ pressed }) => [s.publish, pressed && s.pressed]}
          >
            <Text style={s.publishText}>
              {locale === "ar" ? "نشر الإعلان الآن" : "Publish ad now"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: BRAND.black,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "900",
  },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 35,
  },
  notice: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F0D45E",
    borderRadius: 16,
    padding: 13,
    backgroundColor: "#FFF7D2",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeText: { flex: 1, color: BRAND.black, fontSize: 12, lineHeight: 19 },
  noticeStrong: { fontWeight: "900" },
  formCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    padding: 16,
    backgroundColor: BRAND.white,
  },
  upload: {
    height: 175,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D4D4D4",
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCopy: { alignItems: "center", justifyContent: "center", padding: 9 },
  uploadCopyMedia: { borderRadius: 12, backgroundColor: "rgba(0,0,0,.62)" },
  uploadTitle: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  uploadHelp: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
  },
  label: {
    marginTop: 14,
    marginBottom: 7,
    color: BRAND.black,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
  },
  required: { color: "#C00020" },
  field: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    backgroundColor: "#FBFBFB",
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
  },
  multiline: { height: 96, paddingTop: 12, textAlignVertical: "top" },
  chips: { gap: 7 },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF7D2" },
  chipText: {
    color: BRAND.black,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  contactGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  contactOption: {
    minHeight: 43,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 11,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  contactOptionActive: {
    borderColor: BRAND.yellowDark,
    backgroundColor: "#FFF7D2",
  },
  contactOptionText: {
    color: BRAND.black,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  publish: {
    minHeight: 51,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  publishText: {
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
  },
  pressed: { opacity: 0.7 },
  state: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  stateTitle: {
    color: BRAND.black,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
  },
});
