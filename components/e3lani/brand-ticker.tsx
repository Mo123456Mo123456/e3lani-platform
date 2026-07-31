import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { BRAND, TICKER_LOGOS } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";

export function BrandTicker() {
  const { t } = useI18n();
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(offset, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [offset]);

  const logos = [...TICKER_LOGOS, ...TICKER_LOGOS];
  const translateX = offset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -520],
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        {logos.map((logo, index) => (
          <View key={`${logo}-${index}`} style={styles.item}>
            <Text style={styles.logo}>{logo}</Text>
            <View style={styles.separator}>
              <Text style={styles.separatorText}>{t("tickerBrand")}</Text>
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 40,
    backgroundColor: BRAND.yellow,
    overflow: "hidden",
    justifyContent: "center",
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    width: 2000,
  },
  item: { flexDirection: "row", alignItems: "center" },
  logo: {
    minWidth: 90,
    paddingHorizontal: 14,
    textAlign: "center",
    color: BRAND.black,
    fontSize: 13,
    fontWeight: "900",
  },
  separator: {
    minWidth: 62,
    marginHorizontal: 5,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: BRAND.black,
  },
  separatorText: { color: BRAND.white, fontSize: 10, fontWeight: "900", textAlign: "center" },
});
