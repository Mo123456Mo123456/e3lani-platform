import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConnectionError } from '../src/components/ConnectionError';
import { api, setAuthTokens } from '../src/lib/api';
import { useLocale } from '../src/lib/locale';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, rowDirection, textAlign } = useLocale();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [accepted, setAccepted] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Text style={[styles.title, { textAlign }]}>
          {locale === 'ar' ? 'دخول إعلاني' : 'Sign in to E3lani'}
        </Text>
      </View>
      {step === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            textAlign={textAlign}
            placeholder="+9665XXXXXXXX"
            keyboardType="phone-pad"
          />
          <Pressable
            style={[styles.checkRow, { flexDirection: rowDirection }]}
            onPress={() => setAccepted((v) => !v)}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxOn]} />
            <Text style={[styles.checkText, { textAlign }]}>
              {locale === 'ar'
                ? 'أوافق على الشروط وسياسة الخصوصية'
                : 'I accept the terms and privacy policy'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={async () => {
              if (!accepted) {
                setError(
                  locale === 'ar'
                    ? 'يجب الموافقة على الشروط وسياسة الخصوصية'
                    : 'You must accept terms and privacy',
                );
                return;
              }
              try {
                await api.requestOtp({
                  phone,
                  acceptedTerms: true,
                  locale,
                  countryCode: 'SA',
                });
                setHint(locale === 'ar' ? 'تم إرسال رمز التحقق' : 'Verification code sent');
                setStep('otp');
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
            style={styles.input}
            value={code}
            onChangeText={setCode}
            textAlign={textAlign}
            keyboardType="number-pad"
            placeholder={locale === 'ar' ? 'رمز التحقق' : 'OTP code'}
          />
          {hint ? <Text style={[styles.hint, { textAlign }]}>{hint}</Text> : null}
          <Pressable
            style={styles.btn}
            onPress={async () => {
              try {
                const res = await api.verifyOtp({
                  phone,
                  code,
                  deviceId: 'e3lani-mobile',
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
        </>
      )}
      {error ? (
        <ConnectionError message={error} onRetry={() => setError('')} dark={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { flex: 1, fontSize: 28, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  checkRow: { alignItems: 'center', gap: 10, marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#111',
  },
  checkboxOn: { backgroundColor: colors.primary },
  checkText: { flex: 1, color: '#555', fontSize: 14 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '800', fontSize: 16 },
  hint: { color: '#0a7a32', marginBottom: 10 },
});
