import { useEffect } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { EmptyState, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { mapFeedAd } from "@/lib/map-feed-ad";
import { trpc } from "@/lib/trpc";

export default function Saved() {
  const { setSavedIds } = useE3lani();
  const { t } = useI18n();
  const savedQuery = trpc.ads.saved.useQuery();
  const items = (savedQuery.data ?? []).map((item) => mapFeedAd(item));

  useEffect(() => {
    if (savedQuery.data) setSavedIds(savedQuery.data.map((item) => item.id));
  }, [savedQuery.data, setSavedIds]);

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle title={t("saved")} />
      {savedQuery.isLoading ? (
        <ActivityIndicator color={BRAND.yellowDark} />
      ) : items.length === 0 ? (
        <EmptyState icon="bookmark-border" title={t("emptySaved")} text={t("save")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.item}>
              <AdCard ad={item} height={430} />
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  list: { paddingTop: 15, paddingBottom: 30 },
  item: { marginBottom: 14 },
});
