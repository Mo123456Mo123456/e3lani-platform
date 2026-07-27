import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = { size?: number; color?: string };

/** Two upward yellow arrows — brand mark (vector-free placeholder). */
export function LogoMark({ size = 36, color = colors.primary }: Props) {
  return (
    <View style={{ width: size, height: size }} accessibilityLabel="E3lani">
      <View
        style={[
          styles.arrowOuter,
          {
            borderBottomColor: color,
            borderLeftWidth: size * 0.22,
            borderRightWidth: size * 0.22,
            borderBottomWidth: size * 0.55,
            left: size * 0.08,
            top: size * 0.08,
          },
        ]}
      />
      <View
        style={[
          styles.arrowInner,
          {
            borderBottomColor: color,
            opacity: 0.7,
            borderLeftWidth: size * 0.16,
            borderRightWidth: size * 0.16,
            borderBottomWidth: size * 0.4,
            left: size * 0.28,
            top: size * 0.28,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  arrowOuter: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '28deg' }],
  },
  arrowInner: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '28deg' }],
  },
});
