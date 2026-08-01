import * as React from 'react';
import {
  Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto } from '@e3lani/types';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { track } from '@/lib/track';
import { Avatar } from './ui';

export const CONTACT_META: Record<
  AdDto['contactMethod'],
  { label: string; icon: any; event: string }
> = {
  WHATSAPP: { label: 'مراسلة على واتساب', icon: 'logo-whatsapp', event: 'CLICK_WHATSAPP' },
  PHONE: { label: 'اتصال بالمعلن', icon: 'call', event: 'CLICK_CALL' },
  STORE_LINK: { label: 'زيارة المتجر', icon: 'storefront', event: 'CLICK_STORE' },
  PRODUCT_LINK: { label: 'عرض المنتج', icon: 'pricetag', event: 'CLICK_STORE' },
  EXTERNAL_LINK: { label: 'فتح الرابط', icon: 'link', event: 'CLICK_LINK' },
};

export function contactUrl(ad: AdDto): string | null {
  if (!ad.contactValue) return null;
  if (ad.contactMethod === 'WHATSAPP') {
    return `https://wa.me/${ad.contactValue}?text=${encodeURIComponent(`مرحبًا، بخصوص إعلان «${ad.title}»`)}`;
  }
  if (ad.contactMethod === 'PHONE') return `tel:+${ad.contactValue}`;
  return ad.contactValue;
}

interface Option {
  key: string;
  label: string;
  hint?: string;
  icon: any;
  tone?: 'default' | 'primary' | 'danger';
  onPress: () => void | Promise<void>;
}

/**
 * ورقة خيارات الإعلان.
 *
 * تجيب عن سؤال المتصفّح حين يعجبه إعلان: «كيف أتواصل؟ وأين أشوف بقية ما عند هذا المعلن؟»
 * فتضع أمامه التواصل المباشر، ومتجر المعلن، وصفحته الكاملة — في مكان واحد.
 */
export function AdOptionsSheet({
  ad,
  visible,
  saved,
  onClose,
  onToggleSave,
}: {
  ad: AdDto;
  visible: boolean;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const contact = CONTACT_META[ad.contactMethod];
  const storeUrl = ad.owner.business?.storeUrl ?? null;
  const websiteUrl = ad.owner.business?.websiteUrl ?? null;
  const ownerLabel = ad.owner.accountType === 'INDIVIDUAL' ? 'صفحة المعلن' : 'صفحة المتجر في إعلاني';

  const close = (action?: () => void | Promise<void>) => {
    onClose();
    if (action) setTimeout(() => void action(), 180);
  };

  const openUrl = async (url: string, event: string) => {
    track(ad.id, event);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await Linking.openURL(url).catch(() => undefined);
  };

  const options: Option[] = [];

  const directUrl = contactUrl(ad);
  if (directUrl) {
    options.push({
      key: 'contact',
      label: contact.label,
      hint: 'تواصل مباشر مع المعلن',
      icon: contact.icon,
      tone: 'primary',
      onPress: () => openUrl(directUrl, contact.event),
    });
  }

  // متجر المعلن — يظهر فقط إن كان مختلفًا عن وسيلة التواصل نفسها
  if (storeUrl && storeUrl !== ad.contactValue) {
    options.push({
      key: 'store',
      label: 'زيارة متجر المعلن',
      hint: storeUrl.replace(/^https?:\/\//, '').slice(0, 42),
      icon: 'storefront-outline',
      onPress: () => openUrl(storeUrl, 'CLICK_STORE'),
    });
  }

  if (websiteUrl && websiteUrl !== storeUrl && websiteUrl !== ad.contactValue) {
    options.push({
      key: 'website',
      label: 'الموقع الإلكتروني',
      hint: websiteUrl.replace(/^https?:\/\//, '').slice(0, 42),
      icon: 'globe-outline',
      onPress: () => openUrl(websiteUrl, 'CLICK_LINK'),
    });
  }

  options.push({
    key: 'profile',
    label: ownerLabel,
    hint: 'شاهد بقية إعلاناته ومنشوراته',
    icon: 'person-circle-outline',
    onPress: () => router.push(`/u/${ad.owner.id}`),
  });

  options.push({
    key: 'save',
    label: saved ? 'إلغاء الحفظ' : 'حفظ الإعلان',
    icon: saved ? 'bookmark' : 'bookmark-outline',
    onPress: onToggleSave,
  });

  options.push({
    key: 'share',
    label: 'مشاركة الإعلان',
    icon: 'share-social-outline',
    onPress: async () => {
      track(ad.id, 'SHARE');
      await api(`/ads/${ad.id}/share`, { method: 'POST' }).catch(() => undefined);
      await Share.share({ message: `${ad.title}\n${ad.shareUrl}` }).catch(() => undefined);
    },
  });

  options.push({
    key: 'copy',
    label: copied ? 'تم نسخ الرابط' : 'نسخ رابط الإعلان',
    icon: 'copy-outline',
    onPress: async () => {
      await Clipboard.setStringAsync(ad.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
  });

  options.push({
    key: 'report',
    label: 'إبلاغ عن الإعلان',
    icon: 'flag-outline',
    tone: 'danger',
    onPress: () => router.push(`/report?adId=${ad.id}`),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="إغلاق" />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Avatar uri={ad.owner.avatarUrl} name={ad.owner.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ownerName} numberOfLines={1}>
              {ad.owner.name}
              {ad.owner.isVerified ? '  ✓' : ''}
            </Text>
            <Text style={styles.adTitle} numberOfLines={1}>
              {ad.title}
            </Text>
          </View>
        </View>

        <ScrollView bounces={false} style={{ maxHeight: 420 }}>
          {options.map((option) => (
            <Pressable
              key={option.key}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => close(option.onPress)}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.optionIcon,
                  option.tone === 'primary' && { backgroundColor: theme.colors.primary },
                  option.tone === 'danger' && { backgroundColor: '#FDECEC' },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={19}
                  color={option.tone === 'danger' ? theme.colors.danger : theme.colors.ink}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.optionLabel,
                    option.tone === 'danger' && { color: theme.colors.danger },
                  ]}
                >
                  {option.label}
                </Text>
                {option.hint ? <Text style={styles.optionHint}>{option.hint}</Text> : null}
              </View>

              <Ionicons name="chevron-back" size={16} color={theme.colors.inkMuted} />
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>إغلاق</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 28,
    paddingTop: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ownerName: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  adTitle: { fontSize: 12, color: theme.colors.inkMuted, marginTop: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  optionPressed: { backgroundColor: theme.colors.surface },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  optionHint: { fontSize: 12, color: theme.colors.inkMuted, marginTop: 2 },
  cancel: {
    marginTop: 8,
    marginHorizontal: 18,
    height: 46,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.colors.inkMuted },
});
