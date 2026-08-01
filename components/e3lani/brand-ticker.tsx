import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { BRAND } from "@/lib/e3lani-data";

const LOGOS = ["نَخبة", "URBAN", "رِواق", "VIA", "SAND", "تِقنية", "رؤية", "LUMA"];

export function BrandTicker() {
  const offset = useRef(new Animated.Value(0)).current;
  const items = useMemo(() => [...LOGOS, ...LOGOS], []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [offset]);

  const translateX = offset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -560],
  });

  return (
    <View accessible={false} style={styles.ticker}>
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        {items.map((logo, index) => (
          <View key={`${logo}-${index}`} style={styles.item}>
            <Text style={styles.logo}>{logo}</Text>
            <Text style={styles.separator}>إعلاني</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    height: 40,
    overflow: "hidden",
    backgroundColor: BRAND.yellow,
  },
  track: {
    minWidth: 1200,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  logo: {
    minWidth: 72,
    color: BRAND.black,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  separator: {
    marginHorizontal: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: BRAND.black,
    color: BRAND.white,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
  },
});
