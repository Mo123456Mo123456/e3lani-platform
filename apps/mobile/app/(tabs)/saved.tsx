import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail } from '@e3lani/api-client';
import { t } from '@e3lani/i18n';
import { api, getToken } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      <Text style={styles.title}>{t('ar', 'nav.saved')}</Text>
      {items.map((ad) => (
        <View key={ad.id} style={styles.row}>
          <Text style={styles.rowTitle}>{ad.currentRevision?.title}</Text>
        </View>
      ))}
      {items.length === 0 ? <Text style={styles.empty}>لا توجد إعلانات محفوظة بعد.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  title: { color: colors.black, fontSize: 28, fontWeight: '800', textAlign: 'right' },
  empty: { marginTop: 24, color: colors.gray, textAlign: 'right', fontSize: 16 },
  row: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  rowTitle: { textAlign: 'right', fontWeight: '700' },
});
