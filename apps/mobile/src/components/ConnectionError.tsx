import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl, apiOrigin, checkServerHealth, type ServerHealth } from '../lib/api';
import { colors } from '../theme';

type Props = {
  message: string;
  onRetry: () => void;
  dark?: boolean;
};

export function ConnectionError({ message, onRetry, dark = true }: Props) {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [checking, setChecking] = useState(false);

  const refreshHealth = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await checkServerHealth());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth, message]);

  const fg = dark ? colors.white : colors.black;
  const muted = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: fg }]}>تعذّر الاتصال بالخادم</Text>
      <Text style={[styles.message, { color: muted }]}>{message}</Text>
      <Text style={[styles.meta, { color: muted }]}>الخادم: {apiOrigin}</Text>
      <Text style={[styles.meta, { color: muted }]}>المسار: {apiBaseUrl}</Text>

      <View style={[styles.statusBox, dark ? styles.statusDark : styles.statusLight]}>
        <Text style={[styles.statusLabel, { color: fg }]}>حالة الخادم</Text>
        {checking && !health ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text
            style={[
              styles.statusValue,
              { color: health?.ok ? '#7CFFB2' : '#ff8a80' },
            ]}
          >
            {health?.ok
              ? `متصل (${health.status ?? 'ok'})`
              : `غير متصل${health?.detail ? ` — ${health.detail}` : ''}`}
          </Text>
        )}
        {health?.checkedAt ? (
          <Text style={[styles.meta, { color: muted }]}>
            آخر فحص: {new Date(health.checkedAt).toLocaleTimeString('ar-SA')}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={styles.retry}
        onPress={() => {
          void refreshHealth();
          onRetry();
        }}
      >
        <Text style={styles.retryText}>إعادة المحاولة</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => void refreshHealth()}>
        <Text style={[styles.secondaryText, { color: fg }]}>
          {checking ? 'جاري فحص الخادم…' : 'فحص حالة الخادم فقط'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 96,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  meta: { fontSize: 11, textAlign: 'center' },
  statusBox: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 6,
  },
  statusDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  statusLight: { backgroundColor: 'rgba(0,0,0,0.04)' },
  statusLabel: { fontWeight: '700', textAlign: 'right' },
  statusValue: { fontWeight: '700', textAlign: 'right' },
  retry: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  retryText: { color: colors.black, fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 8 },
  secondaryText: { fontWeight: '600', textAlign: 'center' },
});
