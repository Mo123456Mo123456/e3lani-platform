import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton, ScreenTitle, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Brand() {
  const { locale, isRTL, t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const initialized = useRef(false);
  const sessionQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const profileQuery = trpc.data.advertisers.mine.useQuery(undefined, {
    enabled: Boolean(sessionQuery.data),
    retry: 1,
  });
  const upsertMutation = trpc.data.advertisers.upsert.useMutation({
    onSuccess: async () => {
      await profileQuery.refetch();
    },
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile || initialized.current) return;
    initialized.current = true;
    setDisplayName(profile.displayName);
    setSlug(profile.slug ?? "");
    setBio(profile.bio);
    setWebsiteUrl(profile.websiteUrl ?? "");
    setLogoUrl(profile.logoUrl ?? "");
    setCoverUrl(profile.coverUrl ?? "");
  }, [profileQuery.data]);

  const save = async () => {
    if (upsertMutation.isPending) return;
    try {
      await upsertMutation.mutateAsync({
        displayName: displayName.trim(),
        slug: slug.trim(),
        bio: bio.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
      });
      Alert.alert(
        t("success"),
        locale === "ar" ? "تم حفظ صفحة المعلن في الخادم." : "The advertiser page was saved on the server.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "ADVERTISER_OPERATION_FAILED";
      const detail = message.includes("SLUG_TAKEN")
        ? locale === "ar" ? "الرابط المختصر مستخدم. اختر رابطًا آخر." : "This slug is already used. Choose another."
        : message.includes("SLUG_RESERVED")
          ? locale === "ar" ? "هذا الرابط محجوز للنظام." : "This slug is reserved by the system."
          : locale === "ar" ? "تعذر حفظ صفحة المعلن. تحقق من البيانات والاتصال." : "The advertiser page could not be saved. Check the data and connection.";
      Alert.alert(t("error"), detail);
    }
  };

  if (sessionQuery.isLoading || profileQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
        </View>
      </ScreenContainer>
    );
  }

  if (!sessionQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <MaterialIcons name="lock" size={42} color={BRAND.yellowDark} />
          <Text style={styles.centerTitle}>{t("signIn")}</Text>
          <PrimaryButton label={t("signIn")} icon="login" onPress={() => router.replace("/login" as never)} />
        </View>
      </ScreenContainer>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <MaterialIcons name="cloud-off" size={42} color={BRAND.error} />
          <Text style={styles.centerTitle}>{t("error")}</Text>
          <PrimaryButton label={t("retry")} icon="refresh" onPress={() => void profileQuery.refetch()} />
        </View>
      </ScreenContainer>
    );
  }

  const profile = profileQuery.data;

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={locale === "ar" ? "صفحة المعلن" : "Advertiser page"}
          subtitle={locale === "ar" ? "ملف عام مركزي يعرض منشوراتك النشطة المجانية." : "A central public profile that displays your active free posts."}
        />

        <View style={[styles.statusRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <StatusBadge status={profile.verificationStatus} />
          <Text style={styles.statusHelp}>
            {locale === "ar" ? "التوثيق لا يُمنح من العميل، بل بعد مراجعة الخادم." : "Verification is not granted by the client; it requires server review."}
          </Text>
        </View>

        <View style={styles.stats}>
          <Stat icon="campaign" value={profile.stats.activePosts} label={locale === "ar" ? "منشورات نشطة" : "Active posts"} />
          <Stat icon="visibility" value={profile.stats.totalViews} label={t("views")} />
          <Stat icon="bookmark" value={profile.stats.totalSaves} label={t("saved")} />
        </View>

        <Field label={t("brandName")} value={displayName} onChangeText={setDisplayName} maxLength={120} />
        <Field
          label={locale === "ar" ? "الرابط المختصر بالإنجليزية" : "English profile slug"}
          value={slug}
          onChangeText={(value) => setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          autoCapitalize="none"
          maxLength={120}
          placeholder="my-advertiser-page"
        />
        <Text style={styles.slugPreview}>e3lani / advertiser / {slug || "..."}</Text>
        <Field label={locale === "ar" ? "نبذة المعلن" : "Advertiser bio"} value={bio} onChangeText={setBio} multiline maxLength={1000} />
        <Field label={t("website")} value={websiteUrl} onChangeText={setWebsiteUrl} keyboardType="url" autoCapitalize="none" />
        <Field label={locale === "ar" ? "رابط الشعار" : "Logo URL"} value={logoUrl} onChangeText={setLogoUrl} keyboardType="url" autoCapitalize="none" />
        <Field label={locale === "ar" ? "رابط الغلاف" : "Cover URL"} value={coverUrl} onChangeText={setCoverUrl} keyboardType="url" autoCapitalize="none" />

        <PrimaryButton
          label={upsertMutation.isPending ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : t("saveChanges")}
          icon="check"
          disabled={upsertMutation.isPending || displayName.trim().length < 2 || slug.trim().length < 3}
          onPress={() => void save()}
        />

        {profile.slug ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={locale === "ar" ? "عرض صفحة المعلن العامة" : "View public advertiser page"}
            onPress={() => router.push({ pathname: "/advertiser/[slug]", params: { slug: profile.slug! } } as never)}
            style={({ pressed }) => [styles.publicLink, pressed && styles.pressed]}
          >
            <MaterialIcons name="public" size={23} color={BRAND.black} />
            <Text style={styles.publicLinkText}>{locale === "ar" ? "عرض الصفحة العامة والمنشورات" : "View public page and posts"}</Text>
            <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color={BRAND.black} />
          </Pressable>
        ) : null}

        <View style={styles.freeNotice}>
          <MaterialIcons name="redeem" size={25} color={BRAND.black} />
          <View style={styles.freeCopy}>
            <Text style={styles.freeTitle}>{locale === "ar" ? "المنشورات مجانية حاليًا" : "Posts are currently free"}</Text>
            <Text style={styles.freeText}>{locale === "ar" ? "لا توجد رسوم أو طلب دفع عند النشر في وضع الإطلاق المجاني." : "There is no fee or payment request during the free launch mode."}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof MaterialIcons.glyphMap; value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <MaterialIcons name={icon} size={20} color={BRAND.black} />
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  centerTitle: { color: BRAND.black, fontSize: 20, fontWeight: "900", textAlign: "center" },
  page: { paddingBottom: 40, gap: 14 },
  statusRow: { marginTop: 8, alignItems: "center", gap: 10 },
  statusHelp: { flex: 1, color: BRAND.muted, fontSize: 11, lineHeight: 18, textAlign: "right" },
  stats: { flexDirection: "row-reverse", gap: 8 },
  stat: { flex: 1, minHeight: 90, borderRadius: 17, backgroundColor: BRAND.surface, alignItems: "center", justifyContent: "center", gap: 2 },
  statValue: { color: BRAND.black, fontSize: 18, fontWeight: "900" },
  statLabel: { color: BRAND.muted, fontSize: 9, textAlign: "center" },
  slugPreview: { marginTop: -8, color: BRAND.muted, fontSize: 10, textAlign: "left" },
  publicLink: { minHeight: 56, borderRadius: 17, paddingHorizontal: 14, backgroundColor: BRAND.yellow, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  publicLinkText: { flex: 1, color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" },
  pressed: { opacity: 0.65 },
  freeNotice: { padding: 15, borderRadius: 18, backgroundColor: "#FFF8D6", flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  freeCopy: { flex: 1 },
  freeTitle: { color: BRAND.black, fontSize: 14, fontWeight: "900", textAlign: "right" },
  freeText: { marginTop: 3, color: BRAND.charcoal, fontSize: 11, lineHeight: 18, textAlign: "right" },
});
