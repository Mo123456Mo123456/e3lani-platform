import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail } from '@e3lani/api-client';
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
      <Text style={[styles.title, { textAlign }]}>{t('nav.saved')}</Text>
      {items.map((ad) => (
        <Pressable key={ad.id} style={styles.row} onPress={() => router.push(`/ads/${ad.id}` as never)}>
          <Text style={[styles.rowTitle, { textAlign }]}>{ad.currentRevision?.title}</Text>
        </Pressable>
      ))}
      {items.length === 0 ? (
        <Text style={[styles.empty, { textAlign }]}>
          {t('nav.saved')}: {t('feed.emptyTitle')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  title: { color: colors.black, fontSize: 28, fontWeight: '800' },
  empty: { marginTop: 24, color: colors.gray, fontSize: 16 },
  row: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  rowTitle: { fontWeight: '700' },
});
