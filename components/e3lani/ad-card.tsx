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

import { REPORT_REASONS_AR } from "@/lib/e3lani-catalog";
import { BRAND, contactLabel, type Ad, type AdMedia } from "@/lib/e3lani-data";
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
    instance.muted = true;
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

function openContact(ad: Ad, recordMetric: (id: string, key: "contacts") => void, locale: "ar" | "en") {
  const contact = ad.contacts[0];
  if (!contact?.value) {
    Alert.alert(
      locale === "ar" ? "معاينة" : "Preview",
      locale === "ar"
        ? "هذا إعلان للمعاينة؛ أضف إعلانك لتجربة التواصل"
        : "This is a preview ad. Publish your own to try contact.",
    );
    return;
  }
  recordMetric(ad.id, "contacts");
  if (contact.type === "whatsapp") {
    void Linking.openURL(`https://wa.me/${contact.value.replace(/\D/g, "")}`);
    return;
  }
  if (contact.type === "phone") {
    void Linking.openURL(`tel:${contact.value.replace(/[^\d+]/g, "")}`);
    return;
  }
  const url = /^https?:\/\//i.test(contact.value) ? contact.value : `https://${contact.value}`;
  void Linking.openURL(url);
}

export function AdCard({
  ad,
  height = 540,
  active = false,
  variant = "card",
}: {
  ad: Ad;
  height?: number;
  active?: boolean;
  variant?: "card" | "feed";
}) {
  const { locale, isRTL, t } = useI18n();
  const { brand, savedIds, toggleSave, recordMetric, submitReport, metrics } = useE3lani();
  const productData = useProductData();
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find((item) => item.id === ad.categoryId);
  const saved = savedIds.includes(ad.id);
  const media = ad.media[0];
  const owner = ad.ownerName ?? brand?.name ?? "إعلاني";
  const [muted, setMuted] = useState(true);
  const feed = variant === "feed";

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
    Alert.alert(
      t("report"),
      locale === "ar" ? "اختر سبب البلاغ" : "Choose a reason",
      [
        ...REPORT_REASONS_AR.map((reason) => ({
          text: reason,
          onPress: () => submitReport(ad.id, reason),
        })),
        { text: t("close"), style: "cancel" as const },
      ],
    );
  };

  return (
    <View style={[styles.card, feed && styles.feedCard, { height }]}>
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

      {media ? (
        <View style={[styles.mediaLabel, isRTL ? { left: 14 } : { right: 14 }]}>
          <Text style={styles.badgeText}>{media.kind === "video" ? t("video") : t("image")}</Text>
        </View>
      ) : null}

      <View style={[styles.actions, isRTL ? { left: 10 } : { right: 10 }]}>
        {media?.kind === "video" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("sound")}
            onPress={() => setMuted((value) => !value)}
            style={styles.action}
          >
            <View style={styles.actionIcon}>
              <MaterialIcons name={muted ? "volume-off" : "volume-up"} size={22} color={BRAND.white} />
            </View>
            <Text style={styles.actionText}>{muted ? t("sound") : t("unmuted")}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? t("savedDone") : t("save")} onPress={save} style={styles.action}>
          <View style={[styles.actionIcon, saved && styles.actionIconSaved]}>
            <MaterialIcons name={saved ? "favorite" : "favorite-border"} size={22} color={saved ? BRAND.black : BRAND.white} />
          </View>
          <Text style={styles.actionText}>{t("save")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("share")} onPress={share} style={styles.action}>
          <View style={styles.actionIcon}>
            <MaterialIcons name="share" size={21} color={BRAND.white} />
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

      <View style={[styles.copy, isRTL ? { right: 16, left: 82 } : { left: 16, right: 82 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
          style={[styles.owner, { flexDirection: isRTL ? "row" : "row-reverse" }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{owner.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandName, { textAlign: isRTL ? "right" : "left" }]}>
              {owner} {ad.verified ? "✓" : ""}
            </Text>
            <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
              {(locale === "ar" ? city?.ar : city?.en) ?? "—"} · {(locale === "ar" ? category?.ar : category?.en) ?? "—"}
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
          accessibilityLabel={contactLabel(ad.contacts[0]?.type ?? "external", locale)}
          onPress={() => openContact(ad, recordMetric, locale)}
          style={[styles.cta, { flexDirection: isRTL ? "row" : "row-reverse" }]}
        >
          <Text style={styles.ctaText}>{contactLabel(ad.contacts[0]?.type ?? "external", locale)}</Text>
          <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={18} color={BRAND.black} />
        </Pressable>
      </View>

      {!feed ? (
        <Text style={styles.viewsHint}>
          {t("views")}: {(metrics[ad.id]?.views ?? 0).toLocaleString()}
        </Text>
      ) : null}
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
  feedCard: {
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
    backgroundColor: "transparent",
    borderBottomWidth: 220,
    borderBottomColor: "rgba(0,0,0,0.82)",
  },
  badges: {
    position: "absolute",
    top: 14,
    right: 14,
    left: 14,
    gap: 6,
    justifyContent: "flex-start",
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgePaid: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: BRAND.yellow,
  },
  badgeText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  badgePaidText: { color: BRAND.black, fontSize: 10, fontWeight: "900" },
  mediaLabel: {
    position: "absolute",
    top: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  actions: { position: "absolute", bottom: 34, gap: 14, zIndex: 6 },
  action: { width: 58, alignItems: "center", gap: 3 },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSaved: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  actionText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  copy: { position: "absolute", bottom: 24, zIndex: 5 },
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
  adTitle: { marginBottom: 6, color: BRAND.white, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  description: { color: "#eee", fontSize: 13, lineHeight: 20 },
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
  viewsHint: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    color: "transparent",
    fontSize: 1,
  },
});
