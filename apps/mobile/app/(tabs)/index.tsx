import * as React from 'react';
import {
  Dimensions, FlatList, Pressable, Share, StyleSheet, Text, View, type ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto, PaginatedDto, TickerLogoDto } from '@e3lani/types';
import { api, buildQuery } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { track, flushEvents } from '@/lib/track';
import { theme } from '@/lib/theme';
import { TickerBar } from '@/components/ticker-bar';
import { AdFeedItem } from '@/components/ad-feed-item';
import { EmptyState, Loading } from '@/components/ui';

const TABS = [
  { key: 'for-you', label: 'لك' },
  { key: 'nearby', label: 'قريب منك' },
  { key: 'latest', label: 'الأحدث' },
] as const;

type Tab = (typeof TABS)[number]['key'];

/** الصفحة الرئيسية — تصفح عمودي إعلانًا بعد إعلان. */
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = React.useState<Tab>('for-you');
  const [items, setItems] = React.useState<AdDto[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [ticker, setTicker] = React.useState<TickerLogoDto[]>([]);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const seen = React.useRef(new Set<string>());

  const screenHeight = Dimensions.get('window').height;
  const itemHeight = screenHeight - insets.top - 40 - 62 - 44;

  React.useEffect(() => {
    void api<{ enabled: boolean; logos: TickerLogoDto[] }>('/ticker')
      .then((response) => setTicker(response.enabled ? response.logos : []))
      .catch(() => undefined);
    return () => {
      void flushEvents();
    };
  }, []);

  const load = React.useCallback(
    async (nextTab: Tab, nextCursor?: string | null) => {
      if (!nextCursor) setLoading(true);
      try {
        const page = await api<PaginatedDto<AdDto>>(
          `/feed${buildQuery({
            tab: nextTab,
            cursor: nextCursor ?? undefined,
            limit: 6,
            lat: nextTab === 'nearby' ? coords?.lat : undefined,
            lng: nextTab === 'nearby' ? coords?.lng : undefined,
          })}`,
          { auth: Boolean(user) },
        );
        setItems((current) => (nextCursor ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        if (!nextCursor) setActiveId(page.items[0]?.id ?? null);
      } catch {
        if (!nextCursor) setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [coords, user],
  );

  React.useEffect(() => {
    void load(tab, null);
  }, [tab, load]);

  const selectTab = async (next: Tab) => {
    if (next === 'nearby' && !coords) {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      }
    }
    setTab(next);
  };

  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as AdDto | undefined;
      if (!first) return;
      setActiveId(first.id);
      if (!seen.current.has(first.id)) {
        seen.current.add(first.id);
        track(first.id, 'IMPRESSION');
        if (first.media.some((media) => media.type === 'VIDEO')) track(first.id, 'VIEW_START');
      }
    },
  ).current;

  const shareAd = async (ad: AdDto) => {
    track(ad.id, 'SHARE');
    await api(`/ads/${ad.id}/share`, { method: 'POST' }).catch(() => undefined);
    await Share.share({ message: `${ad.title}\n${ad.shareUrl}` }).catch(() => undefined);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TickerBar logos={ticker} />

      <View style={styles.header}>
        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => void selectTab(item.key)}
              style={[styles.tab, tab === item.key ? styles.tabActive : null]}
            >
              <Text style={[styles.tabLabel, tab === item.key ? styles.tabLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/search')} accessibilityLabel="البحث">
            <Ionicons name="search" size={22} color={theme.colors.ink} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} accessibilityLabel="الإشعارات">
            <Ionicons name="notifications-outline" size={22} color={theme.colors.ink} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <Loading label="جارٍ تحميل الإعلانات…" />
      ) : items.length === 0 ? (
        <EmptyState title="لا توجد إعلانات بعد" description="جرّب تبويبًا آخر أو ابحث عن قسم يهمّك." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          pagingEnabled
          snapToInterval={itemHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasMore && cursor) void load(tab, cursor);
          }}
          renderItem={({ item }) => (
            <AdFeedItem
              ad={item}
              active={activeId === item.id}
              height={itemHeight}
              isAuthed={Boolean(user)}
              onShare={shareAd}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  tabActive: { backgroundColor: theme.colors.ink },
  tabLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.inkMuted },
  tabLabelActive: { color: theme.colors.white },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
});
