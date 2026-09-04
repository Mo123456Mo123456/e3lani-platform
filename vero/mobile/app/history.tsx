import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { history, pendingScans, type HistoryRow, type PendingScan } from '../lib/db';
import { C, S } from '../lib/theme';

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  VERIFIED: { label: 'موثّقة', bg: C.successBg, fg: '#14532D' },
  SUSPICIOUS: { label: 'تحتاج مراجعة', bg: C.warningBg, fg: '#92400E' },
  INVALID: { label: 'غير صالحة', bg: C.dangerBg, fg: '#991B1B' },
};

const time = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** سجل العمليات على الجهاز: ما تمت مزامنته وما ينتظر الإرسال. */
export default function HistoryScreen() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [queued, setQueued] = useState<PendingScan[]>([]);

  const load = useCallback(async () => {
    setRows(await history(80));
    setQueued(await pendingScans(50));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
      data={rows}
      keyExtractor={(r) => r.client_uuid}
      ListHeaderComponent={
        queued.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={[S.h2, { marginBottom: 8 }]}>
              بانتظار المزامنة ({queued.length})
            </Text>
            {queued.map((q) => (
              <View
                key={q.client_uuid}
                style={[
                  S.card,
                  { marginBottom: 8, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
                ]}
              >
                <View style={[S.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ color: '#1E40AF', fontWeight: '700', fontSize: 14 }}>
                    عملية محفوظة محليًا
                  </Text>
                  <Text style={{ color: '#1E40AF', fontSize: 12.5 }}>{time(q.scanned_at)}</Text>
                </View>
                <Text style={[S.tiny, { color: '#1E40AF', marginTop: 3 }]}>
                  {q.attempts > 0
                    ? `محاولات الإرسال: ${q.attempts}${q.last_error ? ` — ${q.last_error}` : ''}`
                    : 'ستُرسل تلقائيًا عند توفر الاتصال'}
                </Text>
              </View>
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 38, opacity: 0.35 }}>📋</Text>
          <Text style={[S.h2, { marginTop: 8 }]}>لا توجد عمليات بعد</Text>
          <Text style={[S.muted, { textAlign: 'center', marginTop: 4 }]}>
            ابدأ بمسح رمز حاوية من الشاشة الرئيسية
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const s = STATUS[item.status] ?? {
          label: item.status,
          bg: '#F3F4F6',
          fg: C.muted,
        };
        return (
          <View style={[S.card, { marginBottom: 8 }]}>
            <View style={[S.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>
                {item.bin_label ?? 'حاوية'}
              </Text>
              <View style={[S.pill, { backgroundColor: s.bg }]}>
                <Text style={[S.pillText, { color: s.fg }]}>{s.label}</Text>
              </View>
            </View>
            <Text style={[S.tiny, { marginTop: 4 }]}>
              {time(item.synced_at)}
              {item.distance_m !== null ? ` · المسافة ${Math.round(item.distance_m)} م` : ''}
              {item.counted === 1 ? ' · محتسبة كزيارة اليوم' : ' · غير محتسبة'}
            </Text>
            {item.message && <Text style={[S.muted, { marginTop: 4 }]}>{item.message}</Text>}
          </View>
        );
      }}
    />
  );
}
