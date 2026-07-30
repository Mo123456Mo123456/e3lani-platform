import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, uploadFile } from "@/lib/api";
import { useAuth, useLocale } from "@/lib/app-context";

type Catalog = {
  categories: Array<{ id: string; nameAr: string; nameEn: string }>;
  regions: Array<{
    cities: Array<{ id: string; nameAr: string; nameEn: string }>;
  }>;
};

export default function CreateScreen() {
  const { authenticated } = useAuth();
  const { locale, rtl } = useLocale();
  const ar = locale === "ar";
  const [catalog, setCatalog] = useState<Catalog>({ categories: [], regions: [] });
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [contactType, setContactType] = useState<"WHATSAPP" | "PHONE" | "STORE_URL" | "EXTERNAL_URL">("WHATSAPP");
  const [contactValue, setContactValue] = useState("");
  const [scope, setScope] = useState<"CITY" | "NATIONWIDE">("CITY");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Catalog>("/catalog").then(setCatalog).catch(() => undefined);
  }, []);
  const cities = catalog.regions.flatMap((region) => region.cities);

  async function chooseMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const videos = result.assets.filter((asset) => asset.type === "video");
    const images = result.assets.filter((asset) => asset.type === "image");
    if (videos.length > 1 || (videos.length && images.length) || images.length > 5) {
      Alert.alert(ar ? "اختر فيديو واحدًا أو من صورة إلى خمس صور" : "Choose one video or one to five images");
      return;
    }
    if (videos.some((asset) => (asset.duration ?? 0) > 60_000)) {
      Alert.alert(ar ? "مدة الفيديو تتجاوز 60 ثانية" : "Video exceeds 60 seconds");
      return;
    }
    setMedia(result.assets);
  }

  async function uploadAll() {
    const ids: string[] = [];
    for (const asset of media) {
      if (!asset.fileSize || !asset.mimeType) throw new Error("MEDIA_METADATA_MISSING");
      const prepared = await api<{
        mediaId: string;
        uploadUrl: string;
      }>("/media/prepare", {
        method: "POST",
        body: JSON.stringify({
          fileName: asset.fileName ?? `media-${Date.now()}`,
          mimeType: asset.mimeType,
          sizeBytes: asset.fileSize,
          kind: asset.type === "video" ? "VIDEO" : "IMAGE",
          purpose: "POST",
        }),
      });
      await uploadFile(prepared.uploadUrl, asset.uri, asset.mimeType);
      await api("/media/complete", {
        method: "POST",
        body: JSON.stringify({ mediaId: prepared.mediaId }),
      });
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = await api<{ status: string; processingError?: string }>(
          `/media/${prepared.mediaId}/status`,
          { method: "POST" },
        );
        if (status.status === "READY") {
          ready = true;
          break;
        }
        if (status.status === "FAILED") throw new Error(status.processingError ?? "MEDIA_PROCESSING_FAILED");
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      if (!ready) throw new Error("MEDIA_PROCESSING_TIMEOUT");
      ids.push(prepared.mediaId);
    }
    return ids;
  }

  async function submit(publish: boolean) {
    if (!title.trim() || !categoryId || !cityId || !contactValue.trim() || media.length === 0) {
      Alert.alert(ar ? "أكمل الحقول المطلوبة والوسائط" : "Complete required fields and media");
      return;
    }
    setBusy(true);
    try {
      const mediaIds = await uploadAll();
      const post = await api<{ id: string }>("/content/posts", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          categoryId,
          cityId,
          mediaIds,
          contact: { type: contactType, value: contactValue },
          publish,
        }),
      });
      if (publish) {
        await api("/content/distributions", {
          method: "POST",
          body: JSON.stringify({
            postId: post.id,
            scope,
            cityIds: scope === "CITY" ? [cityId] : [],
            contact: { type: contactType, value: contactValue },
            promotionCodes: [],
          }),
        });
      }
      Alert.alert(
        ar ? "تم بنجاح" : "Done",
        publish ? (ar ? "نُشر الإعلان مباشرة." : "Your ad is live.") : ar ? "حُفظت المسودة." : "Draft saved.",
        [{ text: ar ? "حسنًا" : "OK", onPress: () => router.replace("/") }],
      );
    } catch (error) {
      Alert.alert(ar ? "تعذر إكمال العملية" : "Could not complete", error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.guestTitle}>{ar ? "سجّل دخولك لإضافة إعلان" : "Sign in to post an ad"}</Text>
        <Text style={styles.guestText}>{ar ? "التسجيل برقم الجوال ورمز تحقق فقط." : "Use your mobile number and OTP."}</Text>
        <Pressable onPress={() => router.push("/login")} style={styles.primary}>
          <Text style={styles.primaryText}>{ar ? "تسجيل الدخول" : "Sign in"}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { textAlign: rtl ? "right" : "left" }]}>{ar ? "أضف إعلانًا" : "Post an ad"}</Text>
        <Text style={[styles.help, { textAlign: rtl ? "right" : "left" }]}>
          {ar ? "ينشر الإعلان مباشرة بعد الفحص الآلي في وضع الإطلاق المجاني." : "Ads publish after automated checks in free launch mode."}
        </Text>

        <Text style={styles.label}>{ar ? "الصور أو الفيديو *" : "Photos or video *"}</Text>
        <Pressable onPress={chooseMedia} style={styles.mediaPicker}>
          <Text style={styles.mediaPickerText}>
            {media.length ? `${media.length} ${ar ? "ملفات مختارة" : "files selected"}` : ar ? "اختر 1–5 صور أو فيديو حتى 60 ثانية" : "Choose 1–5 images or a video up to 60s"}
          </Text>
        </Pressable>
        {media.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {media.map((asset) => <Image key={asset.assetId ?? asset.uri} source={{ uri: asset.uri }} style={styles.preview} />)}
          </ScrollView>
        ) : null}

        <Text style={styles.label}>{ar ? "العنوان *" : "Title *"}</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={120} style={styles.input} textAlign={rtl ? "right" : "left"} />
        <Text style={styles.label}>{ar ? "الوصف (اختياري)" : "Description (optional)"}</Text>
        <TextInput value={description} onChangeText={setDescription} maxLength={2000} multiline style={[styles.input, styles.textarea]} textAlign={rtl ? "right" : "left"} />

        <Text style={styles.label}>{ar ? "القسم *" : "Category *"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {catalog.categories.map((category) => (
            <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.chip, categoryId === category.id && styles.chipActive]}>
              <Text style={styles.chipText}>{ar ? category.nameAr : category.nameEn}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>{ar ? "المدينة *" : "City *"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {cities.map((city) => (
            <Pressable key={city.id} onPress={() => setCityId(city.id)} style={[styles.chip, cityId === city.id && styles.chipActive]}>
              <Text style={styles.chipText}>{ar ? city.nameAr : city.nameEn}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>{ar ? "نطاق العرض" : "Audience scope"}</Text>
        <View style={styles.row}>
          {(["CITY", "NATIONWIDE"] as const).map((value) => (
            <Pressable key={value} onPress={() => setScope(value)} style={[styles.chip, scope === value && styles.chipActive]}>
              <Text style={styles.chipText}>{value === "CITY" ? (ar ? "المدينة" : "City") : ar ? "كل المملكة" : "Saudi Arabia"}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{ar ? "وسيلة التواصل *" : "Contact method *"}</Text>
        <View style={styles.wrap}>
          {(["WHATSAPP", "PHONE", "STORE_URL", "EXTERNAL_URL"] as const).map((value) => (
            <Pressable key={value} onPress={() => setContactType(value)} style={[styles.chip, contactType === value && styles.chipActive]}>
              <Text style={styles.chipText}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={contactValue}
          onChangeText={setContactValue}
          autoCapitalize="none"
          keyboardType={contactType === "PHONE" || contactType === "WHATSAPP" ? "phone-pad" : "url"}
          placeholder={contactType.includes("URL") ? "https://…" : "05xxxxxxxx"}
          style={styles.input}
          textAlign="left"
        />

        {busy ? <ActivityIndicator size="large" color="#FFC400" style={{ marginTop: 20 }} /> : (
          <View style={styles.submitRow}>
            <Pressable onPress={() => void submit(false)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{ar ? "حفظ مسودة" : "Save draft"}</Text>
            </Pressable>
            <Pressable onPress={() => void submit(true)} style={styles.primary}>
              <Text style={styles.primaryText}>{ar ? "نشر الآن" : "Publish now"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F7F7F7" },
  heading: { fontSize: 30, fontWeight: "900", color: "#111111" },
  help: { color: "#666666", fontSize: 12, lineHeight: 20, marginTop: 5, marginBottom: 14 },
  guestTitle: { fontSize: 23, fontWeight: "900", textAlign: "center" },
  guestText: { fontSize: 13, color: "#666666", marginTop: 8, marginBottom: 20, textAlign: "center" },
  label: { color: "#111111", fontWeight: "900", fontSize: 13, marginTop: 18, marginBottom: 7, textAlign: "right" },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#DDDDDD", backgroundColor: "#FFFFFF", paddingHorizontal: 14, color: "#111111" },
  textarea: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
  mediaPicker: { minHeight: 100, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: "#FFC400", backgroundColor: "#FFF9E7", alignItems: "center", justifyContent: "center", padding: 18 },
  mediaPickerText: { fontWeight: "800", textAlign: "center", color: "#111111" },
  preview: { width: 82, height: 82, borderRadius: 12, marginTop: 9 },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: "#DDDDDD", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  chipActive: { borderColor: "#FFC400", backgroundColor: "#FFC400" },
  chipText: { fontSize: 11, color: "#111111", fontWeight: "800" },
  row: { flexDirection: "row", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  submitRow: { flexDirection: "row", gap: 10, marginTop: 28 },
  primary: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryText: { color: "#111111", fontWeight: "900", fontSize: 14 },
  secondary: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CCCCCC", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#111111", fontWeight: "900", fontSize: 14 },
});
