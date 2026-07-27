import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail } from '@e3lani/api-client';
import { LogoMark } from '../../src/components/LogoMark';
import { api, getToken, setToken } from '../../src/lib/api';
import { statusLabel } from '../../src/lib/status';
import { colors } from '../../src/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ads, setAds] = useState<AdDetail[]>([]);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    Promise.all([api.me(), api.myAds()])
      .then(([me, list]) => {
        setPhone(String(me.phone ?? ''));
        setAds(list);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <LogoMark size={28} />
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>حسابي</Text>
          <Text style={styles.meta}>{phone || 'سجّل الدخول'}</Text>
        </View>
      </View>

      <Pressable
        style={styles.logout}
        onPress={() => {
          setToken(null);
          router.push('/login');
        }}
      >
        <Text>خروج</Text>
      </Pressable>

      <Text style={styles.section}>إعلاناتي</Text>
      <View style={styles.list}>
        {ads.map((ad) => (
          <View key={ad.id} style={styles.row}>
            <Text style={styles.rowTitle}>{ad.currentRevision?.title}</Text>
            <Text style={styles.rowMeta}>{statusLabel(ad.status)}</Text>
          </View>
        ))}
        {ads.length === 0 ? <Text style={styles.meta}>لا توجد إعلانات.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  profile: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileText: { flex: 1 },
  name: { color: colors.black, fontSize: 22, fontWeight: '800', textAlign: 'right' },
  meta: { color: colors.gray, marginTop: 4, textAlign: 'right' },
  logout: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 18,
  },
  section: { color: colors.black, fontWeight: '800', fontSize: 16, textAlign: 'right', marginBottom: 10 },
  list: { gap: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  rowTitle: { fontWeight: '700', textAlign: 'right' },
  rowMeta: { color: colors.gray, marginTop: 4, textAlign: 'right' },
});
