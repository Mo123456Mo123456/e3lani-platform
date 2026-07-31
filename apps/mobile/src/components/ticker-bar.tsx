import * as React from 'react';
import { Animated, Easing, I18nManager, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { TICKER } from '@e3lani/config';
import type { TickerLogoDto } from '@e3lani/types';
import { theme } from '@/lib/theme';

const LOGO_WIDTH = 84;
const SEPARATOR_WIDTH = 26;
const GAP = 18;

/**
 * الشريط الإعلاني العلوي (شعارات فقط).
 *  • حركة مستمرة لا تتوقف عند اللمس (pointerEvents="none" يمنع أي تفاعل).
 *  • غير قابل للنقر ولا يفتح روابط.
 *  • شعار «إعلاني» يظهر كفاصل أصغر بين الشعارات.
 *  • لا يتكرر الشعار نفسه مرتين متتاليتين.
 */
export function TickerBar({ logos }: { logos: TickerLogoDto[] }) {
  const sequence = React.useMemo(() => dedupeAdjacent(logos), [logos]);
  const translate = React.useRef(new Animated.Value(0)).current;

  const itemsWidth = sequence.length * (LOGO_WIDTH + SEPARATOR_WIDTH + GAP * 2);

  React.useEffect(() => {
    if (!sequence.length) return;
    translate.setValue(0);
    const animation = Animated.loop(
      Animated.timing(translate, {
        toValue: 1,
        duration: TICKER.loopDurationSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [sequence.length, translate, itemsWidth]);

  if (!sequence.length) return null;

  const direction = I18nManager.isRTL ? 1 : -1;
  const translateX = translate.interpolate({
    inputRange: [0, 1],
    outputRange: [0, direction * itemsWidth],
  });

  return (
    <View style={styles.wrapper} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        {[0, 1].map((copy) => (
          <React.Fragment key={copy}>
            {sequence.map((logo, index) => (
              <React.Fragment key={`${copy}-${logo.id}-${index}`}>
                <Image
                  source={{ uri: logo.logoUrl }}
                  style={styles.logo}
                  contentFit="contain"
                  transition={150}
                />
                <View style={styles.separator}>
                  <View style={styles.separatorMark} />
                </View>
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </Animated.View>
    </View>
  );
}

/** يمنع ظهور الشعار نفسه مرتين متتاليتين. */
export function dedupeAdjacent(logos: TickerLogoDto[]): TickerLogoDto[] {
  const remaining = [...logos];
  const result: TickerLogoDto[] = [];
  while (remaining.length) {
    const previous = result[result.length - 1];
    let index = remaining.findIndex((logo) => !previous || logo.logoUrl !== previous.logoUrl);
    if (index === -1) index = 0;
    result.push(remaining.splice(index, 1)[0]!);
  }
  return result;
}

const styles = StyleSheet.create({
  wrapper: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  track: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: LOGO_WIDTH, height: 28, marginHorizontal: GAP / 2 },
  separator: { width: SEPARATOR_WIDTH, alignItems: 'center', justifyContent: 'center' },
  separatorMark: {
    width: 14,
    height: 14,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    opacity: 0.5,
  },
});
