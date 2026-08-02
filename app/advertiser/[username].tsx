import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { MediaView } from "@/components/e3lani/ad-card";
import { EmptyState, OutlineButton, PrimaryButton } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { mapFeedAd } from "@/lib/map-feed-ad";
import { trpc } from "@/lib/trpc";
import { useE3lani } from "@/lib/e3lani-store";

type Tab = "posts" | "ads";

export default function AdvertiserPage() {
  const { username = "" } = useLocalSearchParams<{ username: string }>();
  const { launchPolicy } = useE3lani();
  const { width } = useWindowDimensions();
  const { locale, isRTL } = useI18n();
  const [tab, setTab] = useState<Tab>("posts");
  const profileQuery = trpc.advertisers.get.useQuery({ username }, { enabled: Boolean(username) });
  const postsQuery = trpc.profilePosts.list.useQuery({ username }, { enabled: Boolean(username) });
  const adsQuery = trpc.ads.byAdvertiser.useQuery({ username }, { enabled: Boolean(username) });
  const follow = trpc.advertisers.toggleFollow.useMutation();
  const postEvent = trpc.profilePosts.recordEvent.useMutation();
  const profile = profileQuery.data;
  const tileWidth = Math.floor((Math.min(width, 780) - 36) / 3);
  const posts = postsQuery.data ?? [];
  const ads = (adsQuery.data ?? []).map(mapFeedAd);

  if (profileQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={s.center}><ActivityIndicator size="large" color={BRAND.yellowDark} /></View>
      </ScreenContainer>
    );
  }
  if (!profile) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="person-off"
          title={locale === "ar" ? "صفحة المعلن غير موجودة" : "Advertiser not found"}
          text={locale === "ar" ? "قد تكون الصفحة موقوفة أو تغير اسم المستخدم." : "The page may be unavailable or renamed."}
        />
      </ScreenContainer>
    );
  }

  const shareProfile = () =>
    Share.share({
      message: `${profile.displayName}\n@${profile.username}\ne3lani://advertiser/${profile.username}`,
    });

  const socialEntries = Object.entries(profile.socialLinks).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  );
  type PostGridItem = (typeof posts)[number];
  type AdGridItem = (typeof ads)[number];
  const data: (
    | { kind: "post"; item: PostGridItem }
    | { kind: "ad"; item: AdGridItem }
  )[] =
    tab === "posts"
      ? posts.map((item) => ({ kind: "post" as const, item }))
      : ads.map((item) => ({ kind: "ad" as const, item }));

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <FlatList
        data={data}
        numColumns={3}
        key={tab}
        keyExtractor={(entry) => entry.item.id}
        contentContainerStyle={s.page}
        columnWrapperStyle={s.gridRow}
        ListHeaderComponent={
          <View>
            {profile.coverUrl ? <Image source={{ uri: profile.coverUrl }} style={s.cover} /> : <View style={s.coverFallback} />}
            <View style={s.headerActions}>
              <Pressable onPress={() => router.back()} style={s.iconButton}>
                <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={BRAND.black} />
              </Pressable>
              <Pressable onPress={() => void shareProfile()} style={s.iconButton}>
                <MaterialIcons name="ios-share" size={23} color={BRAND.black} />
              </Pressable>
            </View>
            <View style={s.profile}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallback}><Text style={s.avatarText}>{profile.displayName.slice(0, 1)}</Text></View>
              )}
              <View style={s.nameRow}>
                <Text style={s.name}>{profile.displayName}</Text>
                {launchPolicy.brandVerificationEnabled && profile.isVerified ? <MaterialIcons name="verified" size={20} color={BRAND.yellowDark} /> : null}
              </View>
              <Text style={s.username}>@{profile.username}</Text>
              {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
              <View style={s.stats}>
                {[
                  [profile.stats.posts, locale === "ar" ? "منشور" : "Posts"],
                  [profile.stats.ads, locale === "ar" ? "إعلان" : "Ads"],
                  [profile.stats.views, locale === "ar" ? "مشاهدة" : "Views"],
                ].map(([value, label]) => (
                  <View key={String(label)} style={s.stat}>
                    <Text style={s.statValue}>{Number(value).toLocaleString()}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={s.actions}>
                {profile.isOwner ? (
                  <>
                    <PrimaryButton label={locale === "ar" ? "منشور جديد" : "New post"} icon="add-box" onPress={() => router.push("/create-post" as never)} />
                    <OutlineButton label={locale === "ar" ? "تعديل الصفحة" : "Edit page"} icon="edit" onPress={() => router.push("/account/brand" as never)} />
                  </>
                ) : (
                  <OutlineButton
                    label={locale === "ar" ? "متابعة" : "Follow"}
                    icon="person-add"
                    onPress={() => void follow.mutateAsync({ username: profile.username }).catch(() => undefined)}
                  />
                )}
              </View>
              {socialEntries.length ? (
                <View style={s.socials}>
                  {socialEntries.map(([name, url]) => (
                    <Pressable key={name} onPress={() => void Linking.openURL(url)} style={s.social}>
                      <Text style={s.socialText}>{name}</Text>
                      <MaterialIcons name="open-in-new" size={15} color={BRAND.black} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={s.tabs}>
                <Pressable onPress={() => setTab("posts")} style={[s.tab, tab === "posts" && s.tabActive]}>
                  <MaterialIcons name="grid-on" size={20} color={BRAND.black} />
                  <Text style={s.tabText}>{locale === "ar" ? "المنشورات" : "Posts"}</Text>
                </Pressable>
                <Pressable onPress={() => setTab("ads")} style={[s.tab, tab === "ads" && s.tabActive]}>
                  <MaterialIcons name="campaign" size={20} color={BRAND.black} />
                  <Text style={s.tabText}>{locale === "ar" ? "الإعلانات" : "Ads"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: entry }) => {
          const item = entry.item;
          const media = item.media[0];
          return (
            <Pressable
              onPress={() => {
                if (entry.kind === "ad") {
                  router.push({ pathname: "/ad/[id]", params: { id: item.id } } as never);
                } else {
                  void postEvent.mutateAsync({ id: item.id, eventType: "view" }).catch(() => undefined);
                  router.push({ pathname: "/post/[id]", params: { id: item.id } } as never);
                }
              }}
              style={[s.tile, { width: tileWidth, height: tileWidth * 1.33 }]}
            >
              {media ? (
                <MediaView media={{ id: String(media.id), kind: media.kind, uri: media.uri }} />
              ) : (
                <View style={s.textTile}><Text numberOfLines={5} style={s.textTileCopy}>{item.title}</Text></View>
              )}
              <View style={s.tileMeta}>
                <MaterialIcons name={tab === "posts" ? "visibility" : "campaign"} size={14} color={BRAND.white} />
                <Text style={s.tileMetaText}>
                  {entry.kind === "post"
                    ? entry.item.views.toLocaleString()
                    : (entry.item.metrics?.views ?? 0).toLocaleString()}
                </Text>
              </View>
              {entry.kind === "post" && entry.item.isOwner ? (
                <Pressable
                  onPress={() => router.push({ pathname: "/create-ad", params: { sourcePostId: item.id } } as never)}
                  style={s.convert}
                >
                  <Text style={s.convertText}>{locale === "ar" ? "تحويل إلى إعلان" : "Convert to ad"}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={tab === "posts" ? "grid-off" : "campaign"}
            title={locale === "ar" ? "لا يوجد محتوى بعد" : "No content yet"}
            text={locale === "ar" ? "سيظهر المحتوى المنشور هنا." : "Published content will appear here."}
          />
        }
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { width: "100%", maxWidth: 780, alignSelf: "center", paddingBottom: 40 },
  gridRow: { paddingHorizontal: 8, gap: 4 },
  cover: { width: "100%", height: 170, backgroundColor: BRAND.charcoal },
  coverFallback: { width: "100%", height: 150, backgroundColor: BRAND.black },
  headerActions: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between" },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  profile: { alignItems: "center", paddingHorizontal: 16, marginTop: -42 },
  avatar: { width: 88, height: 88, borderRadius: 29, borderWidth: 4, borderColor: BRAND.white },
  avatarFallback: { width: 88, height: 88, borderRadius: 29, borderWidth: 4, borderColor: BRAND.white, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 31, fontWeight: "900", color: BRAND.black },
  nameRow: { marginTop: 10, flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  name: { color: BRAND.black, fontSize: 21, fontWeight: "900" },
  username: { marginTop: 2, color: BRAND.muted, fontSize: 14, fontWeight: "700" },
  bio: { marginTop: 9, color: BRAND.black, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 520 },
  stats: { marginTop: 14, flexDirection: "row-reverse", gap: 30 },
  stat: { alignItems: "center" },
  statValue: { color: BRAND.black, fontSize: 17, fontWeight: "900" },
  statLabel: { color: BRAND.muted, fontSize: 11 },
  actions: { width: "100%", marginTop: 14, gap: 8 },
  socials: { marginTop: 12, flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", gap: 7 },
  social: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: BRAND.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  socialText: { color: BRAND.black, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  tabs: { width: "100%", marginTop: 18, flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: BRAND.border },
  tab: { flex: 1, minHeight: 49, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: BRAND.yellowDark },
  tabText: { color: BRAND.black, fontSize: 13, fontWeight: "900" },
  tile: { marginBottom: 4, backgroundColor: BRAND.charcoal, overflow: "hidden" },
  textTile: { flex: 1, padding: 9, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" },
  textTileCopy: { color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "900", textAlign: "center" },
  tileMeta: { position: "absolute", left: 7, bottom: 7, flexDirection: "row", alignItems: "center", gap: 3 },
  tileMetaText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  convert: { position: "absolute", left: 4, right: 4, top: 4, minHeight: 27, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center" },
  convertText: { color: BRAND.white, fontSize: 9, fontWeight: "900" },
});

