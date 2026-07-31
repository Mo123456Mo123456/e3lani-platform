import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { AuthTokensDto, CityDto, SessionUserDto } from '@e3lani/types';
import { ACCOUNT_TYPES } from '@e3lani/types';
import { api, SITE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { Button, Field } from '@/components/ui';

const ACCOUNT_LABELS: Record<string, string> = {
  INDIVIDUAL: 'فرد',
  STORE: 'متجر',
  BRAND: 'براند',
  COMPANY: 'شركة',
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, refresh } = useAuth();
  const [step, setStep] = React.useState<'phone' | 'code' | 'profile'>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [cities, setCities] = React.useState<CityDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [profile, setProfile] = React.useState({
    name: '',
    cityId: '',
    accountType: 'INDIVIDUAL' as (typeof ACCOUNT_TYPES)[number],
    email: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
  });

  React.useEffect(() => {
    void api<CityDto[]>('/cities').then(setCities).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ resendAfterSeconds: number }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setCooldown(result.resendAfterSeconds);
      setStep('code');
    } catch (err: any) {
      setError(err?.message ?? 'تعذّر إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ tokens: AuthTokensDto; user: SessionUserDto }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
      await signIn(result);
      if (result.user.profileComplete) {
        router.back();
        return;
      }
      setStep('profile');
    } catch (err: any) {
      setError(err?.message ?? 'رمز غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async () => {
    setError(null);
    setLoading(true);
    try {
      await api('/auth/profile', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          name: profile.name,
          cityId: profile.cityId,
          accountType: profile.accountType,
          email: profile.email || undefined,
          acceptedTerms: profile.acceptedTerms,
          acceptedPrivacy: profile.acceptedPrivacy,
        }),
      });
      await refresh();
      router.back();
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? err?.message ?? 'تعذّر حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  const isBusiness = profile.accountType !== 'INDIVIDUAL';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ padding: 20, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={styles.brand}>إعلاني</Text>
        <Text style={theme.text.caption}>منصة الإعلانات المرئية لكل شيء</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'phone' ? (
        <>
          <Field
            label="رقم الجوال"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="05xxxxxxxx"
            hint="سنرسل لك رمز تحقق برسالة نصية."
          />
          <Button title="إرسال رمز التحقق" onPress={requestOtp} loading={loading} />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <Field
            label="رمز التحقق"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            hint={`أُرسل إلى ${phone}`}
          />
          <Button title="تأكيد" onPress={verifyOtp} loading={loading} />
          <Pressable disabled={cooldown > 0} onPress={requestOtp}>
            <Text style={[theme.text.caption, { textAlign: 'center' }]}>
              {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ثانية` : 'إعادة إرسال الرمز'}
            </Text>
          </Pressable>
        </>
      ) : null}

      {step === 'profile' ? (
        <>
          <Field
            label="الاسم"
            value={profile.name}
            onChangeText={(value) => setProfile({ ...profile, name: value })}
          />

          <Text style={styles.label}>المدينة</Text>
          <View style={styles.chips}>
            {cities.map((city) => (
              <Pressable
                key={city.id}
                onPress={() => setProfile({ ...profile, cityId: city.id })}
                style={[styles.chip, profile.cityId === city.id ? styles.chipActive : null]}
              >
                <Text style={styles.chipText}>{city.nameAr}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>نوع الحساب</Text>
          <View style={styles.chips}>
            {ACCOUNT_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => setProfile({ ...profile, accountType: type })}
                style={[styles.chip, profile.accountType === type ? styles.chipActive : null]}
              >
                <Text style={styles.chipText}>{ACCOUNT_LABELS[type]}</Text>
              </Pressable>
            ))}
          </View>

          <Field
            label={isBusiness ? 'البريد الإلكتروني (مطلوب)' : 'البريد الإلكتروني (اختياري)'}
            value={profile.email}
            onChangeText={(value) => setProfile({ ...profile, email: value })}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Pressable
            style={styles.checkRow}
            onPress={() => setProfile({ ...profile, acceptedTerms: !profile.acceptedTerms })}
          >
            <View style={[styles.checkbox, profile.acceptedTerms ? styles.checkboxOn : null]} />
            <Text style={theme.text.caption}>أوافق على </Text>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/legal/terms`)}>
              <Text style={styles.link}>الشروط والأحكام</Text>
            </Pressable>
          </Pressable>

          <Pressable
            style={styles.checkRow}
            onPress={() => setProfile({ ...profile, acceptedPrivacy: !profile.acceptedPrivacy })}
          >
            <View style={[styles.checkbox, profile.acceptedPrivacy ? styles.checkboxOn : null]} />
            <Text style={theme.text.caption}>أوافق على </Text>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/legal/privacy`)}>
              <Text style={styles.link}>سياسة الخصوصية</Text>
            </Pressable>
          </Pressable>

          <Button title="إنشاء الحساب" onPress={completeProfile} loading={loading} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  brand: { fontSize: 28, fontWeight: '800', color: theme.colors.ink },
  error: {
    backgroundColor: '#FDECEC',
    color: theme.colors.danger,
    padding: 12,
    borderRadius: theme.radius.md,
    fontSize: 13,
  },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  checkboxOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  link: { fontSize: 12, fontWeight: '700', color: theme.colors.ink, textDecorationLine: 'underline' },
});
