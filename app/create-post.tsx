import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { Field, PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import {
  preferredMediaUrl,
  preparePickedMedia,
  startSignedUpload,
} from "@/lib/media-upload";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";

type Upload = {
  id: string;
  kind: "image" | "video";
  uri: string;
  status: "uploading" | "ready" | "failed";
  progress: number;
  mediaAssetId?: number;
};

export default function CreatePost() {
  const { locale, isRTL } = useI18n();
  const product = useProductData();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const prepare = trpc.media.prepareUpload.useMutation();
  const complete = trpc.media.completeUpload.useMutation();
  const create = trpc.profilePosts.create.useMutation();
  const mine = trpc.advertisers.mine.useQuery();
  const idempotencyKey = useRef(
    `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`,
  );

  const patchUpload = (id: string, patch: Partial<Upload>) =>
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset, id: string) => {
    const policy = product.config?.mediaPolicy;
    if (!policy) return;
    try {
      const picked = await preparePickedMedia(asset, policy);
      patchUpload(id, { kind: picked.kind, uri: picked.uri, status: "uploading", progress: 0.08 });
      const ticket = await prepare.mutateAsync({
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        bytes: picked.bytes,
        width: picked.width,
        height: picked.height,
        durationMs: picked.durationMs,
      });
      const controller = startSignedUpload({
        uploadUrl: ticket.uploadUrl,
        headers: ticket.headers,
        media: picked,
        onProgress: (fraction) => patchUpload(id, { progress: 0.08 + fraction * 0.82 }),
      });
      await controller.promise;
      const media = await complete.mutateAsync({ ticket: ticket.ticket });
      patchUpload(id, {
        kind: media.mediaType,
        uri: preferredMediaUrl(media.originalUrl, media.variants),
        status: "ready",
        progress: 1,
        mediaAssetId: media.id,
      });
    } catch {
      patchUpload(id, { status: "failed" });
    }
  };

  const pick = async () => {
    const policy = product.config?.mediaPolicy;
    if (!policy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, policy.maxImages - uploads.length),
      videoMaxDuration: 60,
      quality: 1,
    });
    if (result.canceled) return;
    if (uploads.length + result.assets.length > policy.maxImages) {
      return Alert.alert(
        locale === "ar" ? `الحد الأقصى ${policy.maxImages} ملفات.` : `Maximum ${policy.maxImages} files.`,
      );
    }
    const incomingHasVideo = result.assets.some((asset) => asset.type === "video");
    if ((incomingHasVideo && (uploads.length || result.assets.length > 1)) || (uploads.some((item) => item.kind === "video") && result.assets.length)) {
      return Alert.alert(locale === "ar" ? "اختر فيديو واحدًا أو مجموعة صور." : "Choose one video or multiple images.");
    }
    result.assets.forEach((asset, index) => {
      const id = `post-upload-${Date.now()}-${index}`;
      setUploads((current) => [
        ...current,
        {
          id,
          kind: asset.type === "video" ? "video" : "image",
          uri: asset.uri,
          status: "uploading",
          progress: 0,
        },
      ]);
      void uploadAsset(asset, id);
    });
  };

  const publish = async () => {
    if (!title.trim() || !description.trim()) {
      return Alert.alert(locale === "ar" ? "أكمل العنوان والوصف." : "Complete title and description.");
    }
    if (uploads.some((item) => item.status === "uploading")) {
      return Alert.alert(locale === "ar" ? "انتظر اكتمال رفع الوسائط." : "Wait for media uploads.");
    }
    try {
      const post = await create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        mediaAssetIds: uploads
          .map((item) => item.mediaAssetId)
          .filter((id): id is number => typeof id === "number"),
        idempotencyKey: idempotencyKey.current,
      });
      Alert.alert(locale === "ar" ? "تم النشر" : "Published");
      const username = mine.data?.username ?? post.username;
      router.replace({ pathname: "/advertiser/[username]", params: { username } } as never);
    } catch (error) {
      Alert.alert(locale === "ar" ? "تعذر النشر" : "Publish failed", error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[s.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable onPress={() => router.back()} style={s.icon}>
          <MaterialIcons name="close" size={26} color={BRAND.black} />
        </Pressable>
        <Text style={s.headerTitle}>{locale === "ar" ? "منشور جديد" : "New post"}</Text>
        <View style={s.icon} />
      </View>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={locale === "ar" ? "محتوى صفحة المعلن" : "Advertiser profile content"}
          subtitle={locale === "ar" ? "هذا المنشور يظهر في صفحتك فقط، وليس في موجز الإعلانات." : "This post appears only on your profile, not in the main ad feed."}
        />
        <Field label={locale === "ar" ? "العنوان" : "Title"} value={title} onChangeText={setTitle} />
        <Field label={locale === "ar" ? "الوصف" : "Description"} value={description} onChangeText={setDescription} multiline />
        <PrimaryButton label={locale === "ar" ? "إضافة صور أو فيديو" : "Add photos or video"} icon="photo-library" onPress={() => void pick()} />
        <View style={s.mediaGrid}>
          {uploads.map((item) => (
            <View key={item.id} style={s.media}>
              <MediaView media={{ id: item.id, kind: item.kind, uri: item.uri }} />
              {item.status === "uploading" ? (
                <View style={s.overlay}>
                  <ActivityIndicator color={BRAND.yellow} />
                  <Text style={s.progress}>{Math.round(item.progress * 100)}%</Text>
                </View>
              ) : null}
              {item.status === "failed" ? (
                <View style={s.overlay}><Text style={s.failed}>{locale === "ar" ? "فشل الرفع" : "Upload failed"}</Text></View>
              ) : null}
              <Pressable onPress={() => setUploads((current) => current.filter((value) => value.id !== item.id))} style={s.remove}>
                <MaterialIcons name="close" size={18} color={BRAND.white} />
              </Pressable>
            </View>
          ))}
        </View>
        <PrimaryButton
          label={create.isPending ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "نشر الآن" : "Publish now")}
          icon="publish"
          onPress={() => void publish()}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: 10, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 18, fontWeight: "900" },
  page: { width: "100%", maxWidth: 700, alignSelf: "center", padding: 16, paddingBottom: 38, gap: 14 },
  mediaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  media: { width: 104, height: 140, borderRadius: 14, overflow: "hidden", backgroundColor: BRAND.charcoal },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", gap: 4 },
  progress: { color: BRAND.white, fontSize: 11, fontWeight: "900" },
  failed: { color: BRAND.white, fontSize: 11, fontWeight: "900" },
  remove: { position: "absolute", top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
});

