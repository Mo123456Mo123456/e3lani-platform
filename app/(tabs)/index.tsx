import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdCard } from "@/components/e3lani/ad-card";
import { BrandTicker } from "@/components/e3lani/brand-ticker";
import { EmptyState, PrimaryButton } from "@/components/e3lani/ui";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import {
  buildMarkets,
  getMarket,
  GLOBAL_MARKET,
  MY_COUNTRY_MARKET,
  rankFeedAds,
  resolveMarketFilter,
  type FeedMode,
  type MarketCode,
} from "@/lib/feed/rank";
import { useI18n } from "@/lib/i18n";
import { mapFeedAd } from "@/lib/map-feed-ad";
import { trpc } from "@/lib/trpc";
import { useCountries } from "@/lib/use-countries";
import { useProductData } from "@/lib/use-product-data";

const TAB_BAR = 72;

export default function Home() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const {
    blockedOwners,
    ready,
    recordMetric,
    metrics,
    marketCode,
    forceCountryFilter,
    categoryFilter,
    setCategoryFilter,
    setMarket,
    setServerAds,
    launchPolicy,
    accountCountry,
  } = useE3lani();
  const productData = useProductData();
  const { countries } = useCountries();
  const markets = useMemo(() => buildMarkets(countries), [countries]);
  const { isRTL, t, locale } = useI18n();
  const [tab, setTab] = useState<FeedMode>("forYou");
  const [active, setActive] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const resolvedMarket = resolveMarketFilter(marketCode, accountCountry);
  const feedQuery = trpc.ads.feed.useQuery(
    {
      countryCode:
        tab === "nearby"
          ? accountCountry
          : resolvedMarket.code === GLOBAL_MARKET
            ? null
            : resolvedMarket.code,
      forceCountryFilter:
        tab === "nearby" ||
        marketCode === MY_COUNTRY_MARKET ||
        (forceCountryFilter && marketCode !== GLOBAL_MARKET),
      categorySlug: categoryFilter || null,
      limit: 50,
    },
    { staleTime: 30_000 },
  );
  const recordEvent = trpc.ads.recordEvent.useMutation();
  const listRef = useRef<FlatList<Ad>>(null);
  const seen = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;

  const serverAds = useMemo(
    () => (feedQuery.data ?? []).map((item) => mapFeedAd(item)),
    [feedQuery.data],
  );

  useEffect(() => {
    if (feedQuery.data) setServerAds(serverAds);
  }, [feedQuery.data, serverAds, setServerAds]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Ad }[] }) => {
      const id = viewableItems[0]?.item.id ?? "";
      setActive(id);
      if (id && !seen.current.has(id)) {
        seen.current.add(id);
        recordMetric(id, "impressions");
        recordMetric(id, "views");
        void recordEvent.mutateAsync({
          id,
          eventType: "view",
          dedupeSuffix: `device-${id}`,
        }).catch(() => undefined);
      }
    },
  ).current;

  useEffect(() => {
    if (typeof params.category === "string" && params.category) {
      setCategoryFilter(params.category);
      setTab("latest");
    }
  }, [params.category, setCategoryFilter]);

  const itemHeight = Math.max(height - TAB_BAR - insets.bottom, 520);
  const market = getMarket(marketCode, markets);

  const cities = useMemo(
    () =>
      productData.cities.map((city) => ({
        id: city.id,
        region: city.region,
        countryCode:
          city.id === "dubai" || city.id === "abu_dhabi" || city.id === "sharjah"
            ? "AE"
            : city.id === "cairo" || city.id === "giza" || city.id === "alexandria"
              ? "EG"
              : "SA",
      })),
    [productData.cities],
  );

  const visible = useMemo(
    () =>
      rankFeedAds(serverAds, {
        mode: tab,
        marketCode,
        accountCountry,
        categoryId: categoryFilter || undefined,
        cities,
        metrics,
        blockedOwners,
        allCountriesVisibility: launchPolicy.allCountriesVisibility,
        forceCountryFilter: tab === "nearby" ? true : forceCountryFilter,
      }),
    [
      serverAds,
      blockedOwners,
      categoryFilter,
      cities,
      marketCode,
      forceCountryFilter,
      metrics,
      tab,
      launchPolicy.allCountriesVisibility,
      accountCountry,
    ],
  );

  useEffect(() => {
    if (!params.focus || !ready) return;
    const index = visible.findIndex((ad) => ad.id === params.focus);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [params.focus, ready, visible]);

  if (!ready || feedQuery.isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={BRAND.yellowDark} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(ad) => ad.id}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={itemHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ height: itemHeight, width }}>
            <AdCard ad={item} height={itemHeight} active={active === item.id} fullscreen />
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyWrap, { height: itemHeight }]}>
            <EmptyState
              icon="campaign"
              title={t("noAds")}
              text={t("noAdsHelp")}
              actionLabel={t("create")}
              onAction={() => router.push("/(tabs)/create" as never)}
            />
          </View>
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={2}
        windowSize={3}
      />

      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top }]}>
        {launchPolicy.topBannerEnabled ? <BrandTicker /> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("market")}
          onPress={() => setMarketOpen(true)}
          style={styles.marketChip}
        >
          <Text style={styles.marketChipText}>
            {market.flag} {locale === "ar" ? market.nameAr : market.nameEn}
          </Text>
          <MaterialIcons name="expand-more" size={18} color={BRAND.black} />
        </Pressable>

        <View style={[styles.feedHead, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search")}
            onPress={() => router.push("/search" as never)}
            style={styles.round}
          >
            <MaterialIcons name="search" size={22} color={BRAND.white} />
          </Pressable>

          <View style={styles.tabs}>
            {(
              [
                ["forYou", t("forYou")],
                ["nearby", t("near")],
                ["latest", t("latest")],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => {
                  setTab(key);
                  if (key !== "latest") setCategoryFilter("");
                }}
                style={[styles.tab, tab === key && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications")}
            onPress={() => router.push("/account/notifications" as never)}
            style={styles.round}
          >
            <MaterialIcons name="notifications-none" size={22} color={BRAND.white} />
          </Pressable>
        </View>

        {categoryFilter ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCategoryFilter("")}
            style={styles.filterChip}
          >
            <Text style={styles.filterText}>
              {productData.categories.find((item) => item.id === categoryFilter)?.ar ?? categoryFilter}
            </Text>
            <MaterialIcons name="close" size={16} color={BRAND.white} />
          </Pressable>
        ) : null}
      </View>

      <Modal visible={marketOpen} transparent animationType="slide" onRequestClose={() => setMarketOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMarketOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {locale === "ar" ? "اختر السوق / الدولة" : "Choose market / country"}
            </Text>
            <Text style={styles.sheetHelp}>
              {locale === "ar"
                ? "الدولة معلومة تنظيمية فقط. الموجز الافتراضي عالمي ولا يُخفى إعلان بسبب دولة الحساب."
                : "Country is organizational only. The default feed is global and never hidden by account country."}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {markets.map((item) => (
                <Pressable
                  key={item.code}
                  style={[styles.option, marketCode === item.code && styles.optionActive]}
                  onPress={() => {
                    setMarket(
                      item.code as MarketCode,
                      item.code === MY_COUNTRY_MARKET ||
                        (item.code !== GLOBAL_MARKET && item.code !== "ALL"),
                    );
                    setMarketOpen(false);
                  }}
                >
                  <Text style={styles.optionFlag}>{item.flag}</Text>
                  <Text style={styles.optionName}>{locale === "ar" ? item.nameAr : item.nameEn}</Text>
                  {marketCode === item.code ? (
                    <MaterialIcons name="check" size={20} color={BRAND.black} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <PrimaryButton label={t("close")} onPress={() => setMarketOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.black },
  center: { alignItems: "center", justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  marketChip: {
    alignSelf: "center",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: BRAND.yellow,
  },
  marketChipText: { color: BRAND.black, fontSize: 12, fontWeight: "900" },
  feedHead: {
    marginTop: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.19)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.5)",
    gap: 2,
  },
  tab: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  tabActive: { backgroundColor: BRAND.yellow },
  tabText: { color: "#eee", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  filterChip: {
    alignSelf: "center",
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  filterText: { color: BRAND.white, fontSize: 12, fontWeight: "800" },
  emptyWrap: { justifyContent: "center", paddingHorizontal: 24 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BRAND.white,
    gap: 10,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#ddd",
    alignSelf: "center",
  },
  sheetTitle: { color: BRAND.black, fontSize: 20, fontWeight: "900", textAlign: "right" },
  sheetHelp: { color: BRAND.muted, fontSize: 12, lineHeight: 18, textAlign: "right" },
  option: {
    minHeight: 52,
    marginBottom: 8,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionActive: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF8D9" },
  optionFlag: { fontSize: 22 },
  optionName: { flex: 1, color: BRAND.black, fontSize: 15, fontWeight: "800", textAlign: "right" },
});
