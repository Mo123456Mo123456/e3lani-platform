import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, OutlineButton, PrimaryButton, ScreenTitle, StatusBadge } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Brand() {
  const store = useE3lani();
  const { locale, t } = useI18n();
  const profileQuery = trpc.advertisers.mine.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.advertisers.update.useMutation({
    onSuccess: () => void utils.advertisers.mine.invalidate(),
  });
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setDraft({
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      coverUrl: profile.coverUrl ?? "",
      tiktokUrl: profile.socialLinks.tiktok ?? "",
      snapchatUrl: profile.socialLinks.snapchat ?? "",
      instagramUrl: profile.socialLinks.instagram ?? "",
      whatsappUrl: profile.socialLinks.whatsapp ?? "",
      websiteUrl: profile.socialLinks.website ?? "",
      storeUrl: profile.socialLinks.store ?? "",
    });
  }, [profileQuery.data]);

  if (profileQuery.isLoading) {
    return (
      <ScreenContainer><View style={s.loading}><ActivityIndicator size="large" color={BRAND.yellowDark} /></View></ScreenContainer>
    );
  }
  const profile = profileQuery.data;
  if (!profile) return null;
  const field = (key: string) => draft[key] ?? "";
  const set = (key: string) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    try {
      await update.mutateAsync({
        username: field("username"),
        displayName: field("displayName"),
        bio: field("bio") || null,
        avatarUrl: field("avatarUrl") || null,
        coverUrl: field("coverUrl") || null,
        tiktokUrl: field("tiktokUrl") || null,
        snapchatUrl: field("snapchatUrl") || null,
        instagramUrl: field("instagramUrl") || null,
        whatsappUrl: field("whatsappUrl") || null,
        websiteUrl: field("websiteUrl") || null,
        storeUrl: field("storeUrl") || null,
      });
      Alert.alert(t("success"));
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={locale === "ar" ? "صفحة المعلن" : "Advertiser page"}
          subtitle={locale === "ar" ? "أنشئ هويتك العامة وروابطك الاجتماعية." : "Manage your public identity and social links."}
        />
        {store.launchPolicy.brandVerificationEnabled ? (
          <View style={s.status}><StatusBadge status={profile.isVerified ? "verified" : "unverified"} /></View>
        ) : null}
        <Field label={locale === "ar" ? "اسم المعلن" : "Display name"} value={field("displayName")} onChangeText={set("displayName")} />
        <Field label={locale === "ar" ? "اسم المستخدم (حروف إنجليزية وأرقام وشرطة سفلية)" : "Username"} value={field("username")} onChangeText={set("username")} autoCapitalize="none" />
        <Field label={locale === "ar" ? "نبذة قصيرة" : "Short bio"} value={field("bio")} onChangeText={set("bio")} multiline />
        <Field label={locale === "ar" ? "رابط الصورة الشخصية HTTPS" : "Avatar HTTPS URL"} value={field("avatarUrl")} onChangeText={set("avatarUrl")} keyboardType="url" autoCapitalize="none" />
        <Field label={locale === "ar" ? "رابط صورة الغلاف HTTPS" : "Cover HTTPS URL"} value={field("coverUrl")} onChangeText={set("coverUrl")} keyboardType="url" autoCapitalize="none" />
        {[
          ["tiktokUrl", "TikTok"],
          ["snapchatUrl", "Snapchat"],
          ["instagramUrl", "Instagram"],
          ["whatsappUrl", "WhatsApp"],
          ["websiteUrl", locale === "ar" ? "الموقع الإلكتروني" : "Website"],
          ["storeUrl", locale === "ar" ? "المتجر" : "Store"],
        ].map(([key, label]) => (
          <Field key={key} label={label} value={field(key)} onChangeText={set(key)} keyboardType="url" autoCapitalize="none" />
        ))}
        <PrimaryButton label={t("saveChanges")} icon="check" onPress={() => void save()} />
        <OutlineButton
          label={locale === "ar" ? "عرض الصفحة العامة" : "View public page"}
          icon="open-in-new"
          onPress={() => router.push({ pathname: "/advertiser/[username]", params: { username: profile.username } } as never)}
        />
        <OutlineButton label={locale === "ar" ? "إنشاء منشور" : "Create post"} icon="add-box" onPress={() => router.push("/create-post" as never)} />
        <Text style={s.note}>
          {locale === "ar"
            ? "تُفتح الروابط خارجيًا. لا تُدخل روابط غير موثوقة أو بيانات دخول."
            : "Links open externally. Never enter sign-in credentials in profile links."}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { paddingBottom: 35, gap: 14 },
  status: { marginTop: 14 },
  note: { color: BRAND.muted, fontSize: 12, lineHeight: 19, textAlign: "center" },
});
