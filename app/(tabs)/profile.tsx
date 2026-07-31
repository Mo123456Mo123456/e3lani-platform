import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND, type AccountType } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Profile() {
  const {
    user,
    ads,
    posts,
    metrics,
    login,
    logout,
    updateProfile,
    createPost,
  } = useE3lani();
  const { locale, isRTL, t, toggleLocale } = useI18n();
  const [tab, setTab] = useState<"ads" | "posts">("ads");
  const [editOpen, setEditOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [postTitle, setPostTitle] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState("");

  const myAds = useMemo(
    () => ads.filter((ad) => ad.ownerId === (user?.id ?? "guest") || ad.ownerName === user?.name),
    [ads, user],
  );
  const views = myAds.reduce((total, ad) => total + (metrics[ad.id]?.views ?? 0), 0);
  const displayName = user?.name ?? t("account");
  const displayBio =
    user?.bio ??
    (locale === "ar"
      ? "صفحتك العامة للإعلانات والمنشورات المجانية."
      : "Your public page for free ads and posts.");

  const ensureUser = () => {
    if (!user) login({ name: "حسابي", accountType: "individual", role: "user", cityId: "riyadh" });
  };

  const openEdit = () => {
    ensureUser();
    setName(user?.name ?? "حسابي");
    setBio(user?.bio ?? displayBio);
    setCity(user?.cityId ?? "riyadh");
    setAccountType(user?.accountType ?? "individual");
    setEditOpen(true);
  };

  const saveProfile = () => {
    updateProfile({
      name: name.trim() || "حسابي",
      bio: bio.trim() || displayBio,
      cityId: city.trim() || "riyadh",
      accountType,
    });
    setEditOpen(false);
  };

  const changeAvatar = async () => {
    ensureUser();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
    });
    if (result.canceled || !result.assets[0]) return;
    updateProfile({ avatarUri: result.assets[0].uri });
  };

  const pickPostMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
    });
    if (result.canceled || !result.assets[0]) return;
    setPostMedia(result.assets[0].uri);
  };

  const publishPost = () => {
    if (!postTitle.trim()) return;
    ensureUser();
    createPost({
      title: postTitle.trim(),
      text: postText.trim(),
      mediaUri: postMedia || undefined,
    });
    setPostTitle("");
    setPostText("");
    setPostMedia("");
    setPostOpen(false);
    setTab("posts");
  };

  const staff = Boolean(
    user && ["reviewer", "finance", "support", "admin", "owner"].includes(user.role),
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.cover} />
        <View style={styles.main}>
          <Pressable onPress={changeAvatar} style={styles.avatar}>
            {user?.avatarUri ? (
              <Image source={{ uri: user.avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{(displayName || "م").slice(0, 1)}</Text>
            )}
          </Pressable>
          <Text style={[styles.name, { textAlign: isRTL ? "right" : "left" }]}>{displayName}</Text>
          <Text style={[styles.bio, { textAlign: isRTL ? "right" : "left" }]}>
            {displayBio}
            {user?.cityId ? ` · ${user.cityId}` : ""}
            {user?.accountType ? ` · ${user.accountType}` : ""}
          </Text>
          <View style={[styles.buttons, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
            {!user ? (
              <Pressable style={styles.button} onPress={() => router.push("/login" as never)}>
                <Text style={styles.buttonText}>{t("signIn")}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.button} onPress={openEdit}>
                <Text style={styles.buttonText}>{t("editProfile")}</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.button}
              onPress={() =>
                Share.share({
                  message:
                    locale === "ar"
                      ? `صفحة ${displayName} على إعلاني`
                      : `${displayName} on E3lani`,
                })
              }
            >
              <Text style={styles.buttonText}>{t("shareProfile")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{myAds.length}</Text>
            <Text style={styles.statLabel}>{t("adsTab")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{posts.length}</Text>
            <Text style={styles.statLabel}>{t("posts")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{views}</Text>
            <Text style={styles.statLabel}>{t("views")}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setTab("ads")}
            style={[styles.tab, tab === "ads" && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === "ads" && styles.tabTextActive]}>{t("adsTab")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("posts")}
            style={[styles.tab, tab === "posts" && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === "posts" && styles.tabTextActive]}>{t("posts")}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {tab === "ads" ? (
            myAds.length ? (
              <View style={styles.grid}>
                {myAds.map((ad) => (
                  <Pressable
                    key={ad.id}
                    style={styles.mediaItem}
                    onPress={() =>
                      router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)
                    }
                  >
                    {ad.media[0]?.kind === "image" && !ad.media[0].localAsset ? (
                      <Image
                        source={{ uri: ad.media[0].uri }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, styles.mediaFallback]} />
                    )}
                    <Text numberOfLines={1} style={styles.mediaTitle}>
                      {ad.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{t("emptyMyAds")}</Text>
                <Text style={styles.emptyHelp}>{t("emptyMyAdsHelp")}</Text>
              </View>
            )
          ) : (
            <>
              <PrimaryButton
                label={t("addFreePost")}
                icon="add"
                onPress={() => {
                  ensureUser();
                  setPostOpen(true);
                }}
              />
              {posts.length ? (
                <View style={[styles.grid, { marginTop: 12 }]}>
                  {posts.map((post) => (
                    <View key={post.id} style={styles.mediaItem}>
                      {post.mediaUri ? (
                        <Image
                          source={{ uri: post.mediaUri }}
                          style={StyleSheet.absoluteFillObject}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, styles.mediaFallback]} />
                      )}
                      <Text numberOfLines={1} style={styles.mediaTitle}>
                        {post.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.empty, { marginTop: 12 }]}>
                  <Text style={styles.emptyTitle}>{t("emptyPosts")}</Text>
                  <Text style={styles.emptyHelp}>{t("emptyPostsHelp")}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.menu}>
          <ScreenTitle title={t("account")} />
          <Pressable style={styles.row} onPress={() => router.push("/account/my-ads" as never)}>
            <Text style={styles.rowText}>{t("myAds")}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push("/account/notifications" as never)}>
            <Text style={styles.rowText}>{t("notifications")}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={toggleLocale}>
            <Text style={styles.rowText}>{t("language")}</Text>
          </Pressable>
          {staff ? (
            <Pressable style={styles.row} onPress={() => router.push("/admin" as never)}>
              <Text style={styles.rowText}>{t("admin")}</Text>
            </Pressable>
          ) : null}
          {user ? (
            <Pressable style={styles.row} onPress={logout}>
              <Text style={[styles.rowText, { color: BRAND.error }]}>{t("logout")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("editProfile")}</Text>
            <Text style={styles.label}>{t("name")}</Text>
            <TextInput value={name} onChangeText={setName} style={styles.field} />
            <Text style={styles.label}>{t("bio")}</Text>
            <TextInput value={bio} onChangeText={setBio} multiline style={[styles.field, styles.textarea]} />
            <Text style={styles.label}>{t("city")}</Text>
            <TextInput value={city} onChangeText={setCity} style={styles.field} />
            <Text style={styles.label}>{t("accountType")}</Text>
            <View style={styles.chips}>
              {(
                [
                  ["individual", t("individual")],
                  ["store", t("storeType")],
                  ["brand", t("brandType")],
                  ["company", t("company")],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => setAccountType(id)}
                  style={[styles.chip, accountType === id && styles.chipActive]}
                >
                  <Text style={styles.chipText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label={t("saveChanges")} onPress={saveProfile} />
            <Pressable style={styles.close} onPress={() => setEditOpen(false)}>
              <Text style={styles.closeText}>{t("close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={postOpen} transparent animationType="slide" onRequestClose={() => setPostOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("addFreePost")}</Text>
            <Pressable onPress={pickPostMedia} style={styles.upload}>
              {postMedia ? (
                <Image source={{ uri: postMedia }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              ) : (
                <Text style={styles.uploadText}>{t("addMedia")}</Text>
              )}
            </Pressable>
            <Text style={styles.label}>{t("adTitle")}</Text>
            <TextInput value={postTitle} onChangeText={setPostTitle} style={styles.field} />
            <Text style={styles.label}>{t("description")}</Text>
            <TextInput
              value={postText}
              onChangeText={setPostText}
              multiline
              style={[styles.field, styles.textarea]}
            />
            <PrimaryButton label={t("publishNow")} onPress={publishPost} />
            <Pressable style={styles.close} onPress={() => setPostOpen(false)}>
              <Text style={styles.closeText}>{t("close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 40 },
  cover: {
    height: 150,
    backgroundColor: BRAND.black,
  },
  main: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  avatar: {
    width: 86,
    height: 86,
    marginTop: -43,
    borderRadius: 43,
    borderWidth: 4,
    borderColor: BRAND.white,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: BRAND.black, fontSize: 30, fontWeight: "900" },
  name: { marginTop: 10, color: BRAND.black, fontSize: 22, fontWeight: "900" },
  bio: { marginTop: 4, color: BRAND.muted, fontSize: 12, lineHeight: 19 },
  buttons: { gap: 8, marginTop: 13 },
  button: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 11,
    backgroundColor: BRAND.white,
  },
  buttonText: { color: BRAND.black, fontSize: 11, fontWeight: "900" },
  stats: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 9,
  },
  stat: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 15,
    backgroundColor: BRAND.white,
    alignItems: "center",
  },
  statValue: { color: BRAND.black, fontSize: 17, fontWeight: "900" },
  statLabel: { color: BRAND.muted, fontSize: 10 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: BRAND.yellow },
  tabText: { color: BRAND.muted, fontWeight: "900" },
  tabTextActive: { color: BRAND.black },
  content: { padding: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  mediaItem: {
    width: "48%",
    aspectRatio: 1 / 1.12,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#ddd",
  },
  mediaFallback: { backgroundColor: BRAND.charcoal },
  mediaTitle: {
    position: "absolute",
    right: 7,
    bottom: 7,
    left: 7,
    color: BRAND.white,
    fontSize: 10,
    fontWeight: "900",
    textShadowColor: "#000",
    textShadowRadius: 8,
  },
  empty: {
    padding: 30,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 18,
    backgroundColor: BRAND.white,
    alignItems: "center",
  },
  emptyTitle: { color: BRAND.black, fontSize: 16, fontWeight: "900" },
  emptyHelp: { marginTop: 6, color: BRAND.muted, fontSize: 12, textAlign: "center" },
  menu: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  row: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: BRAND.white,
  },
  rowText: { color: BRAND.black, fontSize: 14, fontWeight: "800" },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.55)",
  },
  sheet: {
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BRAND.white,
    gap: 6,
  },
  sheetTitle: { marginBottom: 10, fontSize: 20, fontWeight: "900", color: BRAND.black },
  label: { marginTop: 8, color: BRAND.black, fontSize: 12, fontWeight: "900" },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fbfbfb",
    color: BRAND.black,
  },
  textarea: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  chipActive: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  chipText: { fontWeight: "800", color: BRAND.black },
  close: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontWeight: "900", color: BRAND.black },
  upload: {
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: BRAND.surface,
  },
  uploadText: { color: BRAND.muted, fontWeight: "800" },
});
