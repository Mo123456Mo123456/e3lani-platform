import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { AdCard } from "@/components/e3lani/ad-card";
import { EmptyState, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { createIdempotencyKey } from "@/lib/analytics-identity";
import { centralAdToClientAd } from "@/lib/central-data-adapter";
import { BRAND, type Ad } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Saved() {
  const { t } = useI18n();
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const favoritesQuery = trpc.data.favorites.list.useQuery(
    { limit: 100 },
    { enabled: Boolean(sessionQuery.data), retry: false },
  );
  const toggleMutation = trpc.data.favorites.toggle.useMutation({
    onSuccess: async () => {
      await favoritesQuery.refetch();
    },
  });
  const eventMutation = trpc.data.events.record.useMutation();
  const items = (favoritesQuery.data ?? []).map(centralAdToClientAd);

  const toggleSave = async (ad: Ad) => {
    await toggleMutation.mutateAsync({ publicAdId: ad.id });
  };

  const trackShare = async (ad: Ad) => {
    await eventMutation.mutateAsync({
      publicAdId: ad.id,
      eventType: "share",
      idempotencyKey: createIdempotencyKey("share", ad.id),
    });
  };

  if (sessionQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle title={t("saved")} />
      {!sessionQuery.data ? (
        <EmptyState
          icon="lock"
          title={t("signIn")}
          text={t("loginHelp")}
          actionLabel={t("signIn")}
          onAction={() => router.push("/login" as never)}
        />
      ) : favoritesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      ) : favoritesQuery.isError ? (
        <EmptyState
          icon="cloud-off"
          title={t("error")}
          text={t("emptyHelp")}
          actionLabel={t("retry")}
          onAction={() => void favoritesQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState icon="bookmark-border" title={t("emptySaved")} text={t("save")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <AdCard
                ad={item}
                height={430}
                saved
                metrics={item.metrics}
                onToggleSave={toggleSave}
                onShareTracked={trackShare}
              />
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center" },
  list: { paddingTop: 15, paddingBottom: 30 },
  item: { marginBottom: 14 },
});
