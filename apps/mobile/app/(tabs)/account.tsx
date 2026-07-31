import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto, PaginatedDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { Avatar, Badge, Button, Card, EmptyState, Loading } from '@/components/ui';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'مسودة', tone: 'neutral' },
  PENDING_PAYMENT: { label: 'بانتظار الدفع', tone: 'warning' },
  ACTIVE: { label: 'نشط', tone: 'success' },
  PAUSED: { label: 'متوقف', tone: 'warning' },
  EXPIRED: { label: 'منتهي', tone: 'neutral' },
  REJECTED: { label: 'مرفوض', tone: 'danger' },
  REMOVED: { label: 'محذوف', tone: 'danger' },
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, loading } = useAuth();
  const [ads, setAds] = React.useState<AdDto[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    const page = await api<PaginatedDto<AdDto>>('/ads/mine?limit=20', { auth: true }).catch(
      () => null,
    );
    if (page) setAds(page.items);
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loading />;

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="أنشئ حسابك في دقيقة"
          description="سجّل برقم جوالك لإضافة إعلاناتك وحفظ ما يعجبك."
          action={<Button title="تسجيل الدخول" onPress={() => router.push('/login')} />}
        />
      </View>
    );
  }

  const publish = async (adId: string) => {
    setBusy(true);
    try {
      await api(`/ads/${adId}/publish`, { method: 'POST', auth: true });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Avatar uri={user.avatarUrl} name={user.name} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={theme.text.subtitle}>{user.name ?? 'حسابي'}</Text>
          <Text style={theme.text.caption}>{user.phone}</Text>
        </View>
        <Pressable onPress={() => void signOut()} accessibilityLabel="تسجيل الخروج">
          <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title="صفحتي العامة"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push(`/u/${user.id}`)}
        />
        <Button
          title="الإشعارات"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/notifications')}
        />
      </View>

      <Text style={theme.text.subtitle}>إعلاناتي</Text>

      {ads.length === 0 ? (
        <EmptyState
          title="لم تنشر أي إعلان بعد"
          action={<Button title="أضف إعلانًا" onPress={() => router.push('/(tabs)/create')} />}
        />
      ) : (
        ads.map((ad) => {
          const status = STATUS[ad.status] ?? { label: ad.status, tone: 'neutral' as const };
          return (
            <Card key={ad.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/ad/${ad.id}`)}>
                  <Text numberOfLines={1} style={theme.text.body}>
                    {ad.title}
                  </Text>
                </Pressable>
                <Badge label={status.label} tone={status.tone} />
              </View>
              <Text style={theme.text.caption}>
                {ad.viewsCount} مشاهدة · {ad.savesCount} حفظ
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['DRAFT', 'EXPIRED', 'PAUSED'].includes(ad.status) ? (
                  <Button
                    title="نشر"
                    style={{ flex: 1, height: 40 }}
                    loading={busy}
                    onPress={() => void publish(ad.id)}
                  />
                ) : null}
                <Button
                  title="التحليلات"
                  variant="outline"
                  style={{ flex: 1, height: 40 }}
                  onPress={() => router.push(`/analytics/${ad.id}`)}
                />
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
