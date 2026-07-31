import * as React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { AdDto, PaginatedDto, PostDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { Button, EmptyState, Loading } from '@/components/ui';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = React.useState<'ads' | 'posts'>('ads');
  const [ads, setAds] = React.useState<AdDto[]>([]);
  const [posts, setPosts] = React.useState<PostDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [adsPage, postsPage] = await Promise.all([
        api<PaginatedDto<AdDto>>('/saved/ads', { auth: true }),
        api<PaginatedDto<PostDto>>('/saved/posts', { auth: true }),
      ]);
      setAds(adsPage.items);
      setPosts(postsPage.items);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="سجّل الدخول لعرض محفوظاتك"
          action={<Button title="تسجيل الدخول" onPress={() => router.push('/login')} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={[theme.text.title, { paddingHorizontal: 14 }]}>المحفوظات</Text>

      <View style={styles.tabs}>
        {(
          [
            ['ads', 'الإعلانات'],
            ['posts', 'المنشورات'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key ? styles.tabActive : null]}
          >
            <Text style={[styles.tabLabel, tab === key ? styles.tabLabelActive : null]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : tab === 'ads' ? (
        <FlatList
          data={ads}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 8, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          ListEmptyComponent={<EmptyState title="لا توجد إعلانات محفوظة" />}
          renderItem={({ item }) => (
            <Pressable style={styles.gridItem} onPress={() => router.push(`/ad/${item.id}`)}>
              <Image
                source={{ uri: item.media[0]?.thumbnailUrl ?? undefined }}
                style={styles.gridImage}
                contentFit="cover"
              />
              <Text numberOfLines={2} style={styles.gridTitle}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          ListEmptyComponent={<EmptyState title="لا توجد منشورات محفوظة" />}
          renderItem={({ item }) => (
            <Pressable style={styles.postCard} onPress={() => router.push(`/u/${item.owner.id}`)}>
              {item.media[0]?.url ? (
                <Image source={{ uri: item.media[0].url }} style={styles.postImage} contentFit="cover" />
              ) : null}
              <Text numberOfLines={3} style={styles.postCaption}>
                {item.caption}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.ink },
  tabLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.inkMuted },
  tabLabelActive: { color: theme.colors.white },
  gridItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', aspectRatio: 0.8, backgroundColor: theme.colors.surface },
  gridTitle: { fontSize: 13, fontWeight: '600', padding: 8, color: theme.colors.ink },
  postCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  postImage: { width: '100%', height: 200, backgroundColor: theme.colors.surface },
  postCaption: { padding: 12, fontSize: 14, color: theme.colors.ink },
});
