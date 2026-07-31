import * as React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationDto, PaginatedDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { Button, EmptyState, Loading } from '@/components/ui';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = React.useState<NotificationDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void api<PaginatedDto<NotificationDto>>('/notifications?limit=30', { auth: true })
      .then((page) => setItems(page.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="سجّل الدخول لعرض إشعاراتك"
          action={<Button title="تسجيل الدخول" onPress={() => router.push('/login')} />}
        />
      </View>
    );
  }

  if (loading) return <Loading />;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={[theme.text.title, { padding: 14 }]}>الإشعارات</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState title="لا توجد إشعارات" />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={[styles.item, item.readAt ? null : styles.unread]}>
            <Text style={theme.text.body}>{item.titleAr}</Text>
            <Text style={[theme.text.caption, { marginTop: 4 }]}>{item.bodyAr}</Text>
          </View>
        )}
        onEndReached={() => {
          void api('/notifications/read-all', { method: 'POST', auth: true }).catch(() => undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  item: { padding: 14 },
  unread: { backgroundColor: '#FFFBEB' },
  separator: { height: 1, backgroundColor: theme.colors.border },
});
