import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail } from '@e3lani/api-client';
import { BrandAtmosphere, BrandBackground } from '../../src/components/BrandBackground';
import { api, getToken } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, textAlign } = useLocale();
  const [items, setItems] = useState<AdDetail[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    api
      .saved()
      .then((rows) => setItems(rows.map((r) => r.ad)))
      .catch(console.error);
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <BrandAtmosphere variant="banner" overlay="soft" height={insets.top + 120} />
      <Text style={[styles.title, { textAlign }]}>{t('nav.saved')}</Text>
      {items.map((ad) => (
        <Pressable key={ad.id} style={styles.row} onPress={() => router.push(`/ads/${ad.id}` as never)}>
          <Text style={[styles.rowTitle, { textAlign }]}>{ad.currentRevision?.title}</Text>
        </Pressable>
      ))}
      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <BrandBackground variant="empty" overlay="dark" height={180} style={styles.emptyBrand} />
          <Text style={[styles.empty, { textAlign }]}>
            {t('nav.saved')}: {t('feed.emptyTitle')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, paddingHorizontal: 20 },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', zIndex: 1 },
  emptyWrap: { marginTop: 28, gap: 12 },
  emptyBrand: { borderRadius: 18, overflow: 'hidden' },
  empty: { color: 'rgba(255,255,255,0.55)', fontSize: 16 },
  row: {
    marginTop: 12,
    backgroundColor: colors.charcoal,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.14)',
    zIndex: 1,
  },
  rowTitle: { fontWeight: '700', color: colors.white },
});
