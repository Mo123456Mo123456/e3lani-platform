import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Notifications() {
  const store = useE3lani();
  const { locale, t } = useI18n();
  const listQuery = trpc.notifications.list.useQuery(undefined, { enabled: Boolean(store.user) });
  const utils = trpc.useUtils();
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => void utils.notifications.list.invalidate(),
  });

  const items = (listQuery.data ?? []).map((row) => ({
    id: row.id,
    title: locale === "ar" ? row.titleAr : row.titleEn,
    body: locale === "ar" ? row.bodyAr : row.bodyEn,
    read: row.read,
    createdAt: row.createdAt,
  }));
  const allRead = items.length > 0 && items.every((item) => item.read);
  const readAllLabel = t("readAll");

  return (
    <ScreenContainer className="px-4">
      <ScreenTitle
        title={t("notifications")}
        action={
          items.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={readAllLabel}
              accessibilityState={{ disabled: allRead || !store.user }}
              disabled={allRead || !store.user}
              onPress={() => void markAll.mutateAsync()}
              style={({ pressed }) => [styles.readButton, allRead && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.read}>{readAllLabel}</Text>
            </Pressable>
          ) : null
        }
      />
      {!store.user ? (
        <EmptyState icon="lock" title={t("signIn")} text={t("loginHelp")} />
      ) : listQuery.isLoading ? (
        <ActivityIndicator color={BRAND.yellowDark} />
      ) : items.length ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const date = new Date(item.createdAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
            const state = item.read
              ? locale === "ar"
                ? "مقروء"
                : "Read"
              : locale === "ar"
                ? "غير مقروء"
                : "Unread";
            return (
              <View
                accessible
                accessibilityLabel={`${state}. ${item.title}. ${item.body}. ${date}`}
                style={[styles.card, !item.read && styles.unread]}
              >
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.date}>{date}</Text>
              </View>
            );
          }}
        />
      ) : (
        <EmptyState icon="notifications-none" title={t("notifications")} text={t("noAds")} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  readButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  read: { color: BRAND.warning, fontSize: 12, lineHeight: 18, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.6 },
  list: { paddingTop: 15, paddingBottom: 30 },
  card: {
    marginBottom: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    padding: 15,
    backgroundColor: BRAND.white,
  },
  unread: { borderColor: BRAND.yellowDark, backgroundColor: "#FFF9E5" },
  title: { color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900", textAlign: "right" },
  body: { marginTop: 4, color: BRAND.muted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  date: { marginTop: 7, color: BRAND.muted, fontSize: 9, lineHeight: 14, textAlign: "right" },
});
