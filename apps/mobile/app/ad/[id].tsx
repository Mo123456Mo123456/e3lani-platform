import * as React from 'react';
import { Dimensions, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { track } from '@/lib/track';
import { theme } from '@/lib/theme';
import { AdMedia } from '@/components/ad-media';
import { AdOptionsSheet, contactUrl } from '@/components/ad-options-sheet';
import { Avatar, Badge, Button, EmptyState, Loading } from '@/components/ui';

export default function AdDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [ad, setAd] = React.useState<AdDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [optionsVisible, setOptionsVisible] = React.useState(false);

  React.useEffect(() => {
    void api<AdDto>(`/ads/${id}`, { auth: Boolean(user) })
      .then((row) => {
        setAd(row);
        setSaved(row.isSaved);
        track(row.id, 'IMPRESSION');
      })
      .catch((err) => setError(err?.message ?? 'الإعلان غير متاح'));
  }, [id, user]);

  if (error) return <EmptyState title={error} />;
  if (!ad) return <Loading />;

  const openContact = async () => {
    const url = contactUrl(ad);
    if (!url) return;
    const eventMap: Record<string, string> = {
      WHATSAPP: 'CLICK_WHATSAPP',
      PHONE: 'CLICK_CALL',
      STORE_LINK: 'CLICK_STORE',
      PRODUCT_LINK: 'CLICK_STORE',
      EXTERNAL_LINK: 'CLICK_LINK',
    };
    track(ad.id, eventMap[ad.contactMethod] ?? 'CLICK_LINK');
    await Linking.openURL(url).catch(() => undefined);
  };

  const toggleSave = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    const next = !saved;
    setSaved(next);
    await api(`/saved/ads/${ad.id}`, { method: next ? 'POST' : 'DELETE', auth: true }).catch(() =>
      setSaved(!next),
    );
  };

  const share = async () => {
    track(ad.id, 'SHARE');
    await api(`/ads/${ad.id}/share`, { method: 'POST' }).catch(() => undefined);
    await Share.share({ message: `${ad.title}\n${ad.shareUrl}` }).catch(() => undefined);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <AdMedia media={ad.media} active height={Dimensions.get('window').width * 1.15} />

        <Pressable
          style={[styles.back, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          accessibilityLabel="رجوع"
        >
          <Ionicons name="arrow-forward" size={20} color={theme.colors.ink} />
        </Pressable>

        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {ad.isHighlighted ? <Badge label="مميز" tone="primary" /> : null}
            {ad.isTopOfCategory ? <Badge label="أعلى القسم" tone="primary" /> : null}
            {ad.category ? <Badge label={ad.category.nameAr} /> : null}
            {ad.subcategory ? <Badge label={ad.subcategory.nameAr} /> : null}
          </View>

          <Text style={theme.text.title}>{ad.title}</Text>

          {ad.price !== null ? (
            <Text style={styles.price}>{ad.price.toLocaleString('ar-SA')} ريال</Text>
          ) : null}

          <Text style={theme.text.caption}>
            {ad.city?.nameAr ?? ''}
            {ad.reachScope === 'KINGDOM' ? ' · جميع مناطق المملكة' : ''} · {ad.viewsCount} مشاهدة
          </Text>

          {ad.description ? <Text style={styles.description}>{ad.description}</Text> : null}

          <Pressable style={styles.owner} onPress={() => router.push(`/u/${ad.owner.id}`)}>
            <Avatar uri={ad.owner.avatarUrl} name={ad.owner.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={theme.text.body}>{ad.owner.name}</Text>
              <Text style={theme.text.caption}>
                {ad.owner.accountType === 'INDIVIDUAL' ? 'حساب فردي' : 'حساب تجاري'}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={theme.colors.inkMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Button title="تواصل" onPress={openContact} style={{ flex: 1 }} />
        <Pressable style={styles.iconButton} onPress={toggleSave}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={theme.colors.ink} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={share}>
          <Ionicons name="share-social-outline" size={20} color={theme.colors.ink} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => setOptionsVisible(true)}
          accessibilityLabel="خيارات الإعلان"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.ink} />
        </Pressable>
      </View>

      <AdOptionsSheet
        ad={ad}
        visible={optionsVisible}
        saved={saved}
        onClose={() => setOptionsVisible(false)}
        onToggleSave={toggleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  back: {
    position: 'absolute',
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: { fontSize: 22, fontWeight: '800', color: theme.colors.ink },
  description: { fontSize: 15, lineHeight: 26, color: theme.colors.ink, textAlign: 'right' },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
