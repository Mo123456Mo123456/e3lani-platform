import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandBackground } from '../src/components/BrandBackground';
import { ConnectionError } from '../src/components/ConnectionError';
import { LogoMark } from '../src/components/LogoMark';
import { api, setAuthTokens } from '../src/lib/api';
import { useLocale } from '../src/lib/locale';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, rowDirection, textAlign } = useLocale();
  const [phone, setPhone] = useState('+966512345678');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  return (
    <View style={styles.root}>
      <BrandBackground variant="full" overlay="readability" style={StyleSheet.absoluteFillObject} />
      <View style={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.hero, { flexDirection: rowDirection }]}>
          <LogoMark size={52} framed />
          <View style={styles.heroText}>
            <Text style={[styles.brand, { textAlign }]}>إعلاني | E3lani</Text>
            <Text style={[styles.tagline, { textAlign }]}>
              {locale === 'ar' ? 'منصة الإعلانات المرئية لكل شيء' : 'The Visual Advertising Platform for Everything'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.title, { textAlign }]}>
            {step === 'phone'
              ? locale === 'ar'
                ? 'أهلاً بك'
                : 'Welcome'
              : locale === 'ar'
                ? 'تأكيد الرمز'
                : 'Confirm code'}
          </Text>
          <Text style={[styles.subtitle, { textAlign }]}>
            {step === 'phone'
              ? locale === 'ar'
                ? 'سجّل دخولك للوصول إلى حسابك وإعلاناتك'
                : 'Sign in to access your account and ads'
              : locale === 'ar'
                ? 'أدخل رمز التحقق المرسل إلى جوالك'
                : 'Enter the verification code sent to your phone'}
          </Text>

          {step === 'phone' ? (
            <>
              <TextInput
                style={[styles.input, { textAlign }]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+9665…"
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
              <Pressable
                style={styles.btn}
                onPress={async () => {
                  try {
                    const res = await api.requestOtp({
                      phone,
                      acceptedTerms: true,
                      locale,
                      countryCode: 'SA',
                    });
                    setHint(
                      res.sandboxCode
                        ? `${locale === 'ar' ? 'رمز التجربة' : 'Sandbox code'}: ${res.sandboxCode}`
                        : '',
                    );
                    if (res.sandboxCode) setCode(res.sandboxCode);
                    setStep('otp');
                    setError('');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Text style={styles.btnText}>{locale === 'ar' ? 'إرسال الرمز' : 'Send code'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={[styles.input, { textAlign }]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
              {hint ? <Text style={[styles.hint, { textAlign }]}>{hint}</Text> : null}
              <Pressable
                style={styles.btn}
                onPress={async () => {
                  try {
                    const res = await api.verifyOtp({
                      phone,
                      code,
                      deviceId: 'e3lani-android',
                    });
                    setAuthTokens(res);
                    router.replace('/account');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Text style={styles.btnText}>{locale === 'ar' ? 'تأكيد' : 'Confirm'}</Text>
              </Pressable>
              <Pressable onPress={() => setStep('phone')} style={styles.linkBtn}>
                <Text style={styles.linkText}>{locale === 'ar' ? 'تغيير الرقم' : 'Change number'}</Text>
              </Pressable>
            </>
          )}
        </View>

        {error ? (
          <ConnectionError message={error} onRetry={() => setError('')} dark />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 14, marginBottom: 28 },
  heroText: { flex: 1 },
  brand: { color: colors.white, fontSize: 26, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.78)', marginTop: 4, fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: 'rgba(17,17,17,0.78)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.28)',
    gap: 10,
  },
  title: { color: colors.white, fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.65)', marginBottom: 6, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(37,37,37,0.92)',
    color: colors.white,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: { fontWeight: '800', fontSize: 16, color: colors.black },
  hint: { color: colors.primary, marginBottom: 4 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
});
