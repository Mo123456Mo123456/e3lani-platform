import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { apiFetch, colors, saveSession } from "@/lib/api";

type City = { id: string; nameAr: string };

export default function LoginScreen() {
  const [step, setStep] = useState<"register" | "otp">("register");
  const [phone, setPhone] = useState("+9665");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("INDIVIDUAL");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void apiFetch<{ regions: { cities: City[] }[] }>("/catalog")
      .then((result) => setCities(result.regions.flatMap((region) => region.cities)))
      .catch(() => setError("تعذر تحميل المدن."));
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (step === "register") {
        await apiFetch("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) });
        setStep("otp");
      } else {
        const session = await apiFetch<{ accessToken: string; refreshToken: string }>("/auth/otp/verify", {
          method: "POST",
          body: JSON.stringify({ phone, code, name, email: email || undefined, accountType, cityId, acceptedTerms: accepted })
        });
        await saveSession(session.accessToken, session.refreshToken);
        router.back();
      }
    } catch {
      setError(step === "register" ? "تعذر إرسال الرمز. تحقق من رقم الجوال." : "الرمز غير صحيح أو منتهي الصلاحية.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>إعلاني</Text>
        <Text style={styles.heading}>الدخول أو إنشاء حساب</Text>
        <Text style={styles.subheading}>برقم الجوال ورمز تحقق لمرة واحدة.</Text>
        {step === "register" ? (
          <View style={styles.form}>
            <TextInput value={name} onChangeText={setName} placeholder="الاسم" style={styles.input} textAlign="right" />
            <TextInput value={phone} onChangeText={setPhone} placeholder="+9665XXXXXXXX" style={styles.input} textAlign="left" keyboardType="phone-pad" />
            <Text style={styles.label}>نوع الحساب</Text>
            <View style={styles.options}>
              {([["INDIVIDUAL", "فرد"], ["STORE", "متجر"], ["BRAND", "براند"], ["COMPANY", "شركة"]] as const).map(([value, label]) => (
                <Pressable key={value} onPress={() => setAccountType(value)} style={[styles.option, accountType === value && styles.selectedOption]}>
                  <Text>{label}</Text>
                </Pressable>
              ))}
            </View>
            {accountType !== "INDIVIDUAL" && <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني التجاري" style={styles.input} textAlign="left" keyboardType="email-address" autoCapitalize="none" />}
            <Text style={styles.label}>المدينة</Text>
            <View style={styles.options}>
              {cities.map((city) => (
                <Pressable key={city.id} onPress={() => setCityId(city.id)} style={[styles.option, cityId === city.id && styles.selectedOption]}>
                  <Text>{city.nameAr}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.terms}><Switch value={accepted} onValueChange={setAccepted} trackColor={{ true: colors.brand }} /><Text style={styles.termsText}>أوافق على الشروط وسياسة الخصوصية</Text></View>
          </View>
        ) : (
          <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, ""))} maxLength={6} placeholder="000000" style={[styles.input, styles.code]} textAlign="center" keyboardType="number-pad" />
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable disabled={busy || (step === "register" ? !name || !cityId || !accepted || phone.length !== 13 : code.length !== 6)} onPress={() => void submit()} style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.7 }]}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>{step === "register" ? "إرسال رمز التحقق" : "تحقق ودخول"}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.muted },
  content: { flexGrow: 1, justifyContent: "center", padding: 22 },
  logo: { textAlign: "right", fontSize: 30, fontWeight: "900" },
  heading: { textAlign: "right", fontSize: 26, fontWeight: "900", marginTop: 18 },
  subheading: { textAlign: "right", color: "#666", marginTop: 5, marginBottom: 22 },
  form: { gap: 12 },
  input: { height: 52, borderRadius: 14, backgroundColor: "white", borderWidth: 1, borderColor: "#ddd", paddingHorizontal: 14 },
  label: { textAlign: "right", fontWeight: "800", marginTop: 4 },
  options: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  option: { borderRadius: 18, backgroundColor: "white", paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1, borderColor: "#ddd" },
  selectedOption: { backgroundColor: colors.brand, borderColor: colors.brand },
  terms: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  termsText: { flex: 1, textAlign: "right" },
  code: { fontSize: 26, letterSpacing: 12 },
  error: { color: "#b91c1c", backgroundColor: "#fee2e2", padding: 12, borderRadius: 12, textAlign: "right", marginTop: 12 },
  button: { height: 52, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 18 },
  buttonText: { fontWeight: "900", fontSize: 16 }
});
