import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, setToken } from '../src/lib/api';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState('+966512345678');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>دخول إعلاني</Text>
      {step === 'phone' ? (
        <>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} textAlign="right" />
          <Pressable
            style={styles.btn}
            onPress={async () => {
              try {
                const res = await api.requestOtp({
                  phone,
                  acceptedTerms: true,
                  locale: 'ar',
                  countryCode: 'SA',
                });
                setHint(res.sandboxCode ? `رمز التجربة: ${res.sandboxCode}` : '');
                if (res.sandboxCode) setCode(res.sandboxCode);
                setStep('otp');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Text style={styles.btnText}>إرسال الرمز</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput style={styles.input} value={code} onChangeText={setCode} textAlign="right" />
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <Pressable
            style={styles.btn}
            onPress={async () => {
              try {
                const res = await api.verifyOtp({ phone, code });
                setToken(res.accessToken);
                router.replace('/account');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Text style={styles.btnText}>تأكيد</Text>
          </Pressable>
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'right', marginBottom: 20 },
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
  error: { color: '#b00020', marginTop: 12, textAlign: 'right' },
});
