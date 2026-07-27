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
  const [phone, setPhone] = useState('+966512345678');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Text style={[styles.title, { textAlign }]}>{locale === 'ar' ? 'دخول إعلاني' : 'Sign in to E3lani'}</Text>
      </View>
      {step === 'phone' ? (
        <>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} textAlign={textAlign} />
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
          <TextInput style={styles.input} value={code} onChangeText={setCode} textAlign={textAlign} />
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
        </>
      )}
      {error ? (
        <ConnectionError
          message={error}
          onRetry={() => setError('')}
          dark={false}
        />
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
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '800', fontSize: 16 },
  hint: { color: '#0a7a32', marginBottom: 10, textAlign: 'right' },
});
