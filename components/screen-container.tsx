import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  return (
    <View className={cn("flex-1", "bg-background", containerClassName)} {...props}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.watermark}>
        <Text style={styles.watermarkMark}>إ</Text>
        <Text style={styles.watermarkName}>إعلاني | E3lani</Text>
      </View>
      <SafeAreaView edges={edges} className={cn("flex-1", safeAreaClassName)} style={style}>
        <View className={cn("flex-1", className)}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  watermark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.028,
    transform: [{ rotate: "-18deg" }],
  },
  watermarkMark: { color: "#111111", fontSize: 132, lineHeight: 142, fontWeight: "900" },
  watermarkName: { color: "#111111", fontSize: 22, lineHeight: 30, fontWeight: "900", letterSpacing: 0.4 },
});
