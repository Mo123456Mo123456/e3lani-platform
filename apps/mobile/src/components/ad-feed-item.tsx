import * as React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto } from '@e3lani/types';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { track } from '@/lib/track';
import { AdMedia } from './ad-media';
import { AdOptionsSheet, CONTACT_META, contactUrl } from './ad-options-sheet';
import { Avatar, Badge } from './ui';

export { contactUrl };

export function AdFeedItem({
  ad,
  active,
  height,
  isAuthed,
  onShare,
}: {
  ad: AdDto;
  active: boolean;
  height: number;
  isAuthed: boolean;
  onShare: (ad: AdDto) => void;
}) {
  const [saved, setSaved] = React.useState(ad.isSaved);
  const [optionsVisible, setOptionsVisible] = React.useState(false);
  const contact = CONTACT_META[ad.contactMethod];
  const storeUrl = ad.owner.business?.storeUrl ?? null;

  const openContact = async () => {
    const url = contactUrl(ad);
    if (!url) return;
    track(ad.id, contact.event);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await Linking.openURL(url).catch(() => undefined);
  };

  const toggleSave = async () => {
    if (!isAuthed) {
      router.push('/login');
      return;
    }
    const next = !saved;
    setSaved(next);
    try {
      await api(`/saved/ads/${ad.id}`, { method: next ? 'POST' : 'DELETE', auth: true });
      track(ad.id, next ? 'SAVE' : 'UNSAVE');
    } catch {
      setSaved(!next);
    }
  };

  const openStore = async () => {
    if (!storeUrl) return;
    track(ad.id, 'CLICK_STORE');
    await Linking.openURL(storeUrl).catch(() => undefined);
  };

  const mediaHeight = height - 132;

  return (
    <View style={[styles.container, { height }]}>
      <AdMedia media={ad.media} active={active} height={mediaHeight} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.badges}>
          {ad.isHighlighted ? <Badge label="مميز" tone="primary" /> : null}
          {ad.isTopOfCategory ? <Badge label="أعلى القسم" tone="primary" /> : null}
          {ad.category ? <Badge label={ad.category.nameAr} /> : null}
        </View>

        <Pressable onPress={() => router.push(`/ad/${ad.id}`)}>
          <Text style={styles.title} numberOfLines={2}>
            {ad.title}
          </Text>
        </Pressable>

        <View style={styles.metaRow}>
          {ad.price !== null ? (
            <Text style={styles.price}>{ad.price.toLocaleString('ar-SA')} ر.س</Text>
          ) : null}
          {ad.city ? <Text style={styles.meta}>{ad.city.nameAr}</Text> : null}
          <Text style={styles.meta}>{ad.viewsCount} مشاهدة</Text>
        </View>

        {/* صف المعلن: مدخل واضح إلى صفحته لتصفّح بقية ما نشره */}
        <View style={styles.ownerRow}>
          <Pressable style={styles.owner} onPress={() => router.push(`/u/${ad.owner.id}`)}>
            <Avatar uri={ad.owner.avatarUrl} name={ad.owner.name} size={30} />
            <View>
              <View style={styles.ownerNameRow}>
                <Text style={styles.ownerName}>{ad.owner.name}</Text>
                {ad.owner.isVerified ? (
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                ) : null}
              </View>
              <Text style={styles.ownerHint}>عرض صفحته ←</Text>
            </View>
          </Pressable>

          {storeUrl ? (
            <Pressable style={styles.storeChip} onPress={openStore} accessibilityLabel="زيارة المتجر">
              <Ionicons name="storefront" size={13} color={theme.colors.ink} />
              <Text style={styles.storeChipText}>المتجر</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.contactButton} onPress={openContact} accessibilityRole="button">
          <Ionicons name={contact.icon} size={18} color={theme.colors.ink} />
          <Text style={styles.contactLabel}>{contact.label}</Text>
        </Pressable>

        <Pressable
          style={[styles.iconButton, saved ? styles.iconButtonActive : null]}
          onPress={toggleSave}
          accessibilityLabel={saved ? 'إلغاء الحفظ' : 'حفظ'}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={19}
            color={theme.colors.ink}
          />
        </Pressable>

        <Pressable style={styles.iconButton} onPress={() => onShare(ad)} accessibilityLabel="مشاركة">
          <Ionicons name="share-social-outline" size={19} color={theme.colors.ink} />
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
  container: { backgroundColor: '#000000' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 132,
    padding: 14,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 8, textAlign: 'right' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' },
  price: { color: theme.colors.primary, fontSize: 16, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  ownerHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  storeChipText: { fontSize: 12, fontWeight: '800', color: theme.colors.ink },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 132,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 56,
    paddingTop: 12,
  },
  contactButton: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: { backgroundColor: '#FFF6D9', borderColor: theme.colors.primary },
});
