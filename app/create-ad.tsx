import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { Field, OutlineButton, Pill, PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { ACCOUNT_COUNTRIES } from "@/lib/countries";
import {
  BRAND,
  type AdContact,
  type AdMedia,
  type ContactType,
  type PromotionCode,
} from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { shouldShowPaymentUi } from "@/lib/launch-policy";
import { useI18n } from "@/lib/i18n";
import {
  preferredMediaUrl,
  preparePickedMedia,
  startSignedUpload,
  type UploadController,
} from "@/lib/media-upload";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";

type UploadStatus = "queued" | "processing" | "uploading" | "verifying" | "ready" | "failed";

type UploadItem = {
  id: string;
  source: ImagePicker.ImagePickerAsset;
  previewUri: string;
  kind: "image" | "video";
  status: UploadStatus;
  progress: number;
  mediaAssetId?: number;
  error?: string;
};

export default function CreateAd() {
  const store = useE3lani();
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const paymentVisible = shouldShowPaymentUi(store.launchPolicy);
  const totalSteps = paymentVisible ? 5 : 4;
  const [step, setStep] = useState(1);
  const [media, setMedia] = useState<AdMedia[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [adCountry, setAdCountry] = useState(store.accountCountry);
  const [storeUrl, setStoreUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("+966");
  const [phone, setPhone] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [promotions, setPromotions] = useState<PromotionCode[]>([]);
  const uploadControllers = useRef(new Map<string, UploadController>());
  const cancelledUploads = useRef(new Set<string>());
  const prepareUploadMutation = trpc.media.prepareUpload.useMutation();
  const completeUploadMutation = trpc.media.completeUpload.useMutation();
  const deleteMediaMutation = trpc.media.delete.useMutation();

  useEffect(() => {
    if (!categoryId && productData.categories[0]) setCategoryId(productData.categories[0].id);
    if (!cityId && productData.cities[0]) setCityId(productData.cities[0].id);
  }, [categoryId, cityId, productData.categories, productData.cities]);

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const mediaMessage = useCallback(
    (code: string) => {
      const messages: Record<string, [string, string]> = {
        MEDIA_TYPE_NOT_ALLOWED: ["الصيغة غير مدعومة. استخدم JPG أو PNG أو WebP أو MP4.", "Unsupported format. Use JPG, PNG, WebP, or MP4."],
        MEDIA_SIZE_EXCEEDED: ["حجم الملف أكبر من الحد المسموح.", "The file is larger than the allowed limit."],
        MEDIA_SIZE_INVALID: ["تعذر قراءة حجم الملف.", "The file size could not be read."],
        MEDIA_SIZE_MISMATCH: ["لم يكتمل نقل الملف كما يجب. أعد المحاولة.", "The transferred file is incomplete. Please retry."],
        MEDIA_UPLOAD_CANCELLED: ["أُلغي الرفع.", "Upload cancelled."],
        MEDIA_UPLOAD_NOT_FOUND: ["لم يصل الملف إلى التخزين. أعد المحاولة.", "The file did not reach storage. Please retry."],
        MEDIA_CONTENT_MISMATCH: ["محتوى الملف لا يطابق صيغته.", "The file contents do not match its format."],
        MEDIA_UPLOAD_FAILED: ["تعذر رفع الملف. تحقق من الشبكة ثم أعد المحاولة.", "Upload failed. Check the network and retry."],
        MEDIA_TICKET_EXPIRED: ["انتهت مهلة الرفع. أعد المحاولة.", "The upload expired. Please retry."],
      };
      return messages[code]?.[locale === "ar" ? 0 : 1] ?? (locale === "ar" ? "تعذرت معالجة الوسائط." : "Media processing failed.");
    },
    [locale],
  );

  const uploadAsset = useCallback(
    async (item: UploadItem) => {
      const policy = productData.config?.mediaPolicy;
      if (!policy) return;
      cancelledUploads.current.delete(item.id);
      try {
        updateUpload(item.id, { status: "processing", progress: 0.04, error: undefined });
        const prepared = await preparePickedMedia(item.source, policy);
        if (cancelledUploads.current.has(item.id)) throw new Error("MEDIA_UPLOAD_CANCELLED");
        updateUpload(item.id, {
          previewUri: prepared.uri,
          kind: prepared.kind,
          status: "uploading",
          progress: 0.08,
        });
        const ticket = await prepareUploadMutation.mutateAsync({
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          bytes: prepared.bytes,
          width: prepared.width,
          height: prepared.height,
          durationMs: prepared.durationMs,
        });
        if (cancelledUploads.current.has(item.id)) throw new Error("MEDIA_UPLOAD_CANCELLED");
        const controller = startSignedUpload({
          uploadUrl: ticket.uploadUrl,
          headers: ticket.headers,
          media: prepared,
          onProgress: (fraction) => updateUpload(item.id, { progress: 0.08 + fraction * 0.78 }),
        });
        uploadControllers.current.set(item.id, controller);
        await controller.promise;
        uploadControllers.current.delete(item.id);
        if (cancelledUploads.current.has(item.id)) throw new Error("MEDIA_UPLOAD_CANCELLED");
        updateUpload(item.id, { status: "verifying", progress: 0.9 });
        const asset = await completeUploadMutation.mutateAsync({ ticket: ticket.ticket });
        if (cancelledUploads.current.has(item.id)) {
          await deleteMediaMutation.mutateAsync({ mediaAssetId: asset.id }).catch(() => undefined);
          throw new Error("MEDIA_UPLOAD_CANCELLED");
        }
        const uri = preferredMediaUrl(asset.originalUrl, asset.variants);
        const saved: AdMedia = {
          id: `media-${asset.id}`,
          mediaAssetId: asset.id,
          kind: asset.mediaType,
          uri,
          processingStatus: "ready",
        };
        setMedia((current) => [...current.filter((value) => value.id !== saved.id), saved]);
        updateUpload(item.id, {
          previewUri: uri,
          kind: asset.mediaType,
          mediaAssetId: asset.id,
          status: "ready",
          progress: 1,
        });
        cancelledUploads.current.delete(item.id);
      } catch (error) {
        uploadControllers.current.delete(item.id);
        if (cancelledUploads.current.delete(item.id)) return;
        const code = error instanceof Error ? error.message : "MEDIA_UPLOAD_FAILED";
        updateUpload(item.id, { status: "failed", error: mediaMessage(code) });
      }
    },
    [completeUploadMutation, deleteMediaMutation, mediaMessage, prepareUploadMutation, productData.config?.mediaPolicy, updateUpload],
  );

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

  if (productData.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.gate}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
          <Text style={styles.gateTitle}>{t("postTitle")}</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (
    productData.isError ||
    !productData.config ||
    !productData.categories.length ||
    !productData.cities.length
  ) {
    return (
      <ScreenContainer>
        <View style={styles.gate}>
          <MaterialIcons name="cloud-off" size={44} color={BRAND.error} />
          <Text style={styles.gateTitle}>{t("error")}</Text>
          <PrimaryButton label={t("retry")} icon="refresh" onPress={productData.retry} />
        </View>
      </ScreenContainer>
    );
  }

  const pickMedia = async () => {
    const policy = productData.config?.mediaPolicy;
    if (!policy) return Alert.alert(t("error"));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: policy.maxImages,
      quality: 1,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const incomingHasVideo = result.assets.some((asset) => asset.type === "video");
    const existingHasVideo = uploads.some((item) => item.kind === "video");
    if (
      (incomingHasVideo && (result.assets.length > policy.maxVideos || uploads.length > 0)) ||
      (existingHasVideo && result.assets.length > 0)
    ) {
      return Alert.alert(locale === "ar" ? "اختر فيديو واحدًا أو مجموعة صور، وليس كليهما." : "Choose one video or a set of images, not both.");
    }
    if (!incomingHasVideo && uploads.length + result.assets.length > policy.maxImages) {
      return Alert.alert(locale === "ar" ? `الحد الأقصى ${policy.maxImages} صور.` : `The maximum is ${policy.maxImages} images.`);
    }

    const selected: UploadItem[] = result.assets.map((asset, index) => ({
      id: `upload-${Date.now()}-${index}`,
      source: asset,
      previewUri: asset.uri,
      kind: asset.type === "video" ? "video" : "image",
      status: "queued",
      progress: 0,
    }));
    setUploads((current) => [...current, ...selected]);
    selected.forEach((item) => void uploadAsset(item));
  };

  const removeUpload = async (item: UploadItem) => {
    cancelledUploads.current.add(item.id);
    const controller = uploadControllers.current.get(item.id);
    if (controller) await controller.cancel().catch(() => undefined);
    uploadControllers.current.delete(item.id);
    if (item.mediaAssetId) {
      try {
        await deleteMediaMutation.mutateAsync({ mediaAssetId: item.mediaAssetId });
      } catch {
        Alert.alert(t("error"));
        return;
      }
    }
    setUploads((current) => current.filter((value) => value.id !== item.id));
    setMedia((current) => current.filter((value) => value.mediaAssetId !== item.mediaAssetId));
    if (item.status === "ready" || item.status === "failed") cancelledUploads.current.delete(item.id);
  };

  const contacts: AdContact[] = (
    [
      { type: "store", value: storeUrl },
      { type: "product", value: productUrl },
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
    if (step === 1 && uploads.some((item) => item.status !== "ready")) {
      return Alert.alert(locale === "ar" ? "انتظر اكتمال رفع جميع الوسائط أو أعد محاولة الملفات المتعثرة." : "Wait for all uploads to finish or retry failed files.");
    }
    if (step === 1 && !media.length) return Alert.alert(t("mediaHelp"));
    if (step === 2 && (title.trim().length < 4 || description.trim().length < 20)) return Alert.alert(t("error"));
    if (step === 3 && !contacts.length) return Alert.alert(t("contact"));
    if (paymentVisible && step === 4) {
      setStep(5);
      return;
    }
    if (step < totalSteps) {
      setStep((current) => current + 1);
      return;
    }
    const resolvedCityId =
      cityId === "other" ? `other:${customCity.trim() || "unspecified"}` : cityId;
    const ad = store.createAd({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      cityId: resolvedCityId,
      countryCode: adCountry,
      contacts,
      promotions: paymentVisible ? promotions : [],
      media,
    });
    if (paymentVisible && ad.status === "awaiting_payment") {
      router.push({ pathname: "/checkout/[id]", params: { id: ad.id } } as never);
      return;
    }
    Alert.alert(t("success"), t("freePublish"));
    router.replace("/(tabs)" as never);
  };

  const quote = paymentVisible
    ? productData.calculateQuote(promotions)
    : { items: [] as PromotionCode[], totalHalalas: 0, vatHalalas: 0 };
  const city = productData.cities.find((item) => item.id === cityId);
  const cityName =
    cityId === "other"
      ? customCity.trim() || (locale === "ar" ? "مدينة أخرى" : "Other city")
      : locale === "ar"
        ? city?.ar
        : city?.en;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <MaterialIcons name="close" size={27} color={BRAND.black} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("postTitle")}</Text>
        <Text style={styles.step}>{step}/{totalSteps}</Text>
      </View>
      <View style={styles.progressDots}>
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map((value) => (
          <View key={value} style={[styles.dot, { backgroundColor: value <= step ? BRAND.yellowDark : BRAND.border }]} />
        ))}
      </View>

      {!paymentVisible ? (
        <View style={styles.freeBanner}>
          <Text style={styles.freeBannerTitle}>{t("freePublish")}</Text>
          <Text style={styles.freeBannerText}>{t("freePublishHelp")}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <View>
            <ScreenTitle title={t("media")} subtitle={t("mediaHelp")} />
            <View style={styles.pick}><PrimaryButton label={t("addMedia")} icon="photo-library" onPress={pickMedia} /></View>
            <ScrollView horizontal contentContainerStyle={styles.mediaList} showsHorizontalScrollIndicator={false}>
              {uploads.map((item) => {
                const label = item.status === "processing"
                  ? locale === "ar" ? "معالجة" : "Processing"
                  : item.status === "uploading"
                    ? locale === "ar" ? "رفع" : "Uploading"
                    : item.status === "verifying"
                      ? locale === "ar" ? "تحقق" : "Verifying"
                      : item.status === "ready"
                        ? locale === "ar" ? "جاهز" : "Ready"
                        : item.status === "failed"
                          ? locale === "ar" ? "تعثر" : "Failed"
                          : locale === "ar" ? "انتظار" : "Queued";
                return (
                  <View key={item.id} style={styles.uploadCard}>
                    <View style={styles.thumb}>
                      <MediaView media={{ id: item.id, kind: item.kind, uri: item.previewUri }} />
                      {item.status !== "ready" && item.status !== "failed" ? (
                        <View style={styles.uploadOverlay}><ActivityIndicator color={BRAND.yellow} /></View>
                      ) : null}
                    </View>
                    <View style={styles.uploadMeta}>
                      <Text numberOfLines={1} style={[styles.uploadStatus, item.status === "failed" && styles.uploadFailed]}>{label}</Text>
                      <Text style={styles.uploadPercent}>{Math.round(item.progress * 100)}%</Text>
                    </View>
                    <View style={styles.uploadTrack}><View style={[styles.uploadFill, { width: `${Math.round(item.progress * 100)}%` }]} /></View>
                    {item.error ? <Text numberOfLines={2} style={styles.uploadError}>{item.error}</Text> : null}
                    <View style={styles.uploadActions}>
                      {item.status === "failed" ? (
                        <Pressable accessibilityRole="button" onPress={() => void uploadAsset(item)} style={styles.iconAction}>
                          <MaterialIcons name="refresh" size={20} color={BRAND.black} />
                        </Pressable>
                      ) : null}
                      <Pressable accessibilityRole="button" onPress={() => void removeUpload(item)} style={styles.iconAction}>
                        <MaterialIcons name={item.status === "ready" ? "delete-outline" : "close"} size={20} color={BRAND.error} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
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
              {productData.categories.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={categoryId === item.id} onPress={() => setCategoryId(item.id)} />)}
            </ScrollView>
            <Text style={styles.label}>{locale === "ar" ? "دولة الإعلان" : "Ad country"}</Text>
            <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
              {ACCOUNT_COUNTRIES.map((country) => (
                <Pill
                  key={country.code}
                  label={`${country.flag} ${locale === "ar" ? country.nameAr : country.nameEn}`}
                  active={adCountry === country.code}
                  onPress={() => setAdCountry(country.code)}
                />
              ))}
            </ScrollView>
            <Text style={styles.label}>{t("city")}</Text>
            <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
              {productData.cities.map((item) => (
                <Pill
                  key={item.id}
                  label={locale === "ar" ? item.ar : item.en}
                  active={cityId === item.id}
                  onPress={() => setCityId(item.id)}
                />
              ))}
              <Pill
                label={locale === "ar" ? "مدينة أخرى" : "Other city"}
                active={cityId === "other"}
                onPress={() => setCityId("other")}
              />
            </ScrollView>
            {cityId === "other" ? (
              <Field
                label={locale === "ar" ? "اسم المدينة" : "City name"}
                value={customCity}
                onChangeText={setCustomCity}
                maxLength={80}
              />
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <ScreenTitle title={t("contact")} />
            <Field label={t("store")} value={storeUrl} onChangeText={setStoreUrl} keyboardType="url" autoCapitalize="none" />
            <Field label={t("product")} value={productUrl} onChangeText={setProductUrl} keyboardType="url" autoCapitalize="none" />
            <Field label={t("whatsapp")} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
            <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        ) : null}

        {paymentVisible && step === 4 ? (
          <View>
            <ScreenTitle title={t("promotion")} />
            {productData.promotions.map((option) => {
              const active = promotions.includes(option.code);
              return (
                <Pressable
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${locale === "ar" ? option.ar : option.en}، ${option.priceHalalas / 100} ${t("sar")}`}
                  accessibilityState={{ checked: active }}
                  key={option.code}
                  onPress={() => togglePromotion(option.code)}
                  style={[styles.promotion, active && styles.promotionActive]}
                >
                  <MaterialIcons accessible={false} name={active ? "check-circle" : "radio-button-unchecked"} size={24} color={active ? BRAND.yellowDark : BRAND.muted} />
                  <Text style={styles.promotionName}>{locale === "ar" ? option.ar : option.en}</Text>
                  <Text style={styles.promotionPrice}>{(option.priceHalalas / 100).toFixed(2)} {t("sar")}</Text>
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

        {step === totalSteps ? (
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
          <PrimaryButton
            disabled={step === 1 && uploads.some((item) => item.status !== "ready")}
            label={step === totalSteps ? (paymentVisible ? t("pay") : t("publishNow")) : t("next")}
            icon={step === totalSteps ? (paymentVisible ? "payments" : "campaign") : "arrow-back"}
            onPress={next}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 18 },
  gateTitle: { color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  freeBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0d45e",
    backgroundColor: "#fff7d2",
  },
  freeBannerTitle: { color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" },
  freeBannerText: { marginTop: 4, color: BRAND.black, fontSize: 12, lineHeight: 18, textAlign: "right" },
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900" },
  step: { width: 44, color: BRAND.muted, textAlign: "center", fontSize: 12 },
  progressDots: { height: 24, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  dot: { width: 26, height: 5, borderRadius: 3 },
  page: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 18, paddingBottom: 35 },
  pick: { marginTop: 18 },
  mediaList: { gap: 9, paddingTop: 15 },
  uploadCard: { width: 154, borderRadius: 17, padding: 6, backgroundColor: BRAND.surface, borderWidth: 1, borderColor: BRAND.border },
  thumb: { width: 140, height: 164, borderRadius: 13, overflow: "hidden", backgroundColor: BRAND.charcoal },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center" },
  uploadMeta: { marginTop: 7, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 5 },
  uploadStatus: { flex: 1, color: BRAND.black, fontSize: 11, lineHeight: 16, fontWeight: "900", textAlign: "right" },
  uploadFailed: { color: BRAND.error },
  uploadPercent: { color: BRAND.muted, fontSize: 10, fontWeight: "800" },
  uploadTrack: { height: 5, marginTop: 5, borderRadius: 3, overflow: "hidden", backgroundColor: BRAND.border },
  uploadFill: { height: 5, borderRadius: 3, backgroundColor: BRAND.yellowDark },
  uploadError: { minHeight: 30, marginTop: 5, color: BRAND.error, fontSize: 9, lineHeight: 14, textAlign: "right" },
  uploadActions: { minHeight: 36, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 },
  iconAction: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.white },
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
