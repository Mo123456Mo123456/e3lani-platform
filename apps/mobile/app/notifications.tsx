import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationItem } from '@e3lani/api-client';
import { api, getToken } from '../src/lib/api';
import { useLocale } from '../src/lib/locale';
import { colors } from '../src/theme';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, rowDirection, textAlign } = useLocale();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setItems(await api.notifications());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)),
    );
  }

  async function markAllRead() {
    await api.markAllNotificationsRead();
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>{t('notifications.title')}</Text>
      </View>
      <Pressable style={styles.markAll} onPress={() => void markAllRead()}>
        <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
      </Pressable>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <Pressable style={styles.error} onPress={() => void load()}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retry}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <Text style={[styles.empty, { textAlign }]}>{t('notifications.empty')}</Text>
      ) : null}
      <View style={styles.list}>
        {items.map((item) => {
          const unread = !item.readAt;
          return (
            <Pressable
              key={item.id}
              style={[styles.card, unread && styles.cardUnread]}
              onPress={() => void markRead(item.id)}
            >
              <View style={[styles.cardHeader, { flexDirection: rowDirection }]}>
                <Text style={[styles.cardTitle, { textAlign }]}>
                  {locale === 'ar' ? item.titleAr : item.titleEn}
                </Text>
                {unread ? <Text style={styles.badge}>{t('notifications.unread')}</Text> : null}
              </View>
              <Text style={[styles.body, { textAlign }]}>{locale === 'ar' ? item.bodyAr : item.bodyEn}</Text>
              <Text style={[styles.date, { textAlign }]}>{new Date(item.createdAt).toLocaleString()}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  header: { alignItems: 'center', gap: 12, marginBottom: 12 },
  back: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: colors.black, fontWeight: '800' },
  title: { flex: 1, color: colors.black, fontSize: 26, fontWeight: '800' },
  markAll: {
    alignSelf: 'flex-start',
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 14,
  },
  markAllText: { color: colors.white, fontWeight: '800' },
  error: { backgroundColor: '#FFF4F4', borderRadius: 14, padding: 14, marginBottom: 12 },
  errorText: { color: colors.black, textAlign: 'center' },
  retry: { color: colors.black, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  empty: { color: colors.gray, marginTop: 24 },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  cardUnread: { borderWidth: 1.5, borderColor: colors.primary },
  cardHeader: { alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: colors.black, fontWeight: '800', fontSize: 16 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: colors.black,
    fontSize: 11,
    fontWeight: '800',
  },
  body: { color: colors.black, marginTop: 8, lineHeight: 20 },
  date: { color: colors.gray, marginTop: 8, fontSize: 12 },
});
