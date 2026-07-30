import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { useAuth, useLocale } from "@/lib/app-context";

type AccountType = "INDIVIDUAL" | "STORE" | "BRAND" | "COMPANY";
type City = { id: string; nameAr: string; nameEn: string };

export default function LoginScreen() {
  const { requestOtp, verifyOtp, register } = useAuth();
  const { locale, rtl } = useLocale();
  const ar = locale === "ar";
  const [step, setStep] = useState<"phone" | "code" | "register">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cityId, setCityId] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("INDIVIDUAL");
  const [accepted, setAccepted] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ regions: Array<{ cities: City[] }> }>("/catalog")
      .then((data) => setCities(data.regions.flatMap((region) => region.cities)))
      .catch(() => undefined);
  }, []);

  async function next() {
    setBusy(true);
    try {
      if (step === "phone") {
        await requestOtp(phone);
        setStep("code");
      } else if (step === "code") {
        const result = await verifyOtp(phone, code);
        if (result.verificationToken) {
          setVerificationToken(result.verificationToken);
          setStep("register");
        } else {
          router.back();
        }
      } else {
        await register({
          verificationToken,
          name,
          phone,
          cityId,
          accountType,
          email: email || undefined,
          acceptedTerms: accepted,
          acceptedPrivacy: accepted,
        });
        router.replace("/");
      }
    } catch (error) {
      Alert.alert(ar ? "تعذر إكمال الدخول" : "Could not sign in", error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityLabel={ar ? "إغلاق" : "Close"}>
            <Text style={styles.close}>×</Text>
          </Pressable>
          <View style={styles.brand}><Text style={styles.brandText}>إعلاني</Text></View>
          <Text style={styles.title}>
            {step === "register"
              ? ar ? "أكمل بيانات حسابك" : "Complete your profile"
              : ar ? "دخول برقم الجوال" : "Sign in with mobile"}
          </Text>
          <Text style={styles.help}>
            {step === "phone"
              ? ar ? "سنرسل رمز تحقق لمرة واحدة." : "We will send a one-time verification code."
              : step === "code"
                ? ar ? "أدخل الرمز المرسل إلى جوالك." : "Enter the code sent to your mobile."
                : ar ? "الحقول التالية مطلوبة لفتح حسابك." : "These fields are required to create your account."}
          </Text>

          {step !== "register" ? (
            <>
              <Text style={styles.label}>{ar ? "رقم الجوال" : "Mobile number"}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                editable={step === "phone"}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="05xxxxxxxx"
                style={styles.input}
                textAlign="left"
              />
              {step === "code" ? (
                <>
                  <Text style={styles.label}>{ar ? "رمز التحقق" : "Verification code"}</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={8}
                    style={[styles.input, { textAlign: "center", letterSpacing: 8, fontSize: 22 }]}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.label}>{ar ? "الاسم" : "Name"}</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} textAlign={rtl ? "right" : "left"} />
              <Text style={styles.label}>{ar ? "نوع الحساب" : "Account type"}</Text>
              <View style={styles.wrap}>
                {(["INDIVIDUAL", "STORE", "BRAND", "COMPANY"] as const).map((type) => (
                  <Pressable key={type} onPress={() => setAccountType(type)} style={[styles.chip, accountType === type && styles.chipActive]}>
                    <Text style={styles.chipText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>
                {ar ? `البريد الإلكتروني${accountType === "INDIVIDUAL" ? " (اختياري)" : " *"}` : `Email${accountType === "INDIVIDUAL" ? " (optional)" : " *"}`}
              </Text>
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} textAlign="left" />
              <Text style={styles.label}>{ar ? "المدينة" : "City"}</Text>
              <View style={styles.wrap}>
                {cities.map((city) => (
                  <Pressable key={city.id} onPress={() => setCityId(city.id)} style={[styles.chip, cityId === city.id && styles.chipActive]}>
                    <Text style={styles.chipText}>{ar ? city.nameAr : city.nameEn}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setAccepted((value) => !value)} style={[styles.consent, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                <View style={[styles.checkbox, accepted && styles.checkboxActive]}>{accepted ? <Text>✓</Text> : null}</View>
                <Text style={styles.consentText}>{ar ? "أوافق على شروط الاستخدام وسياسة الخصوصية." : "I agree to the Terms and Privacy Policy."}</Text>
              </Pressable>
            </>
          )}

          <Pressable
            disabled={busy || (step === "register" && (!name || !cityId || !accepted || (accountType !== "INDIVIDUAL" && !email)))}
            onPress={() => void next()}
            style={[styles.button, busy && { opacity: 0.6 }]}
          >
            {busy ? <ActivityIndicator color="#111111" /> : <Text style={styles.buttonText}>{step === "register" ? (ar ? "إنشاء الحساب" : "Create account") : ar ? "متابعة" : "Continue"}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 22, paddingBottom: 50 },
  close: { fontSize: 35, color: "#111111", textAlign: "left" },
  brand: { alignSelf: "center", backgroundColor: "#FFC400", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, marginTop: 5 },
  brandText: { fontWeight: "900", fontSize: 25 },
  title: { marginTop: 25, fontSize: 27, fontWeight: "900", textAlign: "center" },
  help: { marginTop: 8, marginBottom: 20, color: "#666666", fontSize: 13, textAlign: "center" },
  label: { marginTop: 15, marginBottom: 7, fontWeight: "900", fontSize: 13, textAlign: "right" },
  input: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: "#DDDDDD", backgroundColor: "#F7F7F7", paddingHorizontal: 14 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: "#DDDDDD", paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "#FFC400", borderColor: "#FFC400" },
  chipText: { fontSize: 11, fontWeight: "800" },
  consent: { alignItems: "center", gap: 9, marginTop: 22 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: "#BBBBBB", alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: "#FFC400", borderColor: "#FFC400" },
  consentText: { flex: 1, color: "#444444", fontSize: 12, lineHeight: 18 },
  button: { minHeight: 54, borderRadius: 16, backgroundColor: "#FFC400", alignItems: "center", justifyContent: "center", marginTop: 27 },
  buttonText: { fontWeight: "900", color: "#111111", fontSize: 15 },
});
