import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Create() {
  const { user } = useE3lani();
  const { locale, isRTL, t } = useI18n();
  const route = user ? "/create-ad" : "/login";

  return (
    <ScreenContainer>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t("create")}</Text>
        <Text style={styles.logo}>إعلاني<Text style={styles.logoDot}>.</Text></Text>
      </View>

      <ScrollView contentContainerStyle={styles.page}>
        <View style={[styles.notice, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <MaterialIcons name="verified" size={22} color={BRAND.black} />
          <Text style={[styles.noticeText, { textAlign: isRTL ? "right" : "left" }]}>
            <Text style={styles.noticeTitle}>
              {locale === "ar" ? "النشر مجاني حاليًا" : "Publishing is currently free"}
            </Text>
            {"\n"}
            {locale === "ar"
              ? "أنشئ محتواك الآن، ولن تُحصّل أي رسوم ما دام الدفع معطلًا."
              : "Create your content now. No fee is charged while payments are disabled."}
          </Text>
        </View>

        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("addMedia")}
            onPress={() => router.push(route as never)}
            style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
          >
            <View style={styles.uploadIcon}>
              <MaterialIcons name="add" size={31} color={BRAND.black} />
            </View>
            <Text style={styles.uploadTitle}>{t("addMedia")}</Text>
            <Text style={styles.uploadHelp}>{t("mediaHelp")}</Text>
          </Pressable>

          <View style={styles.steps}>
            <Step icon="photo-library" label={t("media")} />
            <Step icon="edit-note" label={t("data")} />
            <Step icon="call" label={t("communication")} />
            <Step icon="visibility" label={t("preview")} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={user ? t("create") : t("signIn")}
            onPress={() => router.push(route as never)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>
              {user
                ? locale === "ar"
                  ? "ابدأ إضافة الإعلان"
                  : "Start creating your ad"
                : t("signIn")}
            </Text>
            <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={21} color={BRAND.black} />
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Step({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}><MaterialIcons name={icon} size={21} color={BRAND.black} /></View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: BRAND.black, fontSize: 21, lineHeight: 28, fontWeight: "900" },
  logo: { color: BRAND.black, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  logoDot: { color: BRAND.yellowDark },
  page: { width: "100%", maxWidth: 680, alignSelf: "center", padding: 16, paddingBottom: 34 },
  notice: {
    minHeight: 74,
    borderWidth: 1,
    borderColor: "#F0D45E",
    borderRadius: 16,
    padding: 13,
    backgroundColor: "#FFF7D2",
    alignItems: "flex-start",
    gap: 9,
  },
  noticeText: { flex: 1, color: BRAND.black, fontSize: 12, lineHeight: 19 },
  noticeTitle: { fontWeight: "900" },
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    padding: 16,
    backgroundColor: BRAND.white,
  },
  upload: {
    height: 174,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D4D4D4",
    borderRadius: 17,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: { marginTop: 9, color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  uploadHelp: { marginTop: 4, color: BRAND.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  steps: { marginTop: 16, flexDirection: "row-reverse", justifyContent: "space-between", gap: 7 },
  step: { flex: 1, alignItems: "center", gap: 5 },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: BRAND.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { color: BRAND.muted, fontSize: 9, lineHeight: 13, fontWeight: "800", textAlign: "center" },
  primary: {
    minHeight: 52,
    marginTop: 18,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: BRAND.yellow,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryText: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  pressed: { opacity: 0.65 },
});
