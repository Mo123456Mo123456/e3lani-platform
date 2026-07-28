import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { Field, OutlineButton, Pill, PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import {
  BRAND,
  type AdContact,
  type AdMedia,
  type ContactType,
  type PromotionCode,
} from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import {
  preferredMediaUrl,
  preparePickedMedia,
  startSignedUpload,
  type UploadController,
} from "@/lib/media-upload";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";
import {
  requiresPaymentForPublishing,
  resolveFeedAccessMode,
} from "@/shared/feed-access";
import { validateSaudiWhatsapp } from "@/shared/contact-validation";

type UploadStatus = "queued" | "processing" | "uploading" | "verifying" | "ready" | "failed";
type StepKey = "media" | "data" | "contact" | "promotion" | "preview";

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
  const productData = useProductData();
  const { locale, isRTL, t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [media, setMedia] = useState<AdMedia[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [promotions, setPromotions] = useState<PromotionCode[]>([]);
  const uploadControllers = useRef(new Map<string, UploadController>());
  const cancelledUploads = useRef(new Set<string>());
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const prepareUploadMutation = trpc.media.prepareUpload.useMutation();
  const completeUploadMutation = trpc.media.completeUpload.useMutation();
  const deleteMediaMutation = trpc.media.delete.useMutation();
  const createAdMutation = trpc.data.ads.create.useMutation();

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

  if (sessionQuery.isLoading || productData.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.gate}>
          <ActivityIndicator color={BRAND.yellowDark} size="large" />
          <Text style={styles.gateTitle}>{t("postTitle")}</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!sessionQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.gate}>
          <MaterialIcons name="lock" size={44} color={BRAND.yellowDark} />
          <Text style={styles.gateTitle}>{t("signIn")}</Text>
          <Text style={styles.gateBody}>
            {locale === "ar"
              ? "يتطلب النشر جلسة خادم موثقة. الدخول المحلي التجريبي لا ينشئ إعلانًا حقيقيًا."
              : "Publishing requires a verified server session. Local sandbox sign-in does not create a real ad."}
          </Text>
          <PrimaryButton label={t("signIn")} icon="login" onPress={() => router.replace("/login" as never)} />
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

  const feedAccessMode = resolveFeedAccessMode(productData.config.feedAccessMode);
  const publishingRequiresPayment = requiresPaymentForPublishing(feedAccessMode);
  const launchFree = feedAccessMode === "LAUNCH_FREE";
  const steps: StepKey[] = publishingRequiresPayment
    ? ["media", "data", "contact", "promotion", "preview"]
    : ["media", "data", "contact", "preview"];
  const currentStep = steps[stepIndex];

  if (publishingRequiresPayment && !productData.config.paymentEnabled) {
    return (
      <ScreenContainer>
        <View style={styles.gate}>
          <MaterialIcons name="payments" size={44} color={BRAND.warning} />
          <Text style={styles.gateTitle}>
            {locale === "ar" ? "النشر المدفوع غير متاح حاليًا" : "Paid publishing is currently unavailable"}
          </Text>
          <Text style={styles.gateBody}>
            {locale === "ar" ? "الدفع معطل من الخادم، لذلك لن يتم إنشاء أي عملية دفع تجريبية." : "Payment is disabled by the server, so no test payment will be created."}
          </Text>
          <PrimaryButton label={t("back")} icon="arrow-back" onPress={() => router.back()} />
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

  const togglePromotion = (code: PromotionCode) => {
    setPromotions((current) => {
      if (current.includes(code)) return current.filter((value) => value !== code);
      if (code === "highlight_3") return [...current.filter((value) => value !== "highlight_7"), code];
      if (code === "highlight_7") return [...current.filter((value) => value !== "highlight_3"), code];
      return [...current, code];
    });
  };

  const buildContacts = (): AdContact[] | null => {
    const result: AdContact[] = (
      [
        { type: "store", value: storeUrl.trim() },
        { type: "product", value: productUrl.trim() },
        { type: "phone", value: phone.trim() },
      ] as { type: ContactType; value: string }[]
    ).filter((item) => item.value);

    if (whatsapp.trim()) {
      const validated = validateSaudiWhatsapp(whatsapp);
      if (!validated.valid) {
        Alert.alert(
          locale === "ar" ? "رقم واتساب غير صحيح" : "Invalid WhatsApp number",
          locale === "ar" ? "أدخل رقمًا سعوديًا كاملًا مثل +9665XXXXXXXX. لا يمكن قبول +966 فقط." : "Enter a complete Saudi number such as +9665XXXXXXXX. +966 alone is not accepted.",
        );
        return null;
      }
      result.push({ type: "whatsapp", value: validated.normalized });
    }

    if (!result.length) {
      Alert.alert(
        locale === "ar" ? "وسيلة التواصل مطلوبة" : "Contact method required",
        locale === "ar" ? "أضف رابط متجر أو منتج أو رقم واتساب أو اتصال." : "Add a store link, product link, WhatsApp number, or phone number.",
      );
      return null;
    }

    return result;
  };

  const validateStep = (): boolean => {
    if (currentStep === "media") {
      if (uploads.some((item) => item.status !== "ready")) {
        Alert.alert(locale === "ar" ? "انتظر اكتمال رفع جميع الوسائط أو أعد محاولة الملفات المتعثرة." : "Wait for all uploads to finish or retry failed files.");
        return false;
      }
      if (!media.length) {
        Alert.alert(t("mediaHelp"));
        return false;
      }
    }

    if (currentStep === "data") {
      if (title.trim().length < 4) {
        Alert.alert(locale === "ar" ? "عنوان الإعلان قصير" : "Ad title is too short");
        return false;
      }
      if (!categoryId) {
        Alert.alert(locale === "ar" ? "اختر القسم" : "Choose a category");
        return false;
      }
      if (!cityId) {
        Alert.alert(locale === "ar" ? "اختر المدينة" : "Choose a city");
        return false;
      }
    }

    if (currentStep === "contact" && !buildContacts()) return false;
    return true;
  };

  const submit = async () => {
    const contacts = buildContacts();
    if (!contacts || createAdMutation.isPending) return;
    const mediaAssetIds = media
      .map((item) => item.mediaAssetId)
      .filter((value): value is number => typeof value === "number");
    if (mediaAssetIds.length !== media.length || !mediaAssetIds.length) {
      Alert.alert(
        locale === "ar" ? "الوسائط غير مكتملة" : "Media is incomplete",
        locale === "ar" ? "يجب اكتمال رفع الوسائط إلى الخادم قبل النشر." : "All media must finish uploading to the server before publishing.",
      );
      return;
    }

    try {
      const ad = await createAdMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        categoryCode: categoryId,
        cityCode: cityId,
        mediaAssetIds,
        contacts,
      });

      if (publishingRequiresPayment) {
        router.push({ pathname: "/checkout/[id]", params: { id: ad.id } } as never);
        return;
      }

      Alert.alert(
        locale === "ar" ? "تم إرسال إعلانك للمراجعة" : "Your ad was sent for review",
        locale === "ar" ? "حُفظ الإعلان في الحساب المركزي. النشر مجاني حاليًا وسيظهر بعد الموافقة." : "The ad was saved to your central account. Publishing is currently free and it will appear after approval.",
        [
          {
            text: locale === "ar" ? "عرض الإعلان" : "View ad",
            onPress: () => router.replace({ pathname: "/ad/[id]", params: { id: ad.id } } as never),
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "CORE_DATA_OPERATION_FAILED";
      Alert.alert(
        locale === "ar" ? "تعذر إنشاء الإعلان" : "Ad creation failed",
        locale === "ar"
          ? `لم يُحفظ الإعلان. تحقق من الاتصال والجلسة ثم أعد المحاولة. (${message})`
          : `The ad was not saved. Check your connection and session, then retry. (${message})`,
      );
    }
  };

  const next = () => {
    if (!validateStep()) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    void submit();
  };

  const quote = publishingRequiresPayment ? productData.calculateQuote(promotions) : null;
  const city = productData.cities.find((item) => item.id === cityId);
  const cityName = locale === "ar" ? city?.ar : city?.en;
  const finalLabel = createAdMutation.isPending
    ? locale === "ar"
      ? "جارٍ الحفظ..."
      : "Saving..."
    : publishingRequiresPayment
      ? t("pay")
      : locale === "ar"
        ? "إرسال للمراجعة مجانًا"
        : "Send for free review";

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <MaterialIcons name="close" size={27} color={BRAND.black} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("postTitle")}</Text>
        <Text style={styles.step}>{stepIndex + 1}/{steps.length}</Text>
      </View>
      <View style={styles.progressDots}>
        {steps.map((value, index) => (
          <View key={value} style={[styles.dot, { backgroundColor: index <= stepIndex ? BRAND.yellowDark : BRAND.border }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {launchFree ? (
          <View accessible accessibilityRole="summary" style={styles.freeBanner}>
            <MaterialIcons name="celebration" size={24} color={BRAND.black} />
            <View style={styles.freeBannerCopy}>
              <Text style={styles.freeBannerTitle}>{locale === "ar" ? "النشر مجاني حاليًا" : "Publishing is currently free"}</Text>
              <Text style={styles.freeBannerText}>{locale === "ar" ? "لن يظهر سعر أو دفع، وسيُرسل إعلانك مباشرة إلى المراجعة." : "No price or payment will be shown. Your ad goes directly to review."}</Text>
            </View>
          </View>
        ) : null}

        {currentStep === "media" ? (
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

        {currentStep === "data" ? (
          <View>
            <ScreenTitle title={t("data")} subtitle={locale === "ar" ? "اختر القسم والمدينة بنفسك. الوصف اختياري." : "Choose the category and city yourself. Description is optional."} />
            <Field label={t("adTitle")} value={title} onChangeText={setTitle} maxLength={120} />
            <Field label={`${t("description")} (${locale === "ar" ? "اختياري" : "optional"})`} value={description} onChangeText={setDescription} multiline maxLength={4000} />
            <Text style={styles.label}>{t("category")}</Text>
            <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
              {productData.categories.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={categoryId === item.id} onPress={() => setCategoryId(item.id)} />)}
            </ScrollView>
            <Text style={styles.label}>{t("city")}</Text>
            <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
              {productData.cities.map((item) => <Pill key={item.id} label={locale === "ar" ? item.ar : item.en} active={cityId === item.id} onPress={() => setCityId(item.id)} />)}
            </ScrollView>
          </View>
        ) : null}

        {currentStep === "contact" ? (
          <View>
            <ScreenTitle title={t("contact")} subtitle={locale === "ar" ? "أضف وسيلة واحدة على الأقل. رقم واتساب يجب أن يكون كاملًا." : "Add at least one contact method. WhatsApp must be a complete number."} />
            <Field label={t("store")} value={storeUrl} onChangeText={setStoreUrl} keyboardType="url" autoCapitalize="none" />
            <Field label={t("product")} value={productUrl} onChangeText={setProductUrl} keyboardType="url" autoCapitalize="none" />
            <Field label={t("whatsapp")} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="+9665XXXXXXXX" />
            <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        ) : null}

        {currentStep === "promotion" && publishingRequiresPayment ? (
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
            {quote ? (
              <View style={styles.quote}>
                <Text style={styles.quoteLabel}>{t("total")}</Text>
                <Text style={styles.quoteTotal}>{(quote.totalHalalas / 100).toFixed(2)} {t("sar")}</Text>
                <Text style={styles.quoteVat}>{t("vatIncluded")}: {(quote.vatHalalas / 100).toFixed(2)} {t("sar")}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {currentStep === "preview" ? (
          <View>
            <ScreenTitle title={t("preview")} subtitle={launchFree ? (locale === "ar" ? "سيُرسل الإعلان مباشرة للمراجعة دون دفع." : "The ad will be sent directly to review without payment.") : undefined} />
            <View style={styles.preview}>
              <MediaView media={media[0]} active />
              <View style={styles.scrim} />
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle}>{title}</Text>
                {description ? <Text numberOfLines={3} style={styles.previewDescription}>{description}</Text> : null}
                <Text style={styles.previewMeta}>{cityName}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.footerBack}>
          {stepIndex > 0 ? <OutlineButton label={t("previous")} icon="arrow-forward" onPress={() => setStepIndex((current) => current - 1)} /> : null}
        </View>
        <View style={styles.footerNext}>
          <PrimaryButton
            disabled={createAdMutation.isPending || (currentStep === "media" && uploads.some((item) => item.status !== "ready"))}
            label={currentStep === "preview" ? finalLabel : t("next")}
            icon={currentStep === "preview" ? (publishingRequiresPayment ? "payments" : "send") : "arrow-back"}
            onPress={next}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 18 },
  gateTitle: { color: BRAND.black, fontSize: 22, lineHeight: 30, fontWeight: "900", textAlign: "center" },
  gateBody: { maxWidth: 480, color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  header: { minHeight: 58, paddingHorizontal: 12, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900" },
  step: { width: 44, color: BRAND.muted, textAlign: "center", fontSize: 12 },
  progressDots: { height: 24, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  dot: { width: 26, height: 5, borderRadius: 3 },
  page: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 18, paddingBottom: 35 },
  freeBanner: { marginBottom: 18, borderWidth: 1, borderColor: BRAND.yellowDark, borderRadius: 20, padding: 14, backgroundColor: "#FFF8D6", flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  freeBannerCopy: { flex: 1 },
  freeBannerTitle: { color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900", textAlign: "right" },
  freeBannerText: { marginTop: 3, color: BRAND.charcoal, fontSize: 12, lineHeight: 19, textAlign: "right" },
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
  previewDescription: { marginTop: 7, color: BRAND.white, fontSize: 14, lineHeight: 22, textAlign: "right" },
  previewMeta: { marginTop: 10, color: BRAND.yellow, fontSize: 12, fontWeight: "900", textAlign: "right" },
  footer: { minHeight: 80, borderTopWidth: 1, borderTopColor: BRAND.border, paddingHorizontal: 15, paddingVertical: 10, alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: BRAND.white },
  footerBack: { flex: 1 },
  footerNext: { flex: 1, alignItems: "flex-end" },
});
