import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { BRAND } from "@/lib/e3lani-data";
import { TICKER_LOGOS } from "@/lib/e3lani-feed";

export function BrandTicker() {
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
    <View accessible={false} style={styles.wrap}>
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        {logos.map((logo, index) => (
          <View key={`${logo}-${index}`} style={styles.item}>
            <Text style={styles.logo}>{logo}</Text>
            <View style={styles.separator}>
              <Text style={styles.separatorText}>إعلاني</Text>
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
    width: 1200,
  },
  item: { flexDirection: "row", alignItems: "center" },
  logo: {
    minWidth: 90,
    paddingHorizontal: 14,
    color: BRAND.black,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  separator: {
    marginHorizontal: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: BRAND.black,
  },
  separatorText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
});
