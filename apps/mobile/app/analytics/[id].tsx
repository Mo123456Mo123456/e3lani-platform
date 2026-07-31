import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdAnalyticsDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Card, EmptyState, Loading } from '@/components/ui';

export default function AdAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [data, setData] = React.useState<AdAnalyticsDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void api<AdAnalyticsDto>(`/ads/${id}/analytics`, { auth: true })
      .then(setData)
      .catch((err) => setError(err?.message ?? 'تعذّر تحميل التحليلات'));
  }, [id]);

  if (error) return <EmptyState title={error} />;
  if (!data) return <Loading />;

  const stats: [string, string][] = [
    ['مرات الظهور', String(data.impressions)],
    ['الوصول الفريد', String(data.uniqueReach)],
    ['مشاهدات الفيديو', String(data.videoViews)],
    ['متوسط المشاهدة', `${(data.averageWatchMs / 1000).toFixed(1)} ث`],
    ['نسبة الإكمال', `${Math.round(data.completionRate * 100)}%`],
    ['إجمالي النقرات', String(data.clicks.total)],
    ['واتساب', String(data.clicks.whatsapp)],
    ['اتصال', String(data.clicks.call)],
    ['المتجر', String(data.clicks.store)],
    ['الروابط', String(data.clicks.link)],
    ['الحفظ', String(data.saves)],
    ['المشاركات', String(data.shares)],
    ['ظهور طبيعي', String(data.bySource.ORGANIC)],
    ['ظهور مدفوع', String(data.bySource.PROMOTED)],
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}
    >
      <Text style={theme.text.title}>تحليلات الإعلان</Text>

      <View style={styles.grid}>
        {stats.map(([label, value]) => (
          <Card key={label} style={styles.statCard}>
            <Text style={theme.text.caption}>{label}</Text>
            <Text style={theme.text.subtitle}>{value}</Text>
          </Card>
        ))}
      </View>

      <Card style={{ gap: 6 }}>
        <Text style={theme.text.subtitle}>أفضل أداء</Text>
        <Text style={theme.text.caption}>
          أفضل يوم: {data.bestDay ? `${data.bestDay.date} (${data.bestDay.impressions})` : 'لا توجد بيانات'}
        </Text>
        <Text style={theme.text.caption}>
          أفضل ساعة:{' '}
          {data.bestHour ? `${String(data.bestHour.hour).padStart(2, '0')}:00` : 'لا توجد بيانات'}
        </Text>
      </Card>

      {data.topCities.length ? (
        <Card style={{ gap: 6 }}>
          <Text style={theme.text.subtitle}>أفضل المدن</Text>
          {data.topCities.map((city) => (
            <View key={city.cityId} style={styles.cityRow}>
              <Text style={theme.text.body}>{city.nameAr}</Text>
              <Text style={theme.text.body}>{city.impressions}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48%', gap: 4 },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
