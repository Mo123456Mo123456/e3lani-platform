import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import type { AdDetail } from '@e3lani/api-client';
import { api } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

export default function AdDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale, t, rowDirection, textAlign } = useLocale();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getAd(String(id))
      .then(setAd)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function shareAd() {
    if (!ad) return;
    const res = await api.shareAd(ad.id, 'mobile-details');
    await Share.share({
      message: `${ad.currentRevision?.title ?? 'E3lani'}\n${res.shareUrl}`,
      url: res.shareUrl,
    });
  }

  async function saveAd() {
    if (!ad) return;
    try {
      await api.saveAd(ad.id);
    } catch {
      // ignore duplicate/auth edges — linking unchanged
    }
  }

  const media = ad?.media?.[0]?.asset;
  const contact = ad?.currentRevision?.contactMethods;
  const brandSlug = ad?.owner?.brandProfile?.slug;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>{t('ad.title')}</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={[styles.empty, { textAlign }]}>{error}</Text> : null}
      {!loading && !error && !ad ? <Text style={[styles.empty, { textAlign }]}>{t('ad.notFound')}</Text> : null}
      {ad ? (
        <>
          <View style={styles.mediaBox}>
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
            ) : null}
          </View>
          <Text style={[styles.advertiser, { textAlign }]}>
            {ad.owner?.brandProfile?.nameAr || ad.owner?.displayName || (locale === 'ar' ? 'معلن' : 'Advertiser')}
          </Text>
          <Text style={[styles.adTitle, { textAlign }]}>{ad.currentRevision?.title}</Text>
          <Text style={[styles.city, { textAlign }]}>
            {locale === 'ar' ? ad.currentRevision?.city?.nameAr : ad.currentRevision?.city?.nameEn}
          </Text>
          {ad.currentRevision?.description ? (
            <Text style={[styles.description, { textAlign }]}>{ad.currentRevision.description}</Text>
          ) : null}
          <View style={[styles.actions, { flexDirection: rowDirection }]}>
            {contact?.whatsapp ? (
              <Pressable
                style={styles.primary}
                onPress={() => void Linking.openURL(`https://wa.me/${contact.whatsapp!.replace('+', '')}`)}
              >
                <Text style={styles.primaryText}>{locale === 'ar' ? 'واتساب' : 'WhatsApp'}</Text>
              </Pressable>
            ) : null}
            {contact?.phone ? (
              <Pressable style={styles.secondary} onPress={() => void Linking.openURL(`tel:${contact.phone}`)}>
                <Text style={styles.secondaryText}>{locale === 'ar' ? 'اتصال' : 'Call'}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondary} onPress={() => void saveAd()}>
              <Text style={styles.secondaryText}>{t('nav.saved')}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void shareAd()}>
              <Text style={styles.secondaryText}>{t('common.share')}</Text>
            </Pressable>
            {brandSlug ? (
              <Pressable style={styles.secondary} onPress={() => router.push(`/brands/${brandSlug}` as never)}>
                <Text style={styles.secondaryText}>{t('ad.openBrand')}</Text>
              </Pressable>
            ) : null}
            {!contact?.whatsapp && !contact?.phone && contact?.storeUrl ? (
              <Pressable style={styles.primary} onPress={() => void Linking.openURL(contact.storeUrl!)}>
                <Text style={styles.primaryText}>{t('feed.visitStore')}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, paddingHorizontal: 20 },
  header: { alignItems: 'center', gap: 12, marginBottom: 14 },
  back: {
    backgroundColor: colors.charcoal,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.25)',
  },
  backText: { color: colors.primary, fontWeight: '800' },
  title: { flex: 1, color: colors.white, fontSize: 26, fontWeight: '800' },
  empty: { color: 'rgba(255,255,255,0.55)', marginTop: 24 },
  mediaBox: {
    height: 430,
    borderRadius: 22,
    backgroundColor: colors.charcoal,
    overflow: 'hidden',
    marginBottom: 16,
  },
  advertiser: { color: colors.primary, fontWeight: '800' },
  adTitle: { color: colors.white, fontWeight: '800', fontSize: 24, marginTop: 6 },
  city: { color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  description: { color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginTop: 12 },
  actions: { gap: 8, flexWrap: 'wrap', marginTop: 18 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  primaryText: { color: colors.black, fontWeight: '800' },
  secondary: {
    backgroundColor: colors.charcoal,
    borderRadius: 14,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.28)',
  },
  secondaryText: { color: colors.white, fontWeight: '800' },
});
