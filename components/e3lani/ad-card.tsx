import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect } from "react";
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import { BRAND, type Ad, type AdMedia } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const localAssets = {
  poster: require("@/assets/images/e3lani-poster.png"),
  wordmark: require("@/assets/images/brand-wordmark.png"),
  icon: require("@/assets/images/icon.png"),
};

function VideoMedia({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

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
  accessibilityLabel,
}: {
  media?: AdMedia;
  active?: boolean;
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
    return <VideoMedia uri={media.uri} active={active} />;
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

export function AdCard({ ad, height = 540, active = false }: { ad: Ad; height?: number; active?: boolean }) {
  const { locale, isRTL, t } = useI18n();
  const { brand, savedIds, toggleSave, recordMetric, metrics } = useE3lani();
  const productData = useProductData();
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const saved = savedIds.includes(ad.id);
  const metric = metrics[ad.id];
  const saves = metric?.saves?.toLocaleString() ?? "0";
  const shares = metric?.shares?.toLocaleString() ?? "0";
  const views = metric?.views?.toLocaleString() ?? "0";

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleSave(ad.id);
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
  };

  return (
    <Pressable
      accessible
      accessibilityRole="link"
      accessibilityLabel={ad.title}
      accessibilityHint={locale === "ar" ? "يفتح تفاصيل الإعلان" : "Opens ad details"}
      onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
      style={({ pressed }) => [styles.card, { height, opacity: pressed ? 0.96 : 1 }]}
    >
      <MediaView media={ad.media[0]} active={active} accessibilityLabel={ad.title} />
      <View accessible={false} style={styles.scrim} />

      <View style={[styles.badges, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {ad.sponsored ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("sponsored")}</Text>
          </View>
        ) : null}
        {ad.featured ? (
          <View style={[styles.badge, styles.badgeDark]}>
            <Text style={[styles.badgeText, { color: BRAND.white }]}>{t("featured")}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={saved ? t("savedDone") : t("save")}
          accessibilityState={{ selected: saved }}
          onPress={save}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <MaterialIcons
            accessible={false}
            name={saved ? "bookmark" : "bookmark-border"}
            size={25}
            color={saved ? BRAND.yellow : BRAND.white}
          />
          <Text style={styles.actionText}>{saves}</Text>
        </Pressable>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("share")}
          onPress={share}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <MaterialIcons accessible={false} name="share" size={24} color={BRAND.white} />
          <Text style={styles.actionText}>{shares}</Text>
        </Pressable>
        <View accessible accessibilityLabel={`${t("views")}: ${views}`} style={styles.action}>
          <MaterialIcons accessible={false} name="visibility" size={24} color={BRAND.white} />
          <Text style={styles.actionText}>{views}</Text>
        </View>
      </View>

      <View style={[styles.copy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <View style={[styles.brandRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{brand?.name.slice(0, 1) ?? "إ"}</Text>
          </View>
          <Text numberOfLines={1} style={styles.brandName}>
            {brand?.name ?? "إعلاني"}
          </Text>
          {ad.verified ? (
            <MaterialIcons accessible={false} name="verified" size={18} color={BRAND.yellow} />
          ) : null}
        </View>
        <Text numberOfLines={2} style={[styles.adTitle, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.title}
        </Text>
        <Text numberOfLines={2} style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.description}
        </Text>
        <View style={[styles.location, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <MaterialIcons accessible={false} name="location-on" size={16} color={BRAND.white} />
          <Text style={styles.locationText}>{(locale === "ar" ? city?.ar : city?.en) ?? "—"}</Text>
        </View>
        <View accessible={false} style={styles.cta}>
          <Text style={styles.ctaText}>{t("details")}</Text>
          <MaterialIcons
            accessible={false}
            name={isRTL ? "arrow-back" : "arrow-forward"}
            size={18}
            color={BRAND.black}
          />
        </View>
      </View>
    </Pressable>
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
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: BRAND.charcoal },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.29)" },
  badges: { position: "absolute", top: 15, left: 15, right: 15, gap: 7 },
  badge: {
    minHeight: 29,
    borderRadius: 15,
    paddingHorizontal: 10,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDark: { backgroundColor: "rgba(17,17,17,.8)" },
  badgeText: { color: BRAND.black, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  actions: { position: "absolute", right: 12, bottom: 88, gap: 13 },
  action: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 2 },
  actionPressed: { opacity: 0.58, transform: [{ scale: 0.97 }] },
  actionText: { color: BRAND.white, fontSize: 9, lineHeight: 13, fontWeight: "800" },
  copy: { position: "absolute", left: 17, right: 58, bottom: 18 },
  brandRow: { alignItems: "center", gap: 7, maxWidth: "100%" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: BRAND.black, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  brandName: { color: BRAND.white, maxWidth: 220, fontSize: 13, lineHeight: 19, fontWeight: "900" },
  adTitle: { marginTop: 11, color: BRAND.white, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  description: { marginTop: 5, color: "#EFEFEF", fontSize: 13, lineHeight: 20 },
  location: { marginTop: 7, alignItems: "center", gap: 4 },
  locationText: { color: BRAND.white, fontSize: 12, lineHeight: 17 },
  cta: {
    marginTop: 13,
    minHeight: 44,
    minWidth: 138,
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: BRAND.yellow,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ctaText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
});
