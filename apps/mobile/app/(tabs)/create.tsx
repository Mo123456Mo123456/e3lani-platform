import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, colors } from "@/lib/api";

type Category = { id: string; nameAr: string; children: Array<{ id: string; nameAr: string }> };
type City = { id: string; nameAr: string };
type Picked = ImagePicker.ImagePickerAsset;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CreateAdScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [media, setMedia] = useState<Picked[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [scope, setScope] = useState<"CITY" | "KINGDOM">("CITY");
  const [contactType, setContactType] = useState<"WHATSAPP" | "PHONE" | "STORE" | "PRODUCT" | "EXTERNAL">("WHATSAPP");
  const [contactValue, setContactValue] = useState("+9665");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const subcategories = useMemo(
    () => categories.find((category) => category.id === categoryId)?.children ?? [],
    [categories, categoryId]
  );

  useEffect(() => {
    void apiFetch<{ categories: Category[]; regions: Array<{ cities: City[] }> }>("/catalog")
      .then((result) => {
        setCategories(result.categories);
        setCities(result.regions.flatMap((region) => region.cities));
      })
      .catch(() => setMessage("تعذر تحميل بيانات الأقسام والمدن."));
  }, []);

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9
    });
    if (result.canceled) return;
    const hasVideo = result.assets.some((asset) => asset.type === "video");
    if (hasVideo && result.assets.length !== 1) {
      setMessage("اختر فيديو واحدًا فقط أو من صورة إلى خمس صور.");
      return;
    }
    setMedia(result.assets.slice(0, 5));
    setMessage("");
  }

  async function upload(asset: Picked, order: number) {
    const blob = await fetch(asset.uri).then((response) => response.blob());
    const prepared = await apiFetch<{ assetId: string; uploadUrl: string; headers: Record<string, string> }>("/media/prepare", {
      method: "POST",
      body: JSON.stringify({
        fileName: asset.fileName ?? (asset.type === "video" ? "ad.mp4" : "ad.jpg"),
        contentType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        size: blob.size
      })
    });
    const response = await fetch(prepared.uploadUrl, { method: "PUT", headers: prepared.headers, body: blob });
    if (!response.ok) throw new Error("UPLOAD_FAILED");
    await apiFetch(`/media/${prepared.assetId}/complete`, { method: "POST" });
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const status = await apiFetch<{ status: string; rejectionCode?: string }>(`/media/${prepared.assetId}`);
      if (status.status === "READY") return { assetId: prepared.assetId, order };
      if (["FAILED", "REJECTED"].includes(status.status)) throw new Error(status.rejectionCode ?? "PROCESSING_FAILED");
      await sleep(1000);
    }
    throw new Error("PROCESSING_TIMEOUT");
  }

  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/auth/me");
      const uploaded = [];
      for (const [order, asset] of media.entries()) uploaded.push(await upload(asset, order));
      await apiFetch("/ads", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          categoryId,
          subcategoryId,
          cityId,
          scope,
          media: uploaded,
          contact: { type: contactType, value: contactValue }
        })
      });
      setMessage("تم نشر إعلانك مباشرة بنجاح.");
      setMedia([]);
      setTitle("");
      setDescription("");
    } catch (error) {
      if (error instanceof Error && error.message.includes("401")) router.push("/login");
      else setMessage("تعذر نشر الإعلان. تحقق من الوسائط والحقول والرابط ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  const valid =
    media.length > 0 &&
    title.trim().length >= 3 &&
    categoryId &&
    subcategoryId &&
    cityId &&
    (contactType === "WHATSAPP" || contactType === "PHONE"
      ? /^\+9665\d{8}$/.test(contactValue)
      : contactValue.startsWith("https://"));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>أضف إعلانًا</Text>
      <Text style={styles.subtitle}>يُنشر مباشرة بعد الفحص الآلي. النشر مجاني حاليًا.</Text>
      <Pressable style={styles.mediaPicker} onPress={() => void pickMedia()}>
        <Text style={styles.mediaText}>{media.length ? `تم اختيار ${media.length} وسائط` : "اختر فيديو واحدًا أو 1–5 صور"}</Text>
      </Pressable>
      {!!media.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {media.map((asset) => <Image key={asset.assetId ?? asset.uri} source={asset.uri} style={styles.preview} contentFit="cover" />)}
        </ScrollView>
      )}
      <TextInput value={title} onChangeText={setTitle} placeholder="عنوان الإعلان *" style={styles.input} textAlign="right" maxLength={120} />
      <TextInput value={description} onChangeText={setDescription} placeholder="الوصف (اختياري)" style={[styles.input, styles.textarea]} textAlign="right" multiline maxLength={2000} />
      <Text style={styles.label}>القسم الرئيسي</Text>
      <View style={styles.options}>{categories.map((category) => <Pressable key={category.id} onPress={() => { setCategoryId(category.id); setSubcategoryId(""); }} style={[styles.option, categoryId === category.id && styles.selected]}><Text>{category.nameAr}</Text></Pressable>)}</View>
      {!!categoryId && <><Text style={styles.label}>القسم الفرعي</Text><View style={styles.options}>{subcategories.map((item) => <Pressable key={item.id} onPress={() => setSubcategoryId(item.id)} style={[styles.option, subcategoryId === item.id && styles.selected]}><Text>{item.nameAr}</Text></Pressable>)}</View></>}
      <Text style={styles.label}>المدينة</Text>
      <View style={styles.options}>{cities.map((city) => <Pressable key={city.id} onPress={() => setCityId(city.id)} style={[styles.option, cityId === city.id && styles.selected]}><Text>{city.nameAr}</Text></Pressable>)}</View>
      <Text style={styles.label}>نطاق العرض</Text>
      <View style={styles.options}><Pressable onPress={() => setScope("CITY")} style={[styles.option, scope === "CITY" && styles.selected]}><Text>المدينة</Text></Pressable><Pressable onPress={() => setScope("KINGDOM")} style={[styles.option, scope === "KINGDOM" && styles.selected]}><Text>جميع المملكة</Text></Pressable></View>
      <Text style={styles.label}>وسيلة التواصل</Text>
      <View style={styles.options}>{([["WHATSAPP", "واتساب"], ["PHONE", "اتصال"], ["STORE", "متجر"], ["PRODUCT", "منتج"], ["EXTERNAL", "رابط خارجي"]] as const).map(([value, label]) => <Pressable key={value} onPress={() => { setContactType(value); setContactValue(value === "WHATSAPP" || value === "PHONE" ? "+9665" : "https://"); }} style={[styles.option, contactType === value && styles.selected]}><Text>{label}</Text></Pressable>)}</View>
      <TextInput value={contactValue} onChangeText={setContactValue} style={styles.input} textAlign="left" autoCapitalize="none" keyboardType={contactType === "PHONE" || contactType === "WHATSAPP" ? "phone-pad" : "url"} />
      {!!message && <Text style={styles.message}>{message}</Text>}
      <Pressable disabled={!valid || busy} onPress={() => void publish()} style={[styles.publish, (!valid || busy) && { opacity: 0.45 }]}>
        {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.publishText}>نشر الإعلان</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.muted },
  content: { padding: 16, paddingTop: 52, paddingBottom: 40, gap: 12 },
  heading: { textAlign: "right", fontSize: 30, fontWeight: "900" },
  subtitle: { textAlign: "right", color: "#666", marginBottom: 4 },
  mediaPicker: { minHeight: 90, borderWidth: 2, borderStyle: "dashed", borderColor: colors.brand, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff9db" },
  mediaText: { fontWeight: "800" },
  previewRow: { gap: 8 },
  preview: { width: 82, height: 100, borderRadius: 12, backgroundColor: "#111" },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#ddd", backgroundColor: "white", paddingHorizontal: 14 },
  textarea: { height: 100, paddingTop: 14, textAlignVertical: "top" },
  label: { textAlign: "right", fontWeight: "900", marginTop: 4 },
  options: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  option: { borderWidth: 1, borderColor: "#ddd", backgroundColor: "white", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  selected: { borderColor: colors.brand, backgroundColor: colors.brand },
  message: { textAlign: "right", borderRadius: 12, backgroundColor: "white", padding: 12 },
  publish: { height: 52, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 6 },
  publishText: { fontSize: 16, fontWeight: "900" }
});
