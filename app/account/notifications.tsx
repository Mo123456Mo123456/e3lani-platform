import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Notifications() {
  const { notifications, markNotificationsRead } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const allRead = notifications.every((item) => item.read);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === "ar" ? "عودة" : "Back"}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={25} color={BRAND.black} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("notifications")}</Text>
        {notifications.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("readAll")}
            accessibilityState={{ disabled: allRead }}
            disabled={allRead}
            onPress={markNotificationsRead}
            style={({ pressed }) => [
              styles.readButton,
              allRead && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.read}>{t("readAll")}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {notifications.length ? (
        <FlatList
          data={notifications}
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
                <View style={[styles.cardHead, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={[styles.dot, item.read && styles.dotRead]} />
                  <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{item.title}</Text>
                </View>
                <Text style={[styles.body, { textAlign: isRTL ? "right" : "left" }]}>{item.body}</Text>
                <Text style={[styles.date, { textAlign: isRTL ? "right" : "left" }]}>{date}</Text>
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
  header: {
    minHeight: 64,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: { width: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 21, lineHeight: 28, fontWeight: "900" },
  readButton: {
    minWidth: 72,
    minHeight: 44,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  read: { color: BRAND.warning, fontSize: 10, lineHeight: 15, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  list: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 16, paddingBottom: 30 },
  card: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 17,
    padding: 15,
    backgroundColor: BRAND.white,
  },
  unread: { borderColor: "#F0D45E", backgroundColor: "#FFF9E5" },
  cardHead: { alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.yellowDark },
  dotRead: { backgroundColor: BRAND.border },
  title: { flex: 1, color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900" },
  body: { marginTop: 5, color: BRAND.muted, fontSize: 12, lineHeight: 19 },
  date: { marginTop: 8, color: BRAND.muted, fontSize: 9, lineHeight: 14 },
});
