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

import { api, saveSession } from "@/lib/api";

type Stage = "phone" | "code" | "profile";
type AccountType = "INDIVIDUAL" | "STORE" | "BRAND" | "COMPANY";

export default function LoginScreen() {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("INDIVIDUAL");
  const [cities, setCities] = useState<Array<{ id: string; nameAr: string }>>([]);
  const [cityId, setCityId] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stage !== "profile") return;
    void api<{ regions: Array<{ cities: Array<{ id: string; nameAr: string }> }> }>("/catalog").then(
      (result) => setCities(result.regions.flatMap((region) => region.cities)),
    );
  }, [stage]);

  async function submit() {
    setBusy(true);
    try {
      if (stage === "phone") {
        await api("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) });
        setStage("code");
      } else if (stage === "code") {
        const session = await api<{
          accessToken: string;
          refreshToken: string;
          profileComplete: boolean;
        }>("/auth/otp/verify", {
          method: "POST",
          body: JSON.stringify({ phone, code, deviceName: "E3lani Mobile" }),
        });
        await saveSession(session);
        if (session.profileComplete) router.back();
        else setStage("profile");
      } else {
        if (!name.trim() || !cityId || !consent || (accountType !== "INDIVIDUAL" && !email)) {
          throw new Error("أكمل البيانات المطلوبة ووافق على الشروط والسياسة.");
        }
        await api("/auth/profile", {
          method: "POST",
          body: JSON.stringify({
            name,
            cityId,
            accountType,
            email: email || undefined,
            acceptedTerms: true,
            acceptedPrivacy: true,
          }),
        });
        router.replace("/");
      }
    } catch (reason) {
      Alert.alert("تعذر المتابعة", reason instanceof Error ? reason.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.logo}>إعلاني</Text>
      <Text style={styles.tagline}>منصة الإعلانات المرئية لكل شيء</Text>
      {stage === "phone" && (
        <Field
          label="رقم الجوال"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
      )}
      {stage === "code" && (
        <>
          <Text style={styles.info}>أرسلنا رمز تحقق إلى {phone}</Text>
          <Field
            label="رمز التحقق"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
          />
        </>
      )}
      {stage === "profile" && (
        <>
          <Field label="الاسم *" value={name} onChangeText={setName} />
          <Text style={styles.label}>نوع الحساب *</Text>
          <View style={styles.choices}>
            {([
              ["INDIVIDUAL", "فرد"],
              ["STORE", "متجر"],
              ["BRAND", "براند"],
              ["COMPANY", "شركة"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.choice, accountType === value && styles.selected]}
                onPress={() => setAccountType(value)}
              >
                <Text style={styles.choiceText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label={accountType === "INDIVIDUAL" ? "البريد الإلكتروني (اختياري)" : "البريد الإلكتروني *"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.label}>المدينة *</Text>
          <View style={styles.choices}>
            {cities.map((city) => (
              <Pressable
                key={city.id}
                style={[styles.choice, cityId === city.id && styles.selected]}
                onPress={() => setCityId(city.id)}
              >
                <Text style={styles.choiceText}>{city.nameAr}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.consent} onPress={() => setConsent((value) => !value)}>
            <View style={[styles.checkbox, consent && styles.checkboxSelected]} />
            <Text style={styles.consentText}>أوافق على الشروط والأحكام وسياسة الخصوصية</Text>
          </Pressable>
        </>
      )}
      <Pressable style={styles.submit} onPress={() => void submit()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={styles.submitText}>
            {stage === "phone" ? "إرسال الرمز" : stage === "code" ? "تحقق" : "إنشاء الحساب"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} textAlign="right" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, justifyContent: "center", backgroundColor: "#F7F7F7" },
  logo: { fontSize: 42, fontWeight: "900", color: "#111", textAlign: "center" },
  tagline: { textAlign: "center", color: "#666", marginTop: 5, marginBottom: 28 },
  info: { textAlign: "right", marginBottom: 10, color: "#555" },
  field: { marginBottom: 15 },
  label: { textAlign: "right", fontWeight: "800", marginBottom: 7 },
  input: { minHeight: 53, borderWidth: 1, borderColor: "#ddd", backgroundColor: "white", borderRadius: 14, paddingHorizontal: 15 },
  choices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 15 },
  choice: { borderWidth: 1, borderColor: "#ddd", backgroundColor: "white", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  selected: { borderColor: "#FFC400", backgroundColor: "#FFC400" },
  choiceText: { fontWeight: "700" },
  consent: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginVertical: 15 },
  checkbox: { width: 23, height: 23, borderWidth: 2, borderColor: "#999", borderRadius: 6 },
  checkboxSelected: { backgroundColor: "#FFC400", borderColor: "#111" },
  consentText: { flex: 1, textAlign: "right", lineHeight: 21 },
  submit: { minHeight: 55, borderRadius: 15, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitText: { fontWeight: "900", fontSize: 17 },
});
