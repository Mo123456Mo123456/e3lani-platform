import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = { size?: number; color?: string };

/**
 * Brand mark: two ascending yellow arrows (إعلاني | E3lani).
 * Pure Views — no SVG dependency.
 */
export function LogoMark({ size = 36, color = colors.primary }: Props) {
  const shaftW = Math.max(2, Math.round(size * 0.11));
  const head = size * 0.34;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel="E3lani"
      accessibilityRole="image"
    >
      <Arrow
        color={color}
        shaftW={shaftW}
        head={head}
        height={size * 0.78}
        left={size * 0.12}
        bottom={size * 0.06}
        rotate="-18deg"
        opacity={1}
      />
      <Arrow
        color={color}
        shaftW={shaftW}
        head={head}
        height={size * 0.92}
        left={size * 0.48}
        bottom={size * 0.02}
        rotate="-18deg"
        opacity={0.92}
      />
    </View>
  );
}

function Arrow({
  color,
  shaftW,
  head,
  height,
  left,
  bottom,
  rotate,
  opacity,
}: {
  color: string;
  shaftW: number;
  head: number;
  height: number;
  left: number;
  bottom: number;
  rotate: `${number}deg`;
  opacity: number;
}) {
  return (
    <View
      style={[
        styles.arrow,
        {
          left,
          bottom,
          height,
          opacity,
          transform: [{ rotate }],
        },
      ]}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderLeftWidth: head * 0.55,
          borderRightWidth: head * 0.55,
          borderBottomWidth: head,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          marginBottom: -2,
        }}
      />
      <View
        style={{
          width: shaftW,
          flex: 1,
          backgroundColor: color,
          borderRadius: shaftW,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    position: 'absolute',
    alignItems: 'center',
  },
});
