import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail } from '@e3lani/api-client';
import { BrandAtmosphere } from '../../src/components/BrandBackground';
import { BrandHeader } from '../../src/components/BrandHeader';
import { LogoMark } from '../../src/components/LogoMark';
import { api, getToken, setAuthTokens } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { statusLabel } from '../../src/lib/status';
import { colors } from '../../src/theme';

function formatCompact(n: number) {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v.toFixed(v >= 10 ? 0 : 1)}K`;
  }
  return String(n);
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, rowDirection, textAlign, toggleLocale } = useLocale();
  const [ads, setAds] = useState<AdDetail[]>([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState('');
  const [showAds, setShowAds] = useState(true);

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

  const stats = useMemo(() => {
    return {
      ads: ads.length,
      views: 0,
      contacts: 0,
    };
  }, [ads]);

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

  const menu: Array<{
    key: string;
    label: string;
    onPress: () => void;
    danger?: boolean;
  }> = [
    {
      key: 'ads',
      label: t('account.myAds'),
      onPress: () => setShowAds(true),
    },
    {
      key: 'saved',
      label: t('nav.saved'),
      onPress: () => router.push('/saved' as never),
    },
    {
      key: 'notifications',
      label: t('nav.notifications'),
      onPress: () => router.push('/notifications' as never),
    },
    {
      key: 'locale',
      label: locale === 'ar' ? 'English' : 'العربية',
      onPress: toggleLocale,
    },
    {
      key: 'logout',
      label: t('account.logout'),
      danger: true,
      onPress: () => {
        setAuthTokens(null);
        router.push('/login');
      },
    },
  ];

  return (
    <View style={styles.root}>
      <BrandAtmosphere variant="header" overlay="soft" height={insets.top + 170} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
      >
      <BrandHeader title={t('account.title')} subtitle={phone || t('account.loginPrompt')} markSize={48} />

      <View style={[styles.profile, { flexDirection: rowDirection }]}>
        <View style={styles.avatar}>
          <LogoMark size={40} framed />
        </View>
        <View style={styles.profileText}>
          <Text style={[styles.name, { textAlign }]}>{locale === 'ar' ? 'حساب المعلن' : 'Advertiser account'}</Text>
          <Text style={[styles.meta, { textAlign }]}>{phone || t('account.loginPrompt')}</Text>
        </View>
      </View>

      <View style={[styles.statsRow, { flexDirection: rowDirection }]}>
        <StatCard label={t('account.myAds')} value={String(stats.ads)} />
        <StatCard label={t('account.views')} value={formatCompact(stats.views)} />
        <StatCard label={t('account.clicks')} value={formatCompact(stats.contacts)} />
      </View>

      <View style={styles.menu}>
        {menu.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.menuRow, { flexDirection: rowDirection }]}
            onPress={item.onPress}
          >
            <Text style={[styles.menuLabel, item.danger && styles.menuDanger]}>{item.label}</Text>
            <Text style={[styles.menuChevron, item.danger && styles.menuDanger]}>‹</Text>
          </Pressable>
        ))}
      </View>

      {showAds ? (
        <>
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
            {!loading && ads.length === 0 ? (
              <Text style={[styles.meta, { textAlign }]}>{t('account.noAds')}</Text>
            ) : null}
          </View>
        </>
      ) : null}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  root: { flex: 1, backgroundColor: colors.black },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  profile: { alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1 },
  name: { color: colors.white, fontSize: 18, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statsRow: { gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: colors.charcoal,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.2)',
  },
  statValue: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  menu: { gap: 8, marginBottom: 22 },
  menuRow: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  menuLabel: { color: colors.white, fontWeight: '700', fontSize: 15 },
  menuChevron: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  menuDanger: { color: colors.primary },
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
