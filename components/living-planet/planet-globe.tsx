import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import type { Region, WorldEvent } from "@/packages/simulation-models/src";

interface PlanetGlobeProps {
  seed: number;
  regions: Region[];
  events: WorldEvent[];
  selectedRegionId: string;
  pollution: number;
  onSelectRegion: (regionId: string) => void;
}

const biomeColor: Record<Region["biome"], string> = {
  ocean: "#0a5278",
  coast: "#2b9c9b",
  plains: "#769d55",
  rainforest: "#1d7e46",
  temperate_forest: "#377d4b",
  desert: "#bb8f52",
  mountain: "#777a75",
  tundra: "#98aaa4",
  wetland: "#438f7a",
  steppe: "#9b9055",
  volcanic: "#8a4f39",
  ice: "#d7edf3",
};

export default function PlanetGlobe({
  regions,
  selectedRegionId,
  onSelectRegion,
}: PlanetGlobeProps) {
  const visible = regions
    .filter((region) => region.longitude > -92 && region.longitude < 92)
    .slice(0, 72);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="كوكب تفاعلي؛ اضغط لاختيار إقليم"
      style={styles.container}
      onPress={() => {
        const current = regions.findIndex((region) => region.id === selectedRegionId);
        onSelectRegion(regions[(current + 1) % regions.length].id);
      }}
    >
      <View style={styles.glow} />
      <Svg viewBox="0 0 360 360" width="100%" height="100%">
        <Defs>
          <RadialGradient id="ocean" cx="38%" cy="32%" r="68%">
            <Stop offset="0%" stopColor="#248fba" />
            <Stop offset="58%" stopColor="#083f67" />
            <Stop offset="100%" stopColor="#021827" />
          </RadialGradient>
        </Defs>
        <Circle cx="180" cy="180" r="139" fill="url(#ocean)" stroke="#55d8ff" strokeOpacity={0.5} />
        {visible.map((region) => {
          const x = 180 + (region.longitude / 92) * 126;
          const y = 180 - (region.latitude / 90) * 126;
          const edge = Math.sqrt((x - 180) ** 2 + (y - 180) ** 2);
          if (edge > 132) return null;
          return (
            <Circle
              key={region.id}
              cx={x}
              cy={y}
              r={region.id === selectedRegionId ? 8 : 5 + Math.max(0, region.elevation) * 5}
              fill={biomeColor[region.biome]}
              opacity={region.biome === "ocean" ? 0.34 : 0.9}
              stroke={region.id === selectedRegionId ? "#8be9ff" : "transparent"}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 282,
    height: 282,
    borderRadius: 141,
    backgroundColor: "rgba(28, 153, 226, 0.12)",
  },
});
