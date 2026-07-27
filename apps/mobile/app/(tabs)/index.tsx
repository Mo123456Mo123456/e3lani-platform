import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'react-native';
import type { AdDetail } from '@e3lani/api-client';
import { t } from '@e3lani/i18n';
import { LogoMark } from '../../src/components/LogoMark';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

const { height } = Dimensions.get('window');

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'forYou' | 'nearby' | 'latest'>('forYou');
  const [items, setItems] = useState<AdDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api.feed(tab);
      setItems(page.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <LogoMark size={28} />
          <Text style={styles.brand}>إعلاني</Text>
        </View>
        <View style={styles.tabs}>
          {(
            [
              ['forYou', 'feed.forYou'],
              ['nearby', 'feed.nearby'],
              ['latest', 'feed.latest'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t('ar', label)}</Text>
              {tab === key ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 120 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && items.length === 0 ? (
        <Text style={styles.empty}>لا توجد إعلانات نشطة بعد.</Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        renderItem={({ item }) => {
          const media = item.media?.[0]?.asset;
          const contact = item.currentRevision?.contactMethods;
          return (
            <View style={[styles.slide, { height }]}>
              {media?.kind === 'VIDEO' ? (
                <Video
                  style={StyleSheet.absoluteFill}
                  source={{ uri: media.urls?.playback || media.urls?.source || '' }}
                  posterSource={media.urls?.poster ? { uri: media.urls.poster } : undefined}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  isLooping
                  isMuted
                />
              ) : media ? (
                <Image
                  style={StyleSheet.absoluteFill}
                  source={{ uri: media.urls?.playback || media.urls?.source }}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#252525' }]} />
              )}

              <View style={[styles.overlay, { paddingBottom: insets.bottom + 88 }]}>
                <Text style={styles.brandName}>
                  {item.owner?.brandProfile?.nameAr || item.owner?.displayName || 'معلن'}
                </Text>
                <Text style={styles.offerTitle}>{item.currentRevision?.title}</Text>
                <Text style={styles.city}>{item.currentRevision?.city?.nameAr}</Text>
                <Text style={styles.description}>{item.currentRevision?.description}</Text>
                <Pressable
                  style={styles.cta}
                  onPress={() => {
                    if (contact?.storeUrl) void Linking.openURL(contact.storeUrl);
                    else if (contact?.whatsapp)
                      void Linking.openURL(`https://wa.me/${contact.whatsapp.replace('+', '')}`);
                  }}
                >
                  <Text style={styles.ctaText}>{t('ar', 'feed.visitStore')}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { position: 'absolute', zIndex: 20, left: 0, right: 0, paddingHorizontal: 16 },
  brandRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 10 },
  brand: { color: colors.white, fontSize: 28, fontWeight: '800' },
  tabs: { flexDirection: 'row-reverse', gap: 18 },
  tabBtn: { alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  tabUnderline: { marginTop: 4, height: 3, width: 22, borderRadius: 2, backgroundColor: colors.primary },
  slide: { width: '100%' },
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16 },
  brandName: { color: colors.primary, fontWeight: '700', textAlign: 'right' },
  offerTitle: { color: colors.white, fontSize: 26, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  city: { color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'right' },
  description: { color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 22, textAlign: 'right' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  ctaText: { color: colors.black, fontSize: 17, fontWeight: '800' },
  error: { color: '#ff8a80', textAlign: 'center', marginTop: 120, paddingHorizontal: 20 },
  empty: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 120 },
});
