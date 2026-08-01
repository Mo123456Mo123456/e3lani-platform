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
import { track, flushEvents, getDeviceId } from '@/lib/track';
import { theme } from '@/lib/theme';
import { cacheAgeLabel, offlineCache } from '@/lib/offline-cache';
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
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [ticker, setTicker] = React.useState<TickerLogoDto[]>([]);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [offlineSince, setOfflineSince] = React.useState<number | null>(null);
  const seen = React.useRef(new Set<string>());

  const screenHeight = Dimensions.get('window').height;
  // ارتفاع البطاقة = الشاشة ناقص: المنطقة الآمنة العلوية + الشريط الإعلاني +
  // شريط التبويبات + شريط التنقّل السفلي (بمنطقته الآمنة)
  const itemHeight = screenHeight - insets.top - 40 - 44 - (64 + insets.bottom);

  React.useEffect(() => {
    void api<{ enabled: boolean; logos: TickerLogoDto[] }>('/ticker')
      .then((response) => {
        const logos = response.enabled ? response.logos : [];
        setTicker(logos);
        void offlineCache.saveTicker(logos);
      })
      .catch(async () => setTicker(await offlineCache.readTicker()));
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
            deviceId: await getDeviceId(),
          })}`,
          { auth: Boolean(user) },
        );
        setItems((current) => (nextCursor ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setOfflineSince(null);
        if (!nextCursor) {
          setActiveId(page.items[0]?.id ?? null);
          // نحتفظ بالصفحة الأولى لعرضها إذا انقطعت الشبكة لاحقًا
          void offlineCache.saveFeed(nextTab, page.items);
        }
      } catch {
        setHasMore(false);
        if (nextCursor) return;

        // فشل التحميل: نعرض آخر نسخة محفوظة بدل شاشة فارغة
        const cached = await offlineCache.readFeed(nextTab);
        if (cached) {
          setItems(cached.items);
          setActiveId(cached.items[0]?.id ?? null);
          setOfflineSince(cached.savedAt);
        } else {
          setItems([]);
        }
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
      setActiveIndex(viewableItems[0]?.index ?? 0);
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

      {offlineSince ? (
        <Pressable style={styles.offlineBar} onPress={() => void load(tab, null)}>
          <Ionicons name="cloud-offline-outline" size={14} color={theme.colors.ink} />
          <Text style={styles.offlineText}>
            تتصفح نسخة محفوظة ({cacheAgeLabel(offlineSince)}) — اضغط للتحديث
          </Text>
        </Pressable>
      ) : null}

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
          // نرسم عنصرين أمام الحالي حتى يبدأ تحميل وسائطهما قبل وصول المستخدم إليهما
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item, index }) => (
            <AdFeedItem
              ad={item}
              active={activeId === item.id}
              preload={index === activeIndex + 1 || index === activeIndex + 2}
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
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3DC',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  offlineText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink },
});
