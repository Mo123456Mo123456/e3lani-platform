import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import { BRAND, FALLBACK_CATEGORIES, allMarketCities, type Ad, type AdMedia } from "@/lib/e3lani-data";
import { buildContactUrl } from "@/lib/e3lani-feed";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const localAssets = {
  poster: require("@/assets/images/e3lani-poster.png"),
  wordmark: require("@/assets/images/brand-wordmark.png"),
  icon: require("@/assets/images/icon.png"),
};

function VideoMedia({ uri, active, muted }: { uri: string; active: boolean; muted: boolean }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => {
    instance.loop = true;
    instance.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      accessible={false}
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
    />
  );
}

export function MediaView({
  media,
  active = false,
  muted = true,
  accessibilityLabel,
}: {
  media?: AdMedia;
  active?: boolean;
  muted?: boolean;
  accessibilityLabel?: string;
}) {
  if (!media) {
    return (
      <View accessible={false} style={[StyleSheet.absoluteFill, styles.fallback]}>
        <MaterialIcons accessible={false} name="campaign" size={48} color={BRAND.yellow} />
      </View>
    );
  }
  if (media.kind === "video" && !media.uri.startsWith("asset:")) {
    return <VideoMedia uri={media.uri} active={active} muted={muted} />;
  }
  const source = media.localAsset ? localAssets[media.localAsset] : { uri: media.uri };
  return (
    <Image
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      source={source}
      style={StyleSheet.absoluteFill}
      contentFit={media.localAsset === "wordmark" ? "contain" : "cover"}
      transition={180}
    />
  );
}

function ctaLabel(type: string | undefined, t: (key: string) => string) {
  switch (type) {
    case "whatsapp":
      return t("ctaWhatsapp");
    case "phone":
      return t("ctaPhone");
    case "store":
      return t("ctaStore");
    case "product":
      return t("ctaProduct");
    case "external":
      return t("ctaExternal");
    default:
      return t("contact");
  }
}

export function AdCard({
  ad,
  height = 540,
  active = false,
  fullscreen = false,
}: {
  ad: Ad;
  height?: number;
  active?: boolean;
  fullscreen?: boolean;
}) {
  const { locale, isRTL, t } = useI18n();
  const { brand, savedIds, toggleSave, recordMetric, submitReport, user } = useE3lani();
  const productData = useProductData();
  const [muted, setMuted] = useState(true);

  const cities = useMemo(() => {
    const catalog = productData.cities.length ? productData.cities : allMarketCities();
    return catalog;
  }, [productData.cities]);
  const categories = productData.categories.length ? productData.categories : FALLBACK_CATEGORIES;

  const city = cities.find((item) => item.id === ad.cityId);
  const category = categories.find((item) => item.id === ad.categoryId);
  const saved = savedIds.includes(ad.id);
  const owner =
    ad.ownerName ||
    (ad.ownerId === user?.id ? user.name : undefined) ||
    brand?.name ||
    "إعلاني";
  const media = ad.media[0];
  const contact = ad.contacts[0];

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleSave(ad.id);
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title} — ${owner}` });
  };

  const report = (event: GestureResponderEvent) => {
    event.stopPropagation();
    Alert.alert(t("report"), undefined, [
      { text: t("close"), style: "cancel" },
      {
        text: t("report"),
        style: "destructive",
        onPress: () => {
          submitReport(ad.id, locale === "ar" ? "محتوى مضلل" : "Misleading content");
          Alert.alert(t("success"), t("reportSent"));
        },
      },
    ]);
  };

  const openContact = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!contact?.value) {
      Alert.alert(t("contact"), t("previewContact"));
      return;
    }
    const url = buildContactUrl(contact.type, contact.value);
    if (!url) return;
    recordMetric(ad.id, "contacts");
    await Linking.openURL(url);
  };

  return (
    <View
      accessible
      accessibilityLabel={ad.title}
      style={[
        styles.card,
        { height },
        fullscreen && styles.fullscreen,
      ]}
    >
      <MediaView media={media} active={active} muted={muted} accessibilityLabel={ad.title} />
      <View accessible={false} style={styles.scrim} />

      <View style={[styles.badges, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
        {ad.sponsored ? (
          <View style={styles.badgePaid}>
            <Text style={styles.badgePaidText}>{t("sponsored")}</Text>
          </View>
        ) : null}
        {ad.featured ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("featured")}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.mediaLabel, isRTL ? { left: 14 } : { right: 14 }]}>
        <Text style={styles.badgeText}>
          {media?.kind === "video" ? t("mediaVideo") : t("mediaImage")}
        </Text>
      </View>

      <View style={[styles.actions, isRTL ? { left: 10 } : { right: 10 }]}>
        {media?.kind === "video" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? t("sound") : t("soundOn")}
            onPress={(event) => {
              event.stopPropagation();
              setMuted((value) => !value);
            }}
            style={styles.action}
          >
            <View style={styles.actionIcon}>
              <MaterialIcons
                name={muted ? "volume-off" : "volume-up"}
                size={22}
                color={BRAND.white}
              />
            </View>
            <Text style={styles.actionText}>{muted ? t("sound") : t("soundOn")}</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? t("savedDone") : t("save")}
          onPress={save}
          style={styles.action}
        >
          <View style={[styles.actionIcon, saved && styles.actionIconSaved]}>
            <MaterialIcons
              name={saved ? "favorite" : "favorite-border"}
              size={22}
              color={saved ? BRAND.black : BRAND.white}
            />
          </View>
          <Text style={styles.actionText}>{t("save")}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel={t("share")} onPress={share} style={styles.action}>
          <View style={styles.actionIcon}>
            <MaterialIcons name="share" size={22} color={BRAND.white} />
          </View>
          <Text style={styles.actionText}>{t("share")}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel={t("report")} onPress={report} style={styles.action}>
          <View style={styles.actionIcon}>
            <MaterialIcons name="priority-high" size={22} color={BRAND.white} />
          </View>
          <Text style={styles.actionText}>{t("report")}</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.copy,
          isRTL
            ? { right: 16, left: 82, alignItems: "flex-end" }
            : { left: 16, right: 82, alignItems: "flex-start" },
        ]}
      >
        <Pressable
          onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
          style={[styles.owner, { flexDirection: isRTL ? "row" : "row-reverse" }]}
        >
          <View style={styles.avatar}>
            {ad.ownerAvatar ? (
              <Image source={{ uri: ad.ownerAvatar }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{owner.slice(0, 1)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandName, { textAlign: isRTL ? "right" : "left" }]}>
              {owner} {ad.verified ? "✓" : ""}
            </Text>
            <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
              {(locale === "ar" ? city?.ar : city?.en) ?? ad.cityId}
              {" · "}
              {(locale === "ar" ? category?.ar : category?.en) ?? ad.categoryId}
              {" · "}
              {ad.countryCode ?? "SA"}
            </Text>
          </View>
        </Pressable>

        <Text numberOfLines={2} style={[styles.adTitle, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.title}
        </Text>
        {ad.description ? (
          <Text numberOfLines={2} style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>
            {ad.description}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel(contact?.type, t)}
          onPress={openContact}
          style={[styles.cta, { flexDirection: isRTL ? "row" : "row-reverse" }]}
        >
          <Text style={styles.ctaText}>{ctaLabel(contact?.type, t)}</Text>
          <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={18} color={BRAND.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: BRAND.charcoal,
  },
  fullscreen: {
    maxWidth: "100%",
    borderRadius: 0,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#282828",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.28)",
  },
  badges: {
    position: "absolute",
    top: 104,
    right: 14,
    left: 14,
    gap: 6,
    justifyContent: "flex-end",
  },
  badge: {
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgePaid: {
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: BRAND.white, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  badgePaidText: { color: BRAND.black, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  mediaLabel: {
    position: "absolute",
    top: 104,
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { position: "absolute", bottom: 34, gap: 14, alignItems: "center" },
  action: { width: 58, alignItems: "center", gap: 3 },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.3)",
    backgroundColor: "rgba(0,0,0,.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSaved: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  actionText: { color: BRAND.white, fontSize: 10, lineHeight: 13, fontWeight: "900" },
  copy: { position: "absolute", bottom: 24 },
  owner: { alignItems: "center", gap: 10, marginBottom: 9 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: BRAND.white,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: BRAND.black, fontSize: 18, fontWeight: "900" },
  brandName: { color: BRAND.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  meta: { marginTop: 3, color: "#ddd", fontSize: 11, lineHeight: 16 },
  adTitle: { marginBottom: 6, color: BRAND.white, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  description: { color: "#eee", fontSize: 13, lineHeight: 20 },
  cta: {
    width: "100%",
    height: 49,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
});
