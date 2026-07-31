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

import { BRAND, type Ad, type AdMedia, type ContactType } from "@/lib/e3lani-data";
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

const contactLabels: Record<ContactType, [string, string]> = {
  whatsapp: ["تواصل عبر واتساب", "Contact on WhatsApp"],
  phone: ["اتصال بالمعلن", "Call advertiser"],
  store: ["زيارة المتجر", "Visit store"],
  product: ["صفحة المنتج", "View product"],
};

const contactUrl = (type: ContactType, value: string) =>
  type === "whatsapp"
    ? `https://wa.me/${value.replace(/\D/g, "")}`
    : type === "phone"
      ? `tel:${value.replace(/[^\d+]/g, "")}`
      : value.startsWith("http")
        ? value
        : `https://${value}`;

export function AdCard({ ad, height = 540, active = false }: { ad: Ad; height?: number; active?: boolean }) {
  const { locale, isRTL, t } = useI18n();
  const store = useE3lani();
  const productData = useProductData();
  const [muted, setMuted] = useState(true);
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find((item) => item.id === ad.categoryId);
  const saved = store.savedIds.includes(ad.id);
  const ownerName = ad.ownerName ?? store.brand?.name ?? "إعلاني";
  const primaryContact = ad.contacts[0];

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    store.toggleSave(ad.id);
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    store.recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
  };

  const contact = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!primaryContact) {
      router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never);
      return;
    }
    store.recordMetric(ad.id, "contacts");
    try {
      await Linking.openURL(contactUrl(primaryContact.type, primaryContact.value));
    } catch {
      Alert.alert(t("error"));
    }
  };

  const report = (event: GestureResponderEvent) => {
    event.stopPropagation();
    Alert.alert(
      t("report"),
      locale === "ar" ? "اختر سبب الإبلاغ عن هذا الإعلان." : "Choose a reason for reporting this ad.",
      [
        {
          text: locale === "ar" ? "محتوى مضلل" : "Misleading content",
          onPress: () => store.submitReport(ad.id, "misleading"),
        },
        {
          text: locale === "ar" ? "منتج ممنوع" : "Prohibited item",
          onPress: () => store.submitReport(ad.id, "prohibited"),
        },
        { text: t("close"), style: "cancel" },
      ],
    );
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
      <MediaView media={ad.media[0]} active={active} muted={muted} accessibilityLabel={ad.title} />
      <View accessible={false} style={styles.scrim} />
      <View accessible={false} style={styles.bottomScrim} />

      <View style={[styles.badges, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {ad.sponsored ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("sponsored")}</Text>
          </View>
        ) : null}
        {ad.featured ? (
          <View style={[styles.badge, styles.badgeDark]}>
            <Text style={[styles.badgeText, styles.badgeTextLight]}>{t("featured")}</Text>
          </View>
        ) : null}
      </View>

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

      <View style={[styles.actions, isRTL ? styles.actionsRTL : styles.actionsLTR]}>
        {ad.media[0]?.kind === "video" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              muted
                ? locale === "ar"
                  ? "تشغيل الصوت"
                  : "Turn sound on"
                : locale === "ar"
                  ? "كتم الصوت"
                  : "Mute"
            }
            onPress={(event) => {
              event.stopPropagation();
              setMuted((current) => !current);
            }}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <View style={styles.actionIcon}>
              <MaterialIcons accessible={false} name={muted ? "volume-off" : "volume-up"} size={23} color={BRAND.white} />
            </View>
            <Text style={styles.actionText}>{locale === "ar" ? "الصوت" : "Sound"}</Text>
          </Pressable>
        ) : null}

        <Pressable
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
              size={23}
              color={saved ? BRAND.black : BRAND.white}
            />
          </View>
          <Text style={styles.actionText}>{t("save")}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("share")}
          onPress={(event) => void share(event)}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons accessible={false} name="share" size={23} color={BRAND.white} />
          </View>
          <Text style={styles.actionText}>{t("share")}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("report")}
          onPress={report}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons accessible={false} name="priority-high" size={23} color={BRAND.white} />
          </View>
          <Text style={styles.actionText}>{t("report")}</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.copy,
          isRTL ? styles.copyRTL : styles.copyLTR,
          { alignItems: isRTL ? "flex-end" : "flex-start" },
        ]}
      >
        <View style={[styles.brandRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ad.ownerAvatar ?? ownerName.slice(0, 1)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.brandName}>
            {ownerName}
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
        <Text style={[styles.locationText, { textAlign: isRTL ? "right" : "left" }]}>
          {(locale === "ar" ? city?.ar : city?.en) ?? "—"} ·{" "}
          {(locale === "ar" ? category?.ar : category?.en) ?? "—"}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            primaryContact ? contactLabels[primaryContact.type][locale === "ar" ? 0 : 1] : t("details")
          }
          onPress={(event) => void contact(event)}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>
            {primaryContact ? contactLabels[primaryContact.type][locale === "ar" ? 0 : 1] : t("details")}
          </Text>
          <MaterialIcons
            accessible={false}
            name={isRTL ? "arrow-back" : "arrow-forward"}
            size={18}
            color={BRAND.black}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: BRAND.charcoal,
  },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: BRAND.charcoal },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.12)" },
  bottomScrim: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "50%",
    backgroundColor: "rgba(0,0,0,.64)",
  },
  badges: { position: "absolute", top: 108, right: 14, gap: 7 },
  badge: {
    minHeight: 29,
    borderRadius: 9,
    paddingHorizontal: 10,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDark: { backgroundColor: "rgba(17,17,17,.8)" },
  badgeText: { color: BRAND.black, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  badgeTextLight: { color: BRAND.white },
  mediaLabel: {
    position: "absolute",
    top: 108,
    left: 14,
    minHeight: 27,
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: "rgba(0,0,0,.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaLabelText: { color: BRAND.white, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  actions: { position: "absolute", bottom: 28, gap: 13 },
  actionsRTL: { left: 9 },
  actionsLTR: { right: 9 },
  action: { width: 58, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3 },
  actionIcon: {
    width: 43,
    height: 43,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSaved: { borderColor: BRAND.yellow, backgroundColor: BRAND.yellow },
  actionPressed: { opacity: 0.58, transform: [{ scale: 0.97 }] },
  actionText: { color: BRAND.white, fontSize: 9, lineHeight: 13, fontWeight: "800" },
  copy: { position: "absolute", bottom: 22 },
  copyRTL: { right: 16, left: 76 },
  copyLTR: { right: 76, left: 16 },
  brandRow: { alignItems: "center", gap: 7, maxWidth: "100%" },
  avatar: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: BRAND.white,
    borderRadius: 22,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: BRAND.black, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  brandName: { color: BRAND.white, maxWidth: 220, fontSize: 13, lineHeight: 19, fontWeight: "900" },
  adTitle: { marginTop: 10, color: BRAND.white, fontSize: 22, lineHeight: 29, fontWeight: "900" },
  description: { marginTop: 5, color: "#EFEFEF", fontSize: 13, lineHeight: 20 },
  locationText: { marginTop: 5, color: "#DDDDDD", fontSize: 11, lineHeight: 16 },
  cta: {
    width: "100%",
    minHeight: 49,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: BRAND.yellow,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
  },
  ctaPressed: { opacity: 0.72 },
  ctaText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
});
