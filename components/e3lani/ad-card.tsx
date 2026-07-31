import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import {
  BRAND,
  buildContactUrl,
  contactCtaLabel,
  fallbackCategories,
  fallbackCities,
  type Ad,
  type AdMedia,
} from "@/lib/e3lani-data";
import { REPORT_REASONS_AR } from "@/lib/e3lani-feed";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { useProductData } from "@/lib/use-product-data";

const localAssets = {
  poster: require("@/assets/images/e3lani-poster.png"),
  wordmark: require("@/assets/images/brand-wordmark.png"),
  icon: require("@/assets/images/icon.png"),
};

function VideoMedia({
  uri,
  active,
  muted,
}: {
  uri: string;
  active: boolean;
  muted: boolean;
}) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

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
  const { brand, savedIds, toggleSave, recordMetric, submitReport } = useE3lani();
  const productData = useProductData();
  const cities = productData.cities.length ? productData.cities : fallbackCities;
  const categories = productData.categories.length
    ? productData.categories
    : fallbackCategories;
  const city = cities.find((item) => item.id === ad.cityId);
  const category = categories.find((item) => item.id === ad.categoryId);
  const saved = savedIds.includes(ad.id);
  const [muted, setMuted] = useState(true);
  const media = ad.media[0];
  const isVideo = media?.kind === "video";
  const ownerName = ad.ownerName ?? brand?.name ?? "إعلاني";
  const contact = ad.contacts[0];

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleSave(ad.id);
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title} — ${ownerName}` });
  };

  const report = (event: GestureResponderEvent) => {
    event.stopPropagation();
    const quick = REPORT_REASONS_AR.slice(0, 2);
    Alert.alert(
      locale === "ar" ? "الإبلاغ عن الإعلان" : "Report ad",
      locale === "ar" ? "اختر سبب البلاغ" : "Choose a reason",
      [
        ...quick.map((reason) => ({
          text: reason,
          onPress: () => {
            submitReport(ad.id, reason);
            Alert.alert(locale === "ar" ? "تم تسجيل البلاغ" : "Report submitted");
          },
        })),
        {
          text: locale === "ar" ? "سبب آخر" : "Other",
          onPress: () => {
            submitReport(ad.id, REPORT_REASONS_AR[REPORT_REASONS_AR.length - 1]);
            Alert.alert(locale === "ar" ? "تم تسجيل البلاغ" : "Report submitted");
          },
        },
        { text: locale === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
      ],
    );
  };

  const openContact = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!contact?.value) {
      Alert.alert(
        locale === "ar"
          ? "هذا إعلان للمعاينة؛ أضف إعلانك لتجربة التواصل"
          : "Preview ad — publish yours to try contact",
      );
      return;
    }
    const url = buildContactUrl(contact);
    if (!url) return;
    recordMetric(ad.id, "contacts");
    await Linking.openURL(url);
  };

  return (
    <View style={[styles.card, fullscreen && styles.fullscreen, { height }]}>
      <MediaView
        media={media}
        active={active}
        muted={muted}
        accessibilityLabel={ad.title}
      />
      <View accessible={false} style={styles.scrim} />

      <View style={[styles.badges, { right: isRTL ? undefined : 14, left: isRTL ? 14 : undefined }]}>
        {ad.sponsored ? (
          <View style={[styles.badge, styles.badgePaid]}>
            <Text style={[styles.badgeText, styles.badgePaidText]}>{t("sponsored")}</Text>
          </View>
        ) : null}
        {ad.featured ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("featured")}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.mediaLabel, { left: isRTL ? undefined : 14, right: isRTL ? 14 : undefined }]}>
        <Text style={styles.badgeText}>
          {isVideo ? (locale === "ar" ? "فيديو" : "Video") : locale === "ar" ? "صورة" : "Photo"}
        </Text>
      </View>

      <View style={[styles.actions, { left: isRTL ? undefined : 10, right: isRTL ? 10 : undefined }]}>
        {isVideo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? t("sound") : t("unmuted")}
            onPress={() => setMuted((value) => !value)}
            style={styles.action}
          >
            <View style={styles.actionIcon}>
              <MaterialIcons
                name={muted ? "volume-off" : "volume-up"}
                size={22}
                color={BRAND.white}
              />
            </View>
            <Text style={styles.actionText}>{muted ? t("sound") : t("unmuted")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? t("savedDone") : t("save")}
          accessibilityState={{ selected: saved }}
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
            <MaterialIcons name="report-gmailerrorred" size={22} color={BRAND.white} />
          </View>
          <Text style={styles.actionText}>{t("report")}</Text>
        </Pressable>
      </View>

      <View style={[styles.copy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
          style={[styles.owner, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ownerName.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandName, { textAlign: isRTL ? "right" : "left" }]}>
              {ownerName}
              {ad.verified ? " ✓" : ""}
            </Text>
            <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
              {(locale === "ar" ? city?.ar : city?.en) ?? "—"}
              {" · "}
              {(locale === "ar" ? category?.ar : category?.en) ?? ad.categoryId}
            </Text>
          </View>
        </Pressable>
        <Text numberOfLines={2} style={[styles.adTitle, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.title}
        </Text>
        <Text numberOfLines={2} style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>
          {ad.description}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={contact ? contactCtaLabel(contact.type, locale) : t("contact")}
          onPress={openContact}
          style={[styles.cta, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          <Text style={styles.ctaText}>
            {contact ? contactCtaLabel(contact.type, locale) : t("contact")}
          </Text>
          <MaterialIcons
            name={isRTL ? "arrow-back" : "arrow-forward"}
            size={18}
            color={BRAND.black}
          />
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
    backgroundColor: "#222",
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
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  badges: {
    position: "absolute",
    top: 104,
    flexDirection: "row",
    gap: 6,
  },
  mediaLabel: {
    position: "absolute",
    top: 104,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgePaid: { backgroundColor: BRAND.yellow },
  badgeText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  badgePaidText: { color: BRAND.black },
  actions: {
    position: "absolute",
    bottom: 34,
    gap: 14,
    alignItems: "center",
    zIndex: 6,
  },
  action: { width: 58, alignItems: "center", gap: 3 },
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
  actionText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  copy: {
    position: "absolute",
    left: 16,
    right: 82,
    bottom: 24,
    zIndex: 5,
  },
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
  },
  avatarText: { color: BRAND.black, fontSize: 18, fontWeight: "900" },
  brandName: { color: BRAND.white, fontSize: 14, fontWeight: "900" },
  meta: { marginTop: 3, color: "#ddd", fontSize: 11 },
  adTitle: { color: BRAND.white, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  description: { marginTop: 6, color: "#eee", fontSize: 13, lineHeight: 20 },
  cta: {
    marginTop: 12,
    height: 49,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: { color: BRAND.black, fontSize: 13, fontWeight: "900" },
});
