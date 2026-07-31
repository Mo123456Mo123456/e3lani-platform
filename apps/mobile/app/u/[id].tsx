import * as React from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto, PaginatedDto, PostDto, PublicAccountDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Avatar, EmptyState, Loading } from '@/components/ui';

type Account = PublicAccountDto & {
  shareUrl: string;
  stats?: { activeAds: number; posts: number; totalViews: number };
};

/** صفحة صاحب الحساب / البراند — تبويبان: الإعلانات | المنشورات. */
export default function AccountPublicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [account, setAccount] = React.useState<Account | null>(null);
  const [tab, setTab] = React.useState<'ads' | 'posts'>('ads');
  const [ads, setAds] = React.useState<AdDto[]>([]);
  const [posts, setPosts] = React.useState<PostDto[]>([]);

  React.useEffect(() => {
    void Promise.all([
      api<Account>(`/accounts/${id}`),
      api<PaginatedDto<AdDto>>(`/accounts/${id}/ads`),
      api<PaginatedDto<PostDto>>(`/accounts/${id}/posts`),
    ])
      .then(([profile, adsPage, postsPage]) => {
        setAccount(profile);
        setAds(adsPage.items);
        setPosts(postsPage.items);
      })
      .catch(() => setAccount(null));
  }, [id]);

  if (!account) return <Loading />;

  const business = account.business;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.cover}>
        {business?.coverUrl ? (
          <Image source={{ uri: business.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <Pressable
          style={[styles.back, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          accessibilityLabel="رجوع"
        >
          <Ionicons name="arrow-forward" size={20} color={theme.colors.ink} />
        </Pressable>
      </View>

      <View style={{ padding: 16, marginTop: -34, gap: 10 }}>
        <Avatar uri={business?.logoUrl ?? account.avatarUrl} name={account.name} size={72} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={theme.text.title}>{account.name}</Text>
          {account.isVerified ? (
            <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() =>
              Share.share({ message: `${account.name}\n${account.shareUrl}` }).catch(() => undefined)
            }
            accessibilityLabel="مشاركة"
          >
            <Ionicons name="share-social-outline" size={20} color={theme.colors.inkMuted} />
          </Pressable>
        </View>

        {account.cityNameAr ? <Text style={theme.text.caption}>{account.cityNameAr}</Text> : null}
        {business?.bio ? <Text style={styles.bio}>{business.bio}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {business?.whatsapp ? (
            <Pressable
              style={styles.linkChip}
              onPress={() => Linking.openURL(`https://wa.me/${business.whatsapp}`)}
            >
              <Ionicons name="logo-whatsapp" size={14} color={theme.colors.ink} />
              <Text style={styles.linkText}>واتساب</Text>
            </Pressable>
          ) : null}
          {business?.contactPhone ? (
            <Pressable
              style={styles.linkChip}
              onPress={() => Linking.openURL(`tel:+${business.contactPhone}`)}
            >
              <Ionicons name="call" size={14} color={theme.colors.ink} />
              <Text style={styles.linkText}>اتصال</Text>
            </Pressable>
          ) : null}
          {business?.storeUrl ? (
            <Pressable style={styles.linkChip} onPress={() => Linking.openURL(business.storeUrl!)}>
              <Ionicons name="storefront" size={14} color={theme.colors.ink} />
              <Text style={styles.linkText}>المتجر</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.stats}>
          {(
            [
              ['الإعلانات', account.stats?.activeAds ?? 0],
              ['المنشورات', account.stats?.posts ?? 0],
              ['المشاهدات', account.stats?.totalViews ?? 0],
            ] as [string, number][]
          ).map(([label, value]) => (
            <View key={label} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={theme.text.caption}>{label}</Text>
              <Text style={theme.text.subtitle}>{value.toLocaleString('ar-SA')}</Text>
            </View>
          ))}
        </View>
      </View>

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

      {tab === 'ads' ? (
        ads.length ? (
          <View style={styles.grid}>
            {ads.map((ad) => (
              <Pressable key={ad.id} style={styles.gridItem} onPress={() => router.push(`/ad/${ad.id}`)}>
                <Image
                  source={{ uri: ad.media[0]?.thumbnailUrl ?? undefined }}
                  style={styles.gridImage}
                  contentFit="cover"
                />
                <Text numberOfLines={2} style={styles.gridTitle}>
                  {ad.title}
                </Text>
                {ad.price !== null ? (
                  <Text style={styles.gridPrice}>{ad.price.toLocaleString('ar-SA')} ر.س</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="لا توجد إعلانات نشطة" />
        )
      ) : posts.length ? (
        <View style={{ padding: 12, gap: 12 }}>
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              {post.media[0]?.url ? (
                <Image source={{ uri: post.media[0].url }} style={styles.postImage} contentFit="cover" />
              ) : null}
              <Text style={styles.postCaption}>{post.caption}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="لا توجد منشورات" description="المنشورات المجانية تظهر هنا فقط." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  cover: { height: 150, backgroundColor: '#FFF6D9' },
  back: {
    position: 'absolute',
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: { fontSize: 14, lineHeight: 24, color: theme.colors.ink, textAlign: 'right' },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkText: { fontSize: 12, fontWeight: '700', color: theme.colors.ink },
  stats: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 12,
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.inkMuted },
  tabLabelActive: { color: theme.colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  gridItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', aspectRatio: 0.8, backgroundColor: theme.colors.surface },
  gridTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 8, paddingTop: 8 },
  gridPrice: { fontSize: 13, fontWeight: '800', padding: 8 },
  postCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  postImage: { width: '100%', height: 240, backgroundColor: theme.colors.surface },
  postCaption: { padding: 12, fontSize: 14, lineHeight: 24, color: theme.colors.ink, textAlign: 'right' },
});
