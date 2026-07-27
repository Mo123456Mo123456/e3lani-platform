import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  size?: number;
  color?: string;
  /** When true, wrap arrows in the brand black tile (mockup logo). */
  framed?: boolean;
};

/**
 * Brand mark: two ascending yellow arrows (إعلاني | E3lani).
 * Matches approved mockup — optional black rounded tile frame.
 */
export function LogoMark({ size = 36, color = colors.primary, framed = false }: Props) {
  const inner = framed ? Math.round(size * 0.62) : size;
  const mark = <Arrows size={inner} color={color} />;

  if (!framed) return mark;

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.max(10, size * 0.22),
        },
      ]}
      accessibilityLabel="E3lani"
      accessibilityRole="image"
    >
      {mark}
    </View>
  );
}

function Arrows({ size, color }: { size: number; color: string }) {
  const shaftW = Math.max(2, Math.round(size * 0.12));
  const head = size * 0.36;

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="E3lani" accessibilityRole="image">
      <Arrow
        color={color}
        shaftW={shaftW}
        head={head}
        height={size * 0.78}
        left={size * 0.1}
        bottom={size * 0.04}
        rotate="-16deg"
        opacity={1}
      />
      <Arrow
        color={color}
        shaftW={shaftW}
        head={head}
        height={size * 0.94}
        left={size * 0.46}
        bottom={size * 0.02}
        rotate="-16deg"
        opacity={0.95}
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
  frame: {
    backgroundColor: colors.black,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    alignItems: 'center',
  },
});
