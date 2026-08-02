import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { EmptyState, OutlineButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function ProfilePostDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { locale, isRTL } = useI18n();
  const postQuery = trpc.profilePosts.get.useQuery({ id }, { enabled: Boolean(id) });
  const event = trpc.profilePosts.recordEvent.useMutation();
  const remove = trpc.profilePosts.delete.useMutation();
  const report = trpc.profilePosts.report.useMutation();
  const viewed = useRef(false);
  const reportKey = useRef(
    `post_report_${id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
  );
  const post = postQuery.data;

  useEffect(() => {
    if (!post || viewed.current) return;
    viewed.current = true;
    void event.mutateAsync({ id: post.id, eventType: "view" }).catch(() => undefined);
  }, [event, post]);

  if (postQuery.isLoading) {
    return <ScreenContainer><View style={s.center}><ActivityIndicator color={BRAND.yellowDark} size="large" /></View></ScreenContainer>;
  }
  if (!post) {
    return <ScreenContainer><EmptyState icon="grid-off" title={locale === "ar" ? "المنشور غير موجود" : "Post not found"} text="" /></ScreenContainer>;
  }

  const share = async () => {
    const result = await Share.share({
      message: `${post.title}\n@${post.username}\ne3lani://post/${post.id}`,
    });
    if (result.action === Share.sharedAction) {
      await event.mutateAsync({ id: post.id, eventType: "share" }).catch(() => undefined);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[s.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Pressable onPress={() => router.back()} style={s.icon}>
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={25} color={BRAND.black} />
        </Pressable>
        <Text style={s.headerTitle}>{locale === "ar" ? "منشور المعلن" : "Advertiser post"}</Text>
        <Pressable onPress={() => void share()} style={s.icon}>
          <MaterialIcons name="ios-share" size={23} color={BRAND.black} />
        </Pressable>
      </View>
      <FlatList
        data={post.media.length ? post.media : [{ id: 0, kind: "image" as const, uri: "" }]}
        horizontal
        pagingEnabled
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={null}
        renderItem={({ item }) => (
          <View style={s.media}>
            {item.uri ? <MediaView media={{ id: String(item.id), kind: item.kind, uri: item.uri }} active /> : (
              <View style={s.textOnly}><MaterialIcons name="notes" size={48} color={BRAND.yellowDark} /></View>
            )}
          </View>
        )}
        ListFooterComponent={
          <View style={s.copy}>
            <Pressable onPress={() => router.push({ pathname: "/advertiser/[username]", params: { username: post.username } } as never)}>
              <Text style={s.advertiser}>{post.displayName} · @{post.username}</Text>
            </Pressable>
            <Text style={[s.title, { textAlign: isRTL ? "right" : "left" }]}>{post.title}</Text>
            <Text style={[s.description, { textAlign: isRTL ? "right" : "left" }]}>{post.description}</Text>
            <Text style={s.meta}>
              {new Date(post.createdAt).toLocaleDateString(locale === "ar" ? "ar" : "en")} · {post.views.toLocaleString()} {locale === "ar" ? "مشاهدة" : "views"} · {post.shares.toLocaleString()} {locale === "ar" ? "مشاركة" : "shares"}
            </Text>
            {post.isOwner ? (
              <View style={s.actions}>
                <OutlineButton label={locale === "ar" ? "تحويل إلى إعلان" : "Convert to ad"} icon="campaign" onPress={() => router.push({ pathname: "/create-ad", params: { sourcePostId: post.id } } as never)} />
                <OutlineButton label={locale === "ar" ? "حذف المنشور" : "Delete post"} icon="delete" onPress={() => void remove.mutateAsync({ id: post.id }).then(() => router.back())} />
              </View>
            ) : (
              <OutlineButton
                label={locale === "ar" ? "إبلاغ" : "Report"}
                icon="flag"
                onPress={() =>
                  Alert.alert(
                    locale === "ar" ? "سبب البلاغ" : "Report reason",
                    undefined,
                    [
                      {
                        text: locale === "ar" ? "سبام" : "Spam",
                        onPress: () => void report.mutateAsync({ id: post.id, reason: "spam", idempotencyKey: reportKey.current }),
                      },
                      {
                        text: locale === "ar" ? "محتوى محظور" : "Prohibited",
                        onPress: () => void report.mutateAsync({ id: post.id, reason: "prohibited", idempotencyKey: reportKey.current }),
                      },
                      { text: locale === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
                    ],
                  )
                }
              />
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 58, paddingHorizontal: 10, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BRAND.black, fontSize: 17, fontWeight: "900" },
  media: { width: 370, maxWidth: "100%", height: 500, backgroundColor: BRAND.charcoal },
  textOnly: { flex: 1, backgroundColor: BRAND.surface, alignItems: "center", justifyContent: "center" },
  copy: { width: 370, maxWidth: "100%", padding: 18 },
  advertiser: { color: BRAND.yellowDark, fontSize: 14, fontWeight: "900" },
  title: { marginTop: 16, color: BRAND.black, fontSize: 25, lineHeight: 34, fontWeight: "900" },
  description: { marginTop: 9, color: BRAND.black, fontSize: 15, lineHeight: 25 },
  meta: { marginTop: 15, color: BRAND.muted, fontSize: 12, lineHeight: 18, textAlign: "right" },
  actions: { marginTop: 18, gap: 9 },
});

