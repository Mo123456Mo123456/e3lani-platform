import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'react-native';
import type { AdDetail } from '@e3lani/api-client';
import { ConnectionError } from '../../src/components/ConnectionError';
import { LogoMark } from '../../src/components/LogoMark';
import { api } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

const { height } = Dimensions.get('window');

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, rowDirection, textAlign } = useLocale();
  const [tab, setTab] = useState<'forYou' | 'nearby' | 'latest'>('forYou');
  const [items, setItems] = useState<AdDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chromeHidden, setChromeHidden] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api.feed(tab);
      setItems(page.items);
      const interactions = page.items.slice(0, 8).map((ad) => ({
        adId: ad.id,
        type: 'IMPRESSION' as const,
        feedTab: tab,
        platform: 'mobile',
        source:
          ((ad as { recommendation?: { source?: 'ORGANIC' | 'PAID' | 'SMART_RECOMMENDATION' } })
            .recommendation?.source as 'ORGANIC' | 'PAID' | 'SMART_RECOMMENDATION' | undefined) ??
          (tab === 'forYou' ? 'SMART_RECOMMENDATION' : 'ORGANIC'),
      }));
      if (interactions.length) {
        void api.recordInteractions(interactions).catch(() => undefined);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  function bumpChrome() {
    setChromeHidden(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeHidden(true), 2200);
  }

  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [items.length, tab]);

  async function shareAd(ad: AdDetail) {
    try {
      const res = await api.shareAd(ad.id, 'mobile-feed');
      await Share.share({
        message: `${ad.currentRevision?.title ?? 'E3lani'}\n${res.shareUrl}`,
        url: res.shareUrl,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, opacity: chromeHidden ? 0 : 1 },
        ]}
        pointerEvents={chromeHidden ? 'none' : 'auto'}
      >
        <View style={[styles.brandRow, { flexDirection: rowDirection }]}>
          <LogoMark size={28} />
          <View>
            <Text style={[styles.brand, { textAlign }]}>إعلاني | E3lani</Text>
            <Text style={[styles.tagline, { textAlign }]}>{t('brand.tagline')}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerPill} onPress={() => router.push('/search' as never)}>
              <Text style={styles.headerPillText}>{t('nav.search')}</Text>
            </Pressable>
            <Pressable style={styles.headerPill} onPress={() => router.push('/notifications' as never)}>
              <Text style={styles.headerPillText}>{t('nav.notifications')}</Text>
            </Pressable>
          </View>
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
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t(label)}</Text>
              {tab === key ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {loading && items.length === 0 ? <ActivityIndicator color={colors.primary} style={{ marginTop: 120 }} /> : null}
      {error && items.length === 0 ? <ConnectionError message={error} onRetry={() => void load()} dark /> : null}
      {!loading && !error && items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('feed.emptyTitle')}</Text>
          <Text style={styles.empty}>{t('feed.emptyBody')}</Text>
          <Pressable style={styles.emptyButton} onPress={() => void load()}>
            <Text style={styles.emptyButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        onScrollBeginDrag={bumpChrome}
        refreshControl={
          <RefreshControl refreshing={loading && items.length > 0} onRefresh={() => void load()} tintColor={colors.primary} />
        }
        renderItem={({ item }) => {
          const media = item.media?.[0]?.asset;
          const contact = item.currentRevision?.contactMethods;
          const brandName =
            locale === 'ar'
              ? item.owner?.brandProfile?.nameAr || item.owner?.displayName || 'معلن'
              : item.owner?.brandProfile?.nameAr || item.owner?.displayName || 'Advertiser';
          return (
            <Pressable style={[styles.slide, { height }]} onPress={bumpChrome}>
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

              <View
                style={[
                  styles.overlay,
                  {
                    paddingBottom: insets.bottom + 88,
                    opacity: chromeHidden ? 0 : 1,
                  },
                ]}
                pointerEvents={chromeHidden ? 'none' : 'auto'}
              >
                <Text style={styles.brandName}>
                  {brandName}
                </Text>
                <Text style={[styles.offerTitle, { textAlign }]}>{item.currentRevision?.title}</Text>
                <Text style={[styles.city, { textAlign }]}>
                  {locale === 'ar' ? item.currentRevision?.city?.nameAr : item.currentRevision?.city?.nameEn}
                </Text>
                {item.currentRevision?.description ? (
                  <Text style={[styles.description, { textAlign }]} numberOfLines={2}>
                    {item.currentRevision.description}
                  </Text>
                ) : null}
                <View style={[styles.actionRow, { flexDirection: rowDirection }]}>
                  <Pressable
                    style={styles.cta}
                    onPress={() => {
                      if (contact?.storeUrl) void Linking.openURL(contact.storeUrl);
                      else if (contact?.whatsapp)
                        void Linking.openURL(`https://wa.me/${contact.whatsapp.replace('+', '')}`);
                      else if (contact?.phone) void Linking.openURL(`tel:${contact.phone}`);
                    }}
                  >
                    <Text style={styles.ctaText}>{contact?.storeUrl ? t('feed.visitStore') : t('feed.contact')}</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryCta} onPress={() => void shareAd(item)}>
                    <Text style={styles.secondaryCtaText}>{t('common.share')}</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryCta} onPress={() => router.push(`/ads/${item.id}` as never)}>
                    <Text style={styles.secondaryCtaText}>{t('feed.details')}</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    position: 'absolute',
    zIndex: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  brandRow: { alignItems: 'center', gap: 8, marginBottom: 10 },
  brand: { color: colors.white, fontSize: 22, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  headerActions: { marginStart: 'auto', gap: 6 },
  headerPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerPillText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row-reverse', gap: 18 },
  tabBtn: { alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  tabUnderline: { marginTop: 4, height: 3, width: 22, borderRadius: 2, backgroundColor: colors.primary },
  slide: { width: '100%' },
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16 },
  brandName: { color: colors.primary, fontWeight: '700', textAlign: 'right' },
  offerTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 6 },
  city: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  description: { color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 22 },
  actionRow: { gap: 8, marginTop: 14 },
  cta: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.black, fontSize: 17, fontWeight: '800' },
  secondaryCta: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryCtaText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  emptyState: { marginTop: 120, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  empty: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 21 },
  emptyButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  emptyButtonText: { color: colors.black, fontWeight: '800' },
});
