import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState } from "react";
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

import { BRAND, type Ad, type AdMedia } from "@/lib/e3lani-data";
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
  muted = true,
}: {
  uri: string;
  active: boolean;
  muted?: boolean;
}) {
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
      <View
        accessible={false}
        style={[StyleSheet.absoluteFill, styles.fallback]}
      >
        <MaterialIcons
          accessible={false}
          name="campaign"
          size={48}
          color={BRAND.yellow}
        />
      </View>
    );
  }
  if (media.kind === "video" && !media.uri.startsWith("asset:")) {
    return <VideoMedia uri={media.uri} active={active} muted={muted} />;
  }
  const source = media.localAsset
    ? localAssets[media.localAsset]
    : { uri: media.uri };
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

function FeedAdCard({
  ad,
  height,
  active,
}: {
  ad: Ad;
  height: number;
  active: boolean;
}) {
  const { locale, isRTL, t } = useI18n();
  const { brand, savedIds, toggleSave, recordMetric, metrics, submitReport } =
    useE3lani();
  const productData = useProductData();
  const [muted, setMuted] = useState(true);
  const city = productData.cities.find((item) => item.id === ad.cityId);
  const category = productData.categories.find(
    (item) => item.id === ad.categoryId,
  );
  const saved = savedIds.includes(ad.id);
  const owner = ad.ownerName ?? brand?.name ?? "إعلاني";
  const primaryContact = ad.contacts[0];
  const metric = metrics[ad.id];
  const format = (value = 0) =>
    value >= 1000
      ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
      : value.toLocaleString(locale === "ar" ? "ar-SA" : "en");

  const save = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleSave(ad.id);
  };

  const share = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    recordMetric(ad.id, "shares");
    await Share.share({ message: `${ad.title}\ne3lani://ad/${ad.id}` });
  };

  const report = (event: GestureResponderEvent) => {
    event.stopPropagation();
    const send = (reason: string) => {
      submitReport(ad.id, reason);
      Alert.alert(locale === "ar" ? "تم تسجيل البلاغ" : "Report submitted");
    };
    Alert.alert(
      t("report"),
      locale === "ar" ? "اختر سبب البلاغ" : "Choose a reason",
      [
        {
          text: locale === "ar" ? "محتوى مضلل" : "Misleading",
          onPress: () => send("misleading"),
        },
        {
          text: locale === "ar" ? "محتوى غير مناسب" : "Inappropriate",
          onPress: () => send("inappropriate"),
        },
        { text: t("close"), style: "cancel" },
      ],
    );
  };

  const contact = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!primaryContact) {
      router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never);
      return;
    }
    recordMetric(ad.id, "contacts");
    const value = primaryContact.value.trim();
    const url =
      primaryContact.type === "whatsapp"
        ? `https://wa.me/${value.replace(/\D/g, "")}`
        : primaryContact.type === "phone"
          ? `tel:${value.replace(/[^+\d]/g, "")}`
          : /^https?:\/\//i.test(value)
            ? value
            : `https://${value}`;
    try {
      await Linking.openURL(url);
    } catch {
      router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never);
    }
  };

  const contactLabel =
    primaryContact?.type === "whatsapp"
      ? locale === "ar"
        ? "تواصل عبر واتساب"
        : "Contact on WhatsApp"
      : primaryContact?.type === "phone"
        ? locale === "ar"
          ? "اتصال بالمعلن"
          : "Call advertiser"
        : primaryContact?.type === "product"
          ? locale === "ar"
            ? "صفحة المنتج"
            : "Product page"
          : t("openStore");

  return (
    <Pressable
      accessible
      accessibilityRole="link"
      accessibilityLabel={ad.title}
      accessibilityHint={
        locale === "ar" ? "يفتح تفاصيل الإعلان" : "Opens ad details"
      }
      onPress={() =>
        router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)
      }
      style={({ pressed }) => [
        styles.feedCard,
        { height, opacity: pressed ? 0.98 : 1 },
      ]}
    >
      <MediaView
        media={ad.media[0]}
        active={active}
        muted={muted}
        accessibilityLabel={ad.title}
      />
      <View accessible={false} style={styles.feedScrim} />
      <View accessible={false} style={styles.feedBottomShade} />

      <View
        style={[
          styles.feedBadges,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        {ad.sponsored ? (
          <View style={styles.feedBadgeYellow}>
            <Text style={styles.feedBadgeDarkText}>{t("sponsored")}</Text>
          </View>
        ) : null}
        {ad.featured ? (
          <View style={styles.feedBadgeDark}>
            <Text style={styles.feedBadgeLightText}>{t("featured")}</Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.mediaLabel,
          isRTL ? styles.mediaLabelLeft : styles.mediaLabelRight,
        ]}
      >
        <Text style={styles.feedBadgeLightText}>
          {ad.media[0]?.kind === "video"
            ? locale === "ar"
              ? "فيديو"
              : "Video"
            : locale === "ar"
              ? "صورة"
              : "Photo"}
        </Text>
      </View>

      <View
        style={[
          styles.feedActions,
          isRTL ? styles.feedActionsLeft : styles.feedActionsRight,
        ]}
      >
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
              setMuted((value) => !value);
            }}
            style={({ pressed }) => [
              styles.feedAction,
              pressed && styles.actionPressed,
            ]}
          >
            <View style={styles.feedActionIcon}>
              <MaterialIcons
                name={muted ? "volume-off" : "volume-up"}
                size={22}
                color={BRAND.white}
              />
            </View>
            <Text style={styles.feedActionText}>
              {locale === "ar" ? "الصوت" : "Sound"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? t("savedDone") : t("save")}
          accessibilityState={{ selected: saved }}
          onPress={save}
          style={({ pressed }) => [
            styles.feedAction,
            pressed && styles.actionPressed,
          ]}
        >
          <View
            style={[styles.feedActionIcon, saved && styles.feedActionIconSaved]}
          >
            <MaterialIcons
              name={saved ? "favorite" : "favorite-border"}
              size={23}
              color={saved ? BRAND.black : BRAND.white}
            />
          </View>
          <Text style={styles.feedActionText}>{format(metric?.saves)}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("share")}
          onPress={share}
          style={({ pressed }) => [
            styles.feedAction,
            pressed && styles.actionPressed,
          ]}
        >
          <View style={styles.feedActionIcon}>
            <MaterialIcons name="ios-share" size={22} color={BRAND.white} />
          </View>
          <Text style={styles.feedActionText}>{format(metric?.shares)}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("report")}
          onPress={report}
          style={({ pressed }) => [
            styles.feedAction,
            pressed && styles.actionPressed,
          ]}
        >
          <View style={styles.feedActionIcon}>
            <MaterialIcons name="priority-high" size={23} color={BRAND.white} />
          </View>
          <Text style={styles.feedActionText}>{t("report")}</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.feedCopy,
          isRTL ? styles.feedCopyRTL : styles.feedCopyLTR,
          { alignItems: isRTL ? "flex-end" : "flex-start" },
        ]}
      >
        <View
          style={[
            styles.feedOwnerRow,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <View style={styles.feedAvatar}>
            <Text style={styles.feedAvatarText}>{owner.slice(0, 1)}</Text>
          </View>
          <View style={styles.feedOwnerCopy}>
            <View
              style={[
                styles.feedOwnerNameRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Text numberOfLines={1} style={styles.feedOwnerName}>
                {owner}
              </Text>
              {ad.verified ? (
                <MaterialIcons name="verified" size={17} color={BRAND.yellow} />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.feedMeta, { textAlign: isRTL ? "right" : "left" }]}
            >
              {[
                locale === "ar" ? city?.ar : city?.en,
                locale === "ar" ? category?.ar : category?.en,
                ad.countryCode,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.feedTitle, { textAlign: isRTL ? "right" : "left" }]}
        >
          {ad.title}
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.feedDescription,
            { textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {ad.description}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={contactLabel}
          onPress={contact}
          style={({ pressed }) => [
            styles.feedCta,
            { flexDirection: isRTL ? "row-reverse" : "row" },
            pressed && styles.ctaPressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.feedCtaText}>
            {contactLabel}
          </Text>
          <MaterialIcons
            name={isRTL ? "arrow-back" : "arrow-forward"}
            size={19}
            color={BRAND.black}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

function CompactAdCard({
  ad,
  height = 540,
  active = false,
}: {
  ad: Ad;
  height?: number;
  active?: boolean;
}) {
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
      accessibilityHint={
        locale === "ar" ? "يفتح تفاصيل الإعلان" : "Opens ad details"
      }
      onPress={() =>
        router.push({ pathname: "/ad/[id]", params: { id: ad.id } } as never)
      }
      style={({ pressed }) => [
        styles.card,
        { height, opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <MediaView
        media={ad.media[0]}
        active={active}
        accessibilityLabel={ad.title}
      />
      <View accessible={false} style={styles.scrim} />

      <View
        style={[
          styles.badges,
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
            <Text style={[styles.badgeText, { color: BRAND.white }]}>
              {t("featured")}
            </Text>
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
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
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
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <MaterialIcons
            accessible={false}
            name="share"
            size={24}
            color={BRAND.white}
          />
          <Text style={styles.actionText}>{shares}</Text>
        </Pressable>
        <View
          accessible
          accessibilityLabel={`${t("views")}: ${views}`}
          style={styles.action}
        >
          <MaterialIcons
            accessible={false}
            name="visibility"
            size={24}
            color={BRAND.white}
          />
          <Text style={styles.actionText}>{views}</Text>
        </View>
      </View>

      <View
        style={[styles.copy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}
      >
        <View
          style={[
            styles.brandRow,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {brand?.name.slice(0, 1) ?? "إ"}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.brandName}>
            {ad.ownerName ?? brand?.name ?? "إعلاني"}
          </Text>
          {ad.verified ? (
            <MaterialIcons
              accessible={false}
              name="verified"
              size={18}
              color={BRAND.yellow}
            />
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[styles.adTitle, { textAlign: isRTL ? "right" : "left" }]}
        >
          {ad.title}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}
        >
          {ad.description}
        </Text>
        <View
          style={[
            styles.location,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <MaterialIcons
            accessible={false}
            name="location-on"
            size={16}
            color={BRAND.white}
          />
          <Text style={styles.locationText}>
            {(locale === "ar" ? city?.ar : city?.en) ?? "—"}
          </Text>
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

export function AdCard({
  ad,
  height = 540,
  active = false,
  variant = "card",
}: {
  ad: Ad;
  height?: number;
  active?: boolean;
  variant?: "feed" | "card";
}) {
  return variant === "feed" ? (
    <FeedAdCard ad={ad} height={height} active={active} />
  ) : (
    <CompactAdCard ad={ad} height={height} active={active} />
  );
}

const styles = StyleSheet.create({
  feedCard: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: BRAND.charcoal,
  },
  feedScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.12)",
  },
  feedBottomShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "48%",
    backgroundColor: "rgba(0,0,0,.52)",
  },
  feedBadges: {
    position: "absolute",
    top: 106,
    right: 14,
    gap: 6,
  },
  feedBadgeYellow: {
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 10,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  feedBadgeDark: {
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  feedBadgeDarkText: {
    color: BRAND.black,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },
  feedBadgeLightText: {
    color: BRAND.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },
  mediaLabel: {
    position: "absolute",
    top: 106,
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaLabelLeft: { left: 14 },
  mediaLabelRight: { right: 14 },
  feedActions: {
    position: "absolute",
    bottom: 30,
    gap: 12,
    alignItems: "center",
  },
  feedActionsLeft: { left: 8 },
  feedActionsRight: { right: 8 },
  feedAction: {
    width: 58,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  feedActionIcon: {
    width: 43,
    height: 43,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  feedActionIconSaved: {
    backgroundColor: BRAND.yellow,
    borderColor: BRAND.yellow,
  },
  feedActionText: {
    color: BRAND.white,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
  },
  feedCopy: { position: "absolute", bottom: 22 },
  feedCopyRTL: { right: 16, left: 78 },
  feedCopyLTR: { left: 16, right: 78 },
  feedOwnerRow: { maxWidth: "100%", alignItems: "center", gap: 10 },
  feedAvatar: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: BRAND.white,
    borderRadius: 22,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  feedAvatarText: {
    color: BRAND.black,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  feedOwnerCopy: { flex: 1, minWidth: 0 },
  feedOwnerNameRow: { alignItems: "center", gap: 5 },
  feedOwnerName: {
    flexShrink: 1,
    color: BRAND.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  feedMeta: { marginTop: 2, color: "#DDD", fontSize: 10, lineHeight: 15 },
  feedTitle: {
    marginTop: 10,
    color: BRAND.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  feedDescription: {
    marginTop: 4,
    color: "#EEE",
    fontSize: 13,
    lineHeight: 20,
  },
  feedCta: {
    width: "100%",
    minHeight: 49,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  feedCtaText: {
    flex: 1,
    color: BRAND.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  ctaPressed: { opacity: 0.76 },
  card: {
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: BRAND.charcoal,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.charcoal,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.29)",
  },
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
  badgeText: {
    color: BRAND.black,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },
  actions: { position: "absolute", right: 12, bottom: 88, gap: 13 },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  actionPressed: { opacity: 0.58, transform: [{ scale: 0.97 }] },
  actionText: {
    color: BRAND.white,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "800",
  },
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
  avatarText: {
    color: BRAND.black,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  brandName: {
    color: BRAND.white,
    maxWidth: 220,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
  },
  adTitle: {
    marginTop: 11,
    color: BRAND.white,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
  },
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
  ctaText: {
    color: BRAND.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
});
