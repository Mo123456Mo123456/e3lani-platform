import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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

import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export default function Profile() {
  const store = useE3lani();
  const { t, toggleLocale } = useI18n();
  const [tab, setTab] = useState<"ads" | "posts">("ads");
  const [editOpen, setEditOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState("");

  const user = store.user;
  const myAds = useMemo(
    () => store.ads.filter((ad) => ad.ownerId === (user?.id ?? "U1") && !ad.id.startsWith("AD100")),
    [store.ads, user?.id],
  );
  const myPosts = store.posts.filter((post) => post.ownerId === (user?.id ?? "U1"));
  const views = myAds.reduce((total, ad) => total + (store.metrics[ad.id]?.views ?? 0), 0);
  const staff = Boolean(user && ["reviewer", "finance", "support", "admin", "owner"].includes(user.role));

  const openEdit = () => {
    store.ensureLocalUser();
    setName(store.user?.name ?? "حسابي");
    setBio(store.user?.bio ?? "");
    setCity(store.user?.cityId ?? "riyadh");
    setEditOpen(true);
  };

  const saveProfile = () => {
    store.ensureLocalUser({
      name: name.trim() || "حسابي",
      bio: bio.trim() || "صفحة عامة على إعلاني",
      cityId: city.trim() || "riyadh",
    });
    setEditOpen(false);
  };

  const changeAvatar = async () => {
    store.ensureLocalUser();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    store.updateProfile({ avatarUri: result.assets[0].uri });
  };

  const createPost = () => {
    if (!postTitle.trim()) return;
    store.ensureLocalUser();
    store.createPost({
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

  const pickPostMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82 });
    if (!result.canceled && result.assets[0]) setPostMedia(result.assets[0].uri);
  };

  return (
    <ScreenContainer edges={["left", "right"]} className="px-0" containerClassName="bg-[#F7F7F7]">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.cover} />
        <View style={styles.main}>
          <Pressable onPress={changeAvatar} style={styles.avatar}>
            {user?.avatarUri ? (
              <Image source={{ uri: user.avatarUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{(user?.name ?? "م").slice(0, 1)}</Text>
            )}
          </Pressable>
          <Text style={styles.name}>{user?.name ?? t("welcome")}</Text>
          <Text style={styles.bio}>
            {user?.bio ?? t("profileHelp")}
            {user ? ` · ${user.cityId} · ${user.accountType}` : ""}
          </Text>
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={openEdit}>
              <Text style={styles.buttonText}>{t("editProfile")}</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() =>
                Share.share({
                  title: user?.name ?? "إعلاني",
                  message: `صفحة ${user?.name ?? "إعلاني"} على إعلاني`,
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
            <Text style={styles.statLabel}>{t("myAds")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{myPosts.length}</Text>
            <Text style={styles.statLabel}>{t("posts")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{views}</Text>
            <Text style={styles.statLabel}>{t("views")}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab("ads")} style={[styles.tab, tab === "ads" && styles.tabActive]}>
            <Text style={[styles.tabText, tab === "ads" && styles.tabTextActive]}>{t("myAds")}</Text>
          </Pressable>
          <Pressable onPress={() => setTab("posts")} style={[styles.tab, tab === "posts" && styles.tabActive]}>
            <Text style={[styles.tabText, tab === "posts" && styles.tabTextActive]}>{t("posts")}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {tab === "ads" ? (
            myAds.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{t("emptyMyAds")}</Text>
                <Text style={styles.emptyText}>{t("emptyMyAdsHelp")}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {myAds.map((ad) => (
                  <Pressable
                    key={ad.id}
                    style={styles.mediaItem}
                    onPress={() => router.push({ pathname: "/(tabs)", params: { focus: ad.id } } as never)}
                  >
                    {ad.media[0]?.kind === "image" ? (
                      <Image source={{ uri: ad.media[0].uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#333" }]} />
                    )}
                    <Text numberOfLines={1} style={styles.mediaTitle}>
                      {ad.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <>
              <Pressable style={styles.primary} onPress={() => setPostOpen(true)}>
                <Text style={styles.primaryText}>{t("addFreePost")}</Text>
              </Pressable>
              {myPosts.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>{t("emptyPosts")}</Text>
                  <Text style={styles.emptyText}>{t("emptyPostsHelp")}</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {myPosts.map((post) => (
                    <View key={post.id} style={styles.mediaItem}>
                      {post.mediaUri ? (
                        <Image source={{ uri: post.mediaUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#333" }]} />
                      )}
                      <Text numberOfLines={1} style={styles.mediaTitle}>
                        {post.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.menu}>
          <Pressable style={styles.row} onPress={() => router.push("/account/my-ads" as never)}>
            <MaterialIcons name="campaign" size={22} color={BRAND.black} />
            <Text style={styles.rowText}>{t("myAds")}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push("/account/notifications" as never)}>
            <MaterialIcons name="notifications" size={22} color={BRAND.black} />
            <Text style={styles.rowText}>{t("notifications")}</Text>
          </Pressable>
          {staff ? (
            <Pressable style={[styles.row, styles.adminRow]} onPress={() => router.push("/admin" as never)}>
              <MaterialIcons name="admin-panel-settings" size={22} color={BRAND.black} />
              <Text style={styles.rowText}>{t("admin")}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.row} onPress={toggleLocale}>
            <MaterialIcons name="language" size={22} color={BRAND.black} />
            <Text style={styles.rowText}>{t("language")}</Text>
          </Pressable>
          {user ? (
            <Pressable style={styles.row} onPress={store.logout}>
              <MaterialIcons name="logout" size={22} color={BRAND.error} />
              <Text style={[styles.rowText, { color: BRAND.error }]}>{t("logout")}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.row} onPress={() => router.push("/login" as never)}>
              <MaterialIcons name="login" size={22} color={BRAND.black} />
              <Text style={styles.rowText}>{t("signIn")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("editProfile")}</Text>
            <Text style={styles.label}>{t("name")}</Text>
            <TextInput value={name} onChangeText={setName} style={styles.field} />
            <Text style={styles.label}>{t("bio")}</Text>
            <TextInput value={bio} onChangeText={setBio} style={[styles.field, styles.textarea]} multiline />
            <Text style={styles.label}>{t("city")}</Text>
            <TextInput value={city} onChangeText={setCity} style={styles.field} />
            <Pressable style={styles.primary} onPress={saveProfile}>
              <Text style={styles.primaryText}>{t("saveChanges")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={postOpen} transparent animationType="slide" onRequestClose={() => setPostOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPostOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("addFreePost")}</Text>
            <Text style={styles.notice}>{t("postNotice")}</Text>
            <Pressable style={styles.secondary} onPress={pickPostMedia}>
              <Text style={styles.secondaryText}>{postMedia ? t("changeImage") : t("postImage")}</Text>
            </Pressable>
            <Text style={styles.label}>{t("adTitle")}</Text>
            <TextInput value={postTitle} onChangeText={setPostTitle} style={styles.field} />
            <Text style={styles.label}>{t("description")}</Text>
            <TextInput value={postText} onChangeText={setPostText} style={[styles.field, styles.textarea]} multiline />
            <Pressable style={styles.primary} onPress={createPost}>
              <Text style={styles.primaryText}>{t("publishOnProfile")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cover: { height: 150, backgroundColor: BRAND.black },
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
  name: { marginTop: 10, fontSize: 22, fontWeight: "900", textAlign: "right" },
  bio: { marginTop: 4, color: BRAND.muted, fontSize: 12, lineHeight: 20, textAlign: "right" },
  buttons: { flexDirection: "row", gap: 8, marginTop: 13, justifyContent: "flex-end" },
  button: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 11,
    backgroundColor: BRAND.white,
  },
  buttonText: { fontSize: 11, fontWeight: "900" },
  stats: { padding: 14, flexDirection: "row", gap: 9 },
  stat: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 15,
    backgroundColor: BRAND.white,
    alignItems: "center",
  },
  statValue: { fontSize: 17, fontWeight: "900" },
  statLabel: { color: BRAND.muted, fontSize: 10, marginTop: 4 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND.border, backgroundColor: BRAND.white },
  tab: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
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
  empty: {
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 18,
    backgroundColor: BRAND.white,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "900", fontSize: 15 },
  emptyText: { marginTop: 8, color: BRAND.muted, textAlign: "center" },
  menu: { paddingHorizontal: 14, gap: 8 },
  row: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: BRAND.white,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  adminRow: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  rowText: { flex: 1, textAlign: "right", fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BRAND.white,
  },
  handle: { width: 52, height: 5, borderRadius: 5, backgroundColor: "#ddd", alignSelf: "center", marginBottom: 15 },
  sheetTitle: { marginBottom: 12, fontSize: 20, fontWeight: "900", textAlign: "right" },
  label: { marginTop: 10, marginBottom: 7, fontSize: 12, fontWeight: "900", textAlign: "right" },
  field: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    backgroundColor: "#fbfbfb",
    textAlign: "right",
  },
  textarea: { height: 90, paddingTop: 12, textAlignVertical: "top" },
  notice: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7d2",
    borderWidth: 1,
    borderColor: "#f0d45e",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  primary: {
    marginTop: 15,
    height: 51,
    borderRadius: 14,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryText: { fontWeight: "900" },
  secondary: {
    height: 49,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900" },
});
