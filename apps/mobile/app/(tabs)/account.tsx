import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail } from '@e3lani/api-client';
import { BrandHeader } from '../../src/components/BrandHeader';
import { LogoMark } from '../../src/components/LogoMark';
import { api, getToken, setAuthTokens } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { statusLabel } from '../../src/lib/status';
import { colors } from '../../src/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, rowDirection, textAlign, toggleLocale } = useLocale();
  const [ads, setAds] = useState<AdDetail[]>([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState('');

  const load = useCallback(() => {
    if (!getToken()) {
      router.push('/login');
      return Promise.resolve();
    }
    setLoading(true);
    return Promise.all([api.me(), api.myAds()])
      .then(([me, list]) => {
        setPhone(String(me.phone ?? ''));
        setAds(list);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(ad: AdDetail, action: 'pause' | 'resume' | 'extend' | 'republish') {
    setActioningId(`${ad.id}:${action}`);
    try {
      if (action === 'pause') await api.pauseAd(ad.id);
      if (action === 'resume') await api.resumeAd(ad.id);
      if (action === 'extend') await api.extendAd(ad.id);
      if (action === 'republish') await api.republishAd(ad.id);
      await load();
      Alert.alert(t('account.actionDone'));
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setActioningId('');
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }}
    >
      <BrandHeader title={t('account.title')} subtitle={phone || t('account.loginPrompt')} markSize={36} />

      <View style={[styles.profile, { flexDirection: rowDirection }]}>
        <View style={styles.avatar} accessibilityLabel="E3lani">
          <LogoMark size={30} />
        </View>
        <Text style={[styles.profileHint, { textAlign }]}>
          {locale === 'ar' ? 'حساب المعلن' : 'Advertiser account'}
        </Text>
      </View>

      <View style={[styles.topActions, { flexDirection: rowDirection }]}>
        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/notifications' as never)}>
          <Text style={styles.secondaryBtnText}>{t('nav.notifications')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={toggleLocale}>
          <Text style={styles.secondaryBtnText}>{locale === 'ar' ? 'English' : 'العربية'}</Text>
        </Pressable>
        <Pressable
          style={styles.logout}
          onPress={() => {
            setAuthTokens(null);
            router.push('/login');
          }}
        >
          <Text style={styles.logoutText}>{t('account.logout')}</Text>
        </Pressable>
      </View>

      <Text style={[styles.section, { textAlign }]}>{t('account.myAds')}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <View style={styles.list}>
        {ads.map((ad) => (
          <View key={ad.id} style={styles.row}>
            <Text style={[styles.rowTitle, { textAlign }]}>{ad.currentRevision?.title}</Text>
            <Text style={[styles.rowMeta, { textAlign }]}>{statusLabel(ad.status, locale)}</Text>
            <View style={[styles.adActions, { flexDirection: rowDirection }]}>
              {ad.status === 'ACTIVE' ? (
                <ActionButton
                  label={t('account.pause')}
                  busy={actioningId === `${ad.id}:pause`}
                  onPress={() => void runAction(ad, 'pause')}
                />
              ) : null}
              {ad.status === 'PAUSED' ? (
                <ActionButton
                  label={t('account.resume')}
                  busy={actioningId === `${ad.id}:resume`}
                  onPress={() => void runAction(ad, 'resume')}
                />
              ) : null}
              {['ACTIVE', 'PAUSED'].includes(ad.status) ? (
                <ActionButton
                  label={t('account.extend')}
                  busy={actioningId === `${ad.id}:extend`}
                  onPress={() => void runAction(ad, 'extend')}
                />
              ) : null}
              {ad.status === 'EXPIRED' ? (
                <ActionButton
                  label={t('account.republish')}
                  busy={actioningId === `${ad.id}:republish`}
                  onPress={() => void runAction(ad, 'republish')}
                />
              ) : null}
            </View>
          </View>
        ))}
        {!loading && ads.length === 0 ? <Text style={[styles.meta, { textAlign }]}>{t('account.noAds')}</Text> : null}
      </View>
    </ScrollView>
  );
}

function ActionButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionBtn, busy && styles.actionBtnDisabled]} disabled={busy} onPress={onPress}>
      <Text style={styles.actionBtnText}>{busy ? '...' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, paddingHorizontal: 20 },
  profile: { alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileHint: { flex: 1, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  topActions: { gap: 8, flexWrap: 'wrap', marginBottom: 18 },
  logout: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  logoutText: { color: colors.black, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.28)',
  },
  secondaryBtnText: { color: colors.white, fontWeight: '800' },
  section: { color: colors.primary, fontWeight: '800', fontSize: 16, marginBottom: 10 },
  list: { gap: 8 },
  row: {
    backgroundColor: colors.charcoal,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowTitle: { fontWeight: '700', color: colors.white },
  rowMeta: { color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  adActions: { marginTop: 12, flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: colors.black, fontWeight: '800', fontSize: 12 },
});
