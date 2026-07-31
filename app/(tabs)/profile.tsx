import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Profile() {
  const {
    user,
    login,
    logout,
    updateProfile,
    ads,
    posts,
    createPost,
    metrics,
  } = useE3lani();
  const { locale, isRTL, t, toggleLocale } = useI18n();
  const [tab, setTab] = useState<"ads" | "posts">("ads");
  const [editOpen, setEditOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [city, setCity] = useState(user?.cityId ?? "riyadh");
  const [postTitle, setPostTitle] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState("");

  const myAds = ads.filter((ad) => ad.ownerId === (user?.id ?? "guest") || ad.ownerName === user?.name);
  const views = myAds.reduce((total, ad) => total + (metrics[ad.id]?.views ?? 0), 0);
  const displayName = user?.name ?? (locale === "ar" ? "حسابي" : "My account");
  const displayBio =
    user?.bio ??
    (locale === "ar"
      ? "صفحتك العامة للإعلانات والمنشورات المجانية."
      : "Your public page for free ads and posts.");

  const ensureUser = () => {
    if (!user) login({ name: displayName, bio: displayBio, cityId: "riyadh", accountType: "advertiser", role: "user" });
  };

  const openEdit = () => {
    ensureUser();
    setName(user?.name ?? displayName);
    setBio(user?.bio ?? displayBio);
    setCity(user?.cityId ?? "riyadh");
    setEditOpen(true);
  };

  const saveProfile = () => {
    ensureUser();
    updateProfile({
      name: name.trim() || displayName,
      bio: bio.trim() || displayBio,
      cityId: city.trim() || "riyadh",
    });
    setEditOpen(false);
  };

  const pickAvatar = async () => {
    ensureUser();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    updateProfile({ avatar: result.assets[0].uri });
  };

  const pickPostMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (result.canceled || !result.assets[0]) return;
    setPostMedia(result.assets[0].uri);
  };

  const submitPost = () => {
    if (!postTitle.trim()) {
      Alert.alert(locale === "ar" ? "أدخل عنوان المنشور" : "Enter a post title");
      return;
    }
    ensureUser();
    createPost({ title: postTitle.trim(), text: postText.trim(), media: postMedia || undefined });
    setPostTitle("");
    setPostText("");
    setPostMedia("");
    setPostOpen(false);
    setTab("posts");
  };

  const shareProfile = async () => {
    await Share.share({
      message: locale === "ar" ? `صفحة ${displayName} على إعلاني` : `${displayName} on E3lani`,
    });
  };

  const align = { textAlign: isRTL ? ("right" as const) : ("left" as const) };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.cover} />
        <View style={styles.main}>
          <Pressable onPress={pickAvatar} style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{displayName.slice(0, 1)}</Text>
            )}
          </Pressable>
          <Text style={[styles.name, align]}>{displayName}</Text>
          <Text style={[styles.bio, align]}>
            {displayBio}
            {user?.cityId ? ` · ${user.cityId}` : ""}
          </Text>
          <View style={[styles.buttons, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable onPress={openEdit} style={styles.button}>
              <Text style={styles.buttonText}>
                {locale === "ar" ? "تعديل الحساب" : "Edit profile"}
              </Text>
            </Pressable>
            <Pressable onPress={shareProfile} style={styles.button}>
              <Text style={styles.buttonText}>{t("share")}</Text>
            </Pressable>
            <Pressable onPress={toggleLocale} style={styles.button}>
              <Text style={styles.buttonText}>{t("language")}</Text>
            </Pressable>
            {user ? (
              <Pressable onPress={logout} style={styles.button}>
                <Text style={[styles.buttonText, { color: BRAND.error }]}>{t("logout")}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push("/login" as never)} style={styles.button}>
                <Text style={styles.buttonText}>{t("signIn")}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{myAds.length}</Text>
            <Text style={styles.statLabel}>{t("myAdsShort")}</Text>
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
            <Text style={[styles.tabText, tab === "ads" && styles.tabTextActive]}>
              {t("myAdsShort")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("posts")}
            style={[styles.tab, tab === "posts" && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === "posts" && styles.tabTextActive]}>
              {t("posts")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {tab === "ads" ? (
            myAds.length ? (
              <View style={styles.grid}>
                {myAds.map((ad) => (
                  <Pressable
                    key={ad.id}
                    onPress={() =>
                      router.push({ pathname: "/(tabs)", params: { focus: ad.id } } as never)
                    }
                    style={styles.mediaItem}
                  >
                    {ad.media[0]?.kind === "image" ? (
                      <Image
                        source={{ uri: ad.media[0].uri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.fallback]} />
                    )}
                    <Text numberOfLines={1} style={styles.mediaTitle}>
                      {ad.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {locale === "ar" ? "لا توجد إعلانات لك" : "No ads yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {locale === "ar" ? "استخدم زر «أضف إعلانًا» للنشر." : "Use Post Ad to publish."}
                </Text>
              </View>
            )
          ) : (
            <>
              <Pressable onPress={() => setPostOpen(true)} style={styles.primary}>
                <Text style={styles.primaryText}>{t("addFreePost")}</Text>
              </Pressable>
              {posts.length ? (
                <View style={styles.grid}>
                  {posts.map((post) => (
                    <View key={post.id} style={styles.mediaItem}>
                      {post.media ? (
                        <Image
                          source={{ uri: post.media }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
                      )}
                      <Text numberOfLines={1} style={styles.mediaTitle}>
                        {post.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>
                    {locale === "ar" ? "لا توجد منشورات" : "No posts yet"}
                  </Text>
                  <Text style={styles.emptyText}>{t("profileOnlyPost")}</Text>
                </View>
              )}
            </>
          )}

          {user && ["reviewer", "finance", "support", "admin", "owner"].includes(user.role) ? (
            <Pressable onPress={() => router.push("/admin" as never)} style={styles.admin}>
              <MaterialIcons name="admin-panel-settings" size={22} color={BRAND.black} />
              <Text style={styles.adminText}>{t("admin")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {locale === "ar" ? "تعديل الحساب" : "Edit profile"}
            </Text>
            <Text style={[styles.label, align]}>{t("name")}</Text>
            <TextInput value={name} onChangeText={setName} style={[styles.field, align]} />
            <Text style={[styles.label, align]}>
              {locale === "ar" ? "النبذة" : "Bio"}
            </Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              style={[styles.field, styles.textarea, align]}
            />
            <Text style={[styles.label, align]}>{t("city")}</Text>
            <TextInput value={city} onChangeText={setCity} style={[styles.field, align]} />
            <Pressable onPress={saveProfile} style={styles.primary}>
              <Text style={styles.primaryText}>{t("saveChanges")}</Text>
            </Pressable>
            <Pressable onPress={() => setEditOpen(false)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t("close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={postOpen} transparent animationType="slide" onRequestClose={() => setPostOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {locale === "ar" ? "منشور مجاني" : "Free post"}
            </Text>
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{t("profileOnlyPost")}</Text>
            </View>
            <Pressable onPress={pickPostMedia} style={styles.secondary}>
              <Text style={styles.secondaryText}>
                {postMedia
                  ? locale === "ar"
                    ? "تم اختيار صورة"
                    : "Image selected"
                  : locale === "ar"
                    ? "صورة المنشور"
                    : "Post image"}
              </Text>
            </Pressable>
            <Text style={[styles.label, align]}>{t("adTitle")}</Text>
            <TextInput
              value={postTitle}
              onChangeText={setPostTitle}
              maxLength={80}
              style={[styles.field, align]}
            />
            <Text style={[styles.label, align]}>{t("description")}</Text>
            <TextInput
              value={postText}
              onChangeText={setPostText}
              maxLength={280}
              multiline
              style={[styles.field, styles.textarea, align]}
            />
            <Pressable onPress={submitPost} style={styles.primary}>
              <Text style={styles.primaryText}>
                {locale === "ar" ? "نشر داخل صفحتي" : "Publish to my page"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setPostOpen(false)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t("close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 28 },
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
  avatarText: { fontSize: 30, fontWeight: "900", color: BRAND.black },
  name: { marginTop: 10, fontSize: 22, fontWeight: "900", color: BRAND.black },
  bio: { marginTop: 4, color: BRAND.muted, fontSize: 12, lineHeight: 20 },
  buttons: { flexWrap: "wrap", gap: 8, marginTop: 13 },
  button: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 11,
    backgroundColor: BRAND.white,
  },
  buttonText: { fontSize: 11, fontWeight: "900", color: BRAND.black },
  stats: {
    padding: 14,
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
  statValue: { fontSize: 17, fontWeight: "900", color: BRAND.black },
  statLabel: { marginTop: 2, color: BRAND.muted, fontSize: 10 },
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
  fallback: { backgroundColor: "#333" },
  empty: {
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 18,
    backgroundColor: BRAND.white,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "900", color: BRAND.black, fontSize: 16 },
  emptyText: { marginTop: 6, color: BRAND.muted, textAlign: "center" },
  primary: {
    height: 51,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: BRAND.black, fontWeight: "900" },
  admin: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adminText: { fontWeight: "900", color: BRAND.black },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BRAND.white,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 15,
  },
  sheetTitle: { marginBottom: 12, fontSize: 20, fontWeight: "900", color: BRAND.black },
  label: { marginTop: 10, marginBottom: 7, fontSize: 12, fontWeight: "900" },
  field: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    backgroundColor: "#fbfbfb",
    color: BRAND.black,
  },
  textarea: { height: 94, paddingTop: 12, textAlignVertical: "top" },
  secondary: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: BRAND.black },
  notice: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7d2",
    borderWidth: 1,
    borderColor: "#f0d45e",
  },
  noticeText: { fontSize: 12, lineHeight: 18, color: BRAND.black },
});
