import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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

import { api, isSignedIn } from "@/lib/api";
import { uploadMediaAsset } from "@/lib/media-upload";

type Catalog = {
  regions: Array<{ cities: Array<{ id: string; nameAr: string }> }>;
  categories: Array<{
    id: string;
    nameAr: string;
    children: Array<{ id: string; nameAr: string }>;
  }>;
};

export default function CreateAdScreen() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [nationwide, setNationwide] = useState(false);
  const [contactType, setContactType] = useState<"WHATSAPP" | "PHONE" | "STORE">("WHATSAPP");
  const [contact, setContact] = useState("");
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isSignedIn().then((signedIn) => {
      if (!signedIn) router.push("/login");
    });
    void api<Catalog>("/catalog").then(setCatalog);
  }, []);

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 1,
    });
    if (result.canceled) return;
    const hasVideo = result.assets.some((asset) => asset.type === "video");
    if (hasVideo && result.assets.length !== 1) {
      Alert.alert("اختيار غير صالح", "اختر فيديو واحدًا أو من صورة إلى خمس صور.");
      return;
    }
    if (hasVideo && (result.assets[0]?.duration ?? 0) > 60_000) {
      Alert.alert("الفيديو طويل", "الحد الأقصى للفيديو 60 ثانية.");
      return;
    }
    setAssets(result.assets);
  }

  async function publish() {
    if (!title.trim() || !categoryId || !subcategoryId || (!nationwide && !cityId) || !contact || !assets.length) {
      Alert.alert("بيانات ناقصة", "أكمل الحقول المطلوبة وأضف صورة أو فيديو.");
      return;
    }
    setBusy(true);
    try {
      const mediaIds = [];
      for (const asset of assets) mediaIds.push(await uploadMediaAsset(asset));
      await api("/ads", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          categoryId,
          subcategoryId,
          cityId: nationwide ? undefined : cityId,
          audienceScope: nationwide ? "NATIONWIDE" : "CITY",
          mediaIds,
          contacts: [{ type: contactType, value: contact }],
        }),
      });
      Alert.alert("تم النشر", "أصبح إعلانك نشطًا بعد اجتياز الفحص الآلي.", [
        { text: "حسنًا", onPress: () => router.replace("/") },
      ]);
      setTitle("");
      setDescription("");
      setAssets([]);
    } catch (reason) {
      Alert.alert("تعذر النشر", reason instanceof Error ? reason.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  const selectedCategory = catalog?.categories.find((item) => item.id === categoryId);
  const cities = catalog?.regions.flatMap((region) => region.cities) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>أضف إعلانًا</Text>
      <Text style={styles.hint}>النشر مجاني حاليًا، والفحص آلي دون انتظار مراجعة بشرية.</Text>
      <Field label="العنوان *" value={title} onChangeText={setTitle} maxLength={120} />
      <Field
        label="الوصف"
        value={description}
        onChangeText={setDescription}
        maxLength={4000}
        multiline
      />
      <Text style={styles.label}>القسم الرئيسي *</Text>
      <View style={styles.options}>
        {catalog?.categories.map((category) => (
          <Choice
            key={category.id}
            selected={category.id === categoryId}
            label={category.nameAr}
            onPress={() => {
              setCategoryId(category.id);
              setSubcategoryId("");
            }}
          />
        ))}
      </View>
      {selectedCategory && (
        <>
          <Text style={styles.label}>القسم الفرعي *</Text>
          <View style={styles.options}>
            {selectedCategory.children.map((category) => (
              <Choice
                key={category.id}
                selected={category.id === subcategoryId}
                label={category.nameAr}
                onPress={() => setSubcategoryId(category.id)}
              />
            ))}
          </View>
        </>
      )}
      <Text style={styles.label}>نطاق العرض *</Text>
      <View style={styles.options}>
        <Choice selected={!nationwide} label="مدينة" onPress={() => setNationwide(false)} />
        <Choice selected={nationwide} label="كل المملكة" onPress={() => setNationwide(true)} />
      </View>
      {!nationwide && (
        <View style={styles.options}>
          {cities.map((city) => (
            <Choice
              key={city.id}
              selected={city.id === cityId}
              label={city.nameAr}
              onPress={() => setCityId(city.id)}
            />
          ))}
        </View>
      )}
      <Text style={styles.label}>وسيلة التواصل *</Text>
      <View style={styles.options}>
        {([
          ["WHATSAPP", "واتساب"],
          ["PHONE", "اتصال"],
          ["STORE", "رابط متجر"],
        ] as const).map(([value, label]) => (
          <Choice
            key={value}
            selected={contactType === value}
            label={label}
            onPress={() => setContactType(value)}
          />
        ))}
      </View>
      <Field
        label="رقم التواصل أو الرابط *"
        value={contact}
        onChangeText={setContact}
        textContentType={contactType === "STORE" ? "URL" : "telephoneNumber"}
      />
      <Text style={styles.label}>الصور أو الفيديو *</Text>
      <Pressable style={styles.mediaButton} onPress={() => void pickMedia()} disabled={busy}>
        <Text style={styles.mediaButtonText}>
          {assets.length ? `تم اختيار ${assets.length}` : "اختر حتى 5 صور أو فيديو حتى 60 ثانية"}
        </Text>
      </Pressable>
      <Pressable style={styles.publish} onPress={() => void publish()} disabled={busy}>
        {busy ? <ActivityIndicator color="#111" /> : <Text style={styles.publishText}>نشر الإعلان</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, multiline, ...inputProps } = props;
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        textAlign="right"
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function Choice({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}>
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 60, backgroundColor: "#F7F7F7", gap: 12 },
  heading: { fontSize: 29, fontWeight: "900", textAlign: "right" },
  hint: { textAlign: "right", color: "#666", lineHeight: 20 },
  label: { fontWeight: "800", textAlign: "right", marginBottom: 7, marginTop: 5 },
  input: { minHeight: 50, backgroundColor: "white", borderWidth: 1, borderColor: "#ddd", borderRadius: 13, paddingHorizontal: 14 },
  multiline: { height: 110, paddingTop: 12, textAlignVertical: "top" },
  options: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  choice: { backgroundColor: "white", borderWidth: 1, borderColor: "#ddd", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 },
  choiceSelected: { backgroundColor: "#FFC400", borderColor: "#FFC400" },
  choiceText: { fontWeight: "700" },
  mediaButton: { minHeight: 70, borderStyle: "dashed", borderWidth: 2, borderColor: "#999", borderRadius: 15, alignItems: "center", justifyContent: "center", padding: 12 },
  mediaButtonText: { fontWeight: "700", textAlign: "center" },
  publish: { minHeight: 54, backgroundColor: "#FFC400", borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 14 },
  publishText: { fontSize: 17, fontWeight: "900" },
});
