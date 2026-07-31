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

import { BRAND, type Ad, type AdMedia } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { getCategory, getMarket } from "@/lib/e3lani-ui-data";
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

const contactUrls = {
  whatsapp: (value: string) => `https://wa.me/${value.replace(/\D/g, "")}`,
  phone: (value: string) => `tel:${value.replace(/[^\d+]/g, "")}`,
  store: (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`),
  product: (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`),
};

export function AdCard({
  ad,
  height = 540,
  active = false,
  immersive = false,
}: {
  ad: Ad;
  height?: number;
  active?: boolean;
  immersive?: boolean;
}) {
  const { locale, isRTL, t } = useI18n();
  const { brand, savedIds, toggleSave, recordMetric, submitReport } = useE3lani();
  const productData = useProductData();
  const [muted, setMuted] = useState(true);
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find((item) => item.id === ad.categoryId);
  const saved = savedIds.includes(ad.id);
  const owner = ad.displayOwner ?? brand?.name ?? "إعلاني";
  const avatar = ad.displayAvatar ?? owner.slice(0, 1);
  const cityName = ad.cityName ?? (locale === "ar" ? city?.ar : city?.en) ?? "—";
  const categoryName =
    (locale === "ar" ? category?.ar : category?.en) ??
    (locale === "ar" ? getCategory(ad.categoryId)?.ar : getCategory(ad.categoryId)?.en) ??
    "—";
  const countryName = locale === "ar"
    ? getMarket(ad.countryCode ?? "SA").ar
    : getMarket(ad.countryCode ?? "SA").en;
  const contact = ad.contacts[0];

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleSave(ad.id);
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
  };

  const openContact = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!contact?.value) {
      Alert.alert(
        locale === "ar" ? "إعلان للمعاينة" : "Preview ad",
        locale === "ar"
          ? "أضف إعلانك لتجربة التواصل المباشر."
          : "Publish your own ad to try direct contact.",
      );
      return;
    }
    recordMetric(ad.id, "contacts");
    try {
      await Linking.openURL(contactUrls[contact.type](contact.value));
    } catch {
      Alert.alert(t("error"));
    }
  };

  const report = (event: GestureResponderEvent) => {
    event.stopPropagation();
    Alert.alert(
      locale === "ar" ? "الإبلاغ عن الإعلان" : "Report ad",
      locale === "ar" ? "اختر سبب البلاغ" : "Choose a reason",
      [
        {
          text: locale === "ar" ? "محتوى مضلل" : "Misleading content",
          onPress: () => submitReport(ad.id, "misleading"),
        },
        {
          text: locale === "ar" ? "منتج ممنوع" : "Prohibited item",
          onPress: () => submitReport(ad.id, "prohibited"),
        },
        { text: t("close"), style: "cancel" },
      ],
    );
  };

  const action = (
    icon: React.ComponentProps<typeof MaterialIcons>["name"],
    label: string,
    onPress: (event: GestureResponderEvent) => void,
    selected = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionIcon, selected && styles.actionIconSelected]}>
        <MaterialIcons
          accessible={false}
          name={icon}
          size={23}
          color={selected ? BRAND.black : BRAND.white}
        />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );

  return (
    <Pressable
      accessible
      accessibilityRole="link"
      accessibilityLabel={ad.title}
      accessibilityHint={locale === "ar" ? "يفتح تفاصيل الإعلان" : "Opens ad details"}
      onPress={() => router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)}
      style={({ pressed }) => [
        styles.card,
        immersive && styles.immersive,
        { height, opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <MediaView media={ad.media[0]} active={active} muted={muted} accessibilityLabel={ad.title} />
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

      <View style={styles.mediaLabel}>
        <Text style={styles.mediaLabelText}>
          {ad.media[0]?.kind === "video" ? (locale === "ar" ? "فيديو" : "Video") : locale === "ar" ? "صورة" : "Photo"}
        </Text>
      </View>

      <View style={styles.actions}>
        {ad.media[0]?.kind === "video"
          ? action(muted ? "music-off" : "music-note", muted ? (locale === "ar" ? "الصوت" : "Sound") : locale === "ar" ? "مسموع" : "On", (event) => {
              event.stopPropagation();
              setMuted((current) => !current);
            })
          : null}
        {action(saved ? "favorite" : "favorite-border", t("save"), save, saved)}
        {action("share", t("share"), share)}
        {action("priority-high", t("report"), report)}
      </View>

      <View style={[styles.copy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <View style={[styles.brandRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatar}</Text>
          </View>
          <Text numberOfLines={1} style={styles.brandName}>
            {owner}
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
          {cityName} · {categoryName} · {countryName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={contact ? t(contact.type) : t("contact")}
          onPress={openContact}
          style={({ pressed }) => [styles.cta, pressed && styles.actionPressed]}
        >
          <Text style={styles.ctaText}>{contact ? t(contact.type) : t("contact")}</Text>
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
    maxWidth: 580,
    alignSelf: "center",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: BRAND.charcoal,
  },
  immersive: { maxWidth: "100%", borderRadius: 0 },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: BRAND.charcoal },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.18)",
    borderBottomWidth: 230,
    borderBottomColor: "rgba(0,0,0,.48)",
  },
  badges: { position: "absolute", top: 108, right: 14, gap: 6 },
  badge: {
    minHeight: 27,
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDark: { backgroundColor: "rgba(17,17,17,.8)" },
  badgeText: { color: BRAND.black, fontSize: 10, lineHeight: 14, fontWeight: "900" },
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
  actions: { position: "absolute", left: 7, bottom: 29, gap: 12 },
  action: { width: 60, minHeight: 49, alignItems: "center", justifyContent: "center", gap: 3 },
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
  actionIconSelected: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  actionPressed: { opacity: 0.58, transform: [{ scale: 0.97 }] },
  actionText: { color: BRAND.white, fontSize: 9, lineHeight: 13, fontWeight: "900" },
  copy: { position: "absolute", left: 76, right: 16, bottom: 24 },
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
  adTitle: { marginTop: 9, color: BRAND.white, fontSize: 22, lineHeight: 29, fontWeight: "900" },
  description: { marginTop: 5, color: "#EFEFEF", fontSize: 13, lineHeight: 20 },
  locationText: { width: "100%", marginTop: 6, color: "#DDD", fontSize: 11, lineHeight: 16 },
  cta: {
    marginTop: 13,
    minHeight: 49,
    width: "100%",
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: BRAND.yellow,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
  },
  ctaText: { color: BRAND.black, fontSize: 13, lineHeight: 18, fontWeight: "900" },
});
