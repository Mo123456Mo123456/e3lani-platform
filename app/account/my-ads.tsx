import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { EmptyState, OutlineButton, ScreenTitle, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { mapFeedAd } from "@/lib/map-feed-ad";
import { trpc } from "@/lib/trpc";

export default function MyAds() {
  const store = useE3lani();
  const { t, locale } = useI18n();
  const mineQuery = trpc.ads.mine.useQuery(undefined, { enabled: Boolean(store.user) });
  const appeal = trpc.ads.appeal.useMutation({ onSuccess: () => void mineQuery.refetch() });
  const data = (mineQuery.data ?? []).map((item) => mapFeedAd(item));

  if (!store.user) {
    return (
      <ScreenContainer className="px-4">
        <EmptyState
          icon="lock"
          title={t("signIn")}
          text={t("loginHelp")}
          actionLabel={t("signIn")}
          onAction={() => router.push("/login" as never)}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle title={t("myAds")} />
      {mineQuery.isLoading ? <ActivityIndicator color={BRAND.yellowDark} /> : null}
      {data.length ? (
        <FlatList
          data={data}
          keyExtractor={(ad) => ad.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.card}>
              <Text numberOfLines={2} style={s.title}>
                {item.title}
              </Text>
              <StatusBadge status={item.status} />
              <Text style={s.id}>
                {item.id} · v{item.revision}
                {item.countryCode ? ` · ${item.countryCode}` : ""}
              </Text>
              {item.status === "paused" ? (
                <OutlineButton
                  label={locale === "ar" ? "طلب استئناف" : "Request appeal"}
                  icon="gavel"
                  onPress={() =>
                    void appeal.mutateAsync({
                      id: item.id,
                      message:
                        locale === "ar"
                          ? "أطلب مراجعة قرار الإيقاف الآلي. المحتوى متوافق مع السياسات."
                          : "Please review the automated pause. The content complies with policy.",
                    })
                  }
                />
              ) : null}
            </View>
          )}
        />
      ) : !mineQuery.isLoading ? (
        <EmptyState
          icon="campaign"
          title={t("noAds")}
          text={t("mediaHelp")}
          actionLabel={t("create")}
          onAction={() => router.push("/create-ad" as never)}
        />
      ) : null}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  list: { paddingTop: 16, paddingBottom: 30 },
  card: {
    marginBottom: 11,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    padding: 16,
    backgroundColor: BRAND.white,
    gap: 8,
  },
  title: { color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900", textAlign: "right" },
  id: { color: BRAND.muted, fontSize: 11, lineHeight: 16, textAlign: "right" },
});
