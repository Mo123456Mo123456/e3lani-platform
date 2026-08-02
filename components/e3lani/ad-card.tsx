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
import { trpc } from "@/lib/trpc";
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
  const { brand, savedIds, toggleSave, recordMetric, metrics } = useE3lani();
  const productData = useProductData();
  const saveMutation = trpc.ads.toggleSave.useMutation();
  const eventMutation = trpc.ads.recordEvent.useMutation();
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find((item) => item.id === ad.categoryId);
  const saved = savedIds.includes(ad.id);
  const metric = metrics[ad.id];
  const saves = metric?.saves?.toLocaleString() ?? "0";
  const shares = metric?.shares?.toLocaleString() ?? "0";
  const views = metric?.views?.toLocaleString() ?? "0";
  const ownerName = ad.advertiser?.displayName ?? brand?.name ?? "إعلاني";
  const contact = ad.contacts[0];
  const ctaLabel =
    contact?.type === "whatsapp"
      ? locale === "ar"
        ? "تواصل عبر واتساب"
        : "WhatsApp"
      : contact?.type === "phone"
        ? locale === "ar"
          ? "اتصال بالمعلن"
          : "Call advertiser"
        : contact?.type === "product"
          ? locale === "ar"
            ? "صفحة المنتج"
            : "Product page"
          : contact?.type === "store"
            ? locale === "ar"
              ? "زيارة المتجر"
              : "Visit store"
            : t("details");

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleSave(ad.id);
    void saveMutation.mutateAsync({ id: ad.id }).catch(() => {
      // The next saved-ids synchronization corrects an optimistic mismatch.
    });
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    const result = await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
    if (result.action !== Share.sharedAction) return;
    recordMetric(ad.id, "shares");
    void eventMutation
      .mutateAsync({
        id: ad.id,
        eventType: "share",
        dedupeSuffix: `share-${Date.now()}`,
      })
      .catch(() => undefined);
  };

  const openDetails = () => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never);

  return (
    <Pressable
      accessible
      accessibilityRole="link"
      accessibilityLabel={ad.title}
      accessibilityHint={locale === "ar" ? "يفتح تفاصيل الإعلان" : "Opens ad details"}
      onPress={openDetails}
      style={({ pressed }) => [
        styles.card,
        fullscreen && styles.cardFullscreen,
        { height, opacity: pressed ? 0.98 : 1 },
      ]}
    >
      <MediaView media={ad.media[0]} active={active} accessibilityLabel={ad.title} />
      <View accessible={false} style={[styles.scrim, fullscreen && styles.scrimFullscreen]} />

      <View
        style={[
          styles.badges,
          fullscreen && styles.badgesFullscreen,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
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

      {fullscreen ? (
        <View style={styles.mediaLabel}>
          <Text style={styles.mediaLabelText}>
            {ad.media[0]?.kind === "video"
              ? locale === "ar"
                ? "فيديو"
                : "Video"
              : locale === "ar"
                ? "صورة"
                : "Photo"}
          </Text>
        </View>
      ) : null}

      <View style={[styles.actions, fullscreen && styles.actionsFullscreen]}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={saved ? t("savedDone") : t("save")}
          accessibilityState={{ selected: saved }}
          onPress={save}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <View style={[styles.actionIcon, saved && styles.actionIconSaved]}>
            <MaterialIcons
              accessible={false}
              name={saved ? "favorite" : "favorite-border"}
              size={22}
              color={saved ? BRAND.black : BRAND.white}
            />
          </View>
          <Text style={styles.actionText}>{fullscreen ? t("save") : saves}</Text>
        </Pressable>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("share")}
          onPress={share}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons accessible={false} name="share" size={22} color={BRAND.white} />
          </View>
          <Text style={styles.actionText}>{fullscreen ? t("share") : shares}</Text>
        </Pressable>
        {!fullscreen ? (
          <View accessible accessibilityLabel={`${t("views")}: ${views}`} style={styles.action}>
            <MaterialIcons accessible={false} name="visibility" size={24} color={BRAND.white} />
            <Text style={styles.actionText}>{views}</Text>
          </View>
        ) : (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("report")}
            onPress={(event) => {
              event.stopPropagation();
              openDetails();
            }}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <View style={styles.actionIcon}>
              <MaterialIcons accessible={false} name="report-gmailerrorred" size={22} color={BRAND.white} />
            </View>
            <Text style={styles.actionText}>{t("report")}</Text>
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.copy,
          fullscreen && styles.copyFullscreen,
          { alignItems: isRTL ? "flex-end" : "flex-start" },
        ]}
      >
        <View style={[styles.brandRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.avatar, fullscreen && styles.avatarFullscreen]}>
            <Text style={styles.avatarText}>{ownerName.slice(0, 1)}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={[styles.brandRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text numberOfLines={1} style={styles.brandName}>
                {ownerName}
              </Text>
              {ad.verified ? (
                <MaterialIcons accessible={false} name="verified" size={18} color={BRAND.yellow} />
              ) : null}
            </View>
            {fullscreen ? (
              <Text style={styles.metaLine}>
                {(locale === "ar" ? city?.ar : city?.en) ?? "—"} ·{" "}
                {(locale === "ar" ? category?.ar : category?.en) ?? "—"}
              </Text>
            ) : null}
          </View>
        </View>
        <Text numberOfLines={2} style={[styles.adTitle, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.title}
        </Text>
        <Text numberOfLines={2} style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.description}
        </Text>
        {!fullscreen ? (
          <View style={[styles.location, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <MaterialIcons accessible={false} name="location-on" size={16} color={BRAND.white} />
            <Text style={styles.locationText}>{(locale === "ar" ? city?.ar : city?.en) ?? "—"}</Text>
          </View>
        ) : null}
        <View accessible={false} style={[styles.cta, fullscreen && styles.ctaFullscreen]}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
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
  cardFullscreen: {
    maxWidth: "100%",
    borderRadius: 0,
  },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: BRAND.charcoal },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.29)" },
  scrimFullscreen: { backgroundColor: "rgba(0,0,0,0.35)" },
  badges: { position: "absolute", top: 15, left: 15, right: 15, gap: 7 },
  badgesFullscreen: { top: 104, right: 14, left: undefined, width: "auto" },
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
  mediaLabel: {
    position: "absolute",
    top: 104,
    left: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.57)",
  },
  mediaLabelText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  actions: { position: "absolute", right: 12, bottom: 88, gap: 13 },
  actionsFullscreen: { left: 10, right: undefined, bottom: 34, gap: 14 },
  action: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 2 },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.19)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSaved: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  actionPressed: { opacity: 0.58, transform: [{ scale: 0.97 }] },
  actionText: { color: BRAND.white, fontSize: 9, lineHeight: 13, fontWeight: "800" },
  copy: { position: "absolute", left: 17, right: 58, bottom: 18 },
  copyFullscreen: { right: 82, left: 16, bottom: 24 },
  brandRow: { alignItems: "center", gap: 7, maxWidth: "100%" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFullscreen: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: BRAND.white,
  },
  avatarText: { color: BRAND.black, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  brandName: { color: BRAND.white, maxWidth: 220, fontSize: 13, lineHeight: 19, fontWeight: "900" },
  metaLine: { marginTop: 3, color: "#ddd", fontSize: 11, lineHeight: 16 },
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
  ctaFullscreen: {
    width: "100%",
    height: 49,
    justifyContent: "space-between",
  },
  ctaText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
});
