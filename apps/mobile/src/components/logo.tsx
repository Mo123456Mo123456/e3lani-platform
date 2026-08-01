import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BRAND, COLORS } from '@e3lani/config';

export interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  /** نسخة للخلفيات الملوّنة: العلامة بيضاء والنص أسود */
  onPrimary?: boolean;
}

/**
 * شعار «إعلاني» — نفس الشكل المستخدم في الويب ولوحة الإدارة والأيقونة،
 * مرسوم متجهيًا فيبقى حادًا في كل المقاسات.
 */
export function Logo({ size = 48, withWordmark = true, onPrimary = false }: LogoProps) {
  const markBackground = onPrimary ? COLORS.white : COLORS.primary;
  const markForeground = COLORS.ink;

  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Rect width={48} height={48} rx={14} fill={markBackground} />
        <Path
          d="M14 19.5c0-1.4 1.1-2.5 2.5-2.5h9.8c.9 0 1.7.5 2.2 1.2l4.4 7c.5.8.5 1.8 0 2.6l-4.4 7c-.5.7-1.3 1.2-2.2 1.2h-9.8c-1.4 0-2.5-1.1-2.5-2.5v-14z"
          fill={markForeground}
          opacity={0.92}
        />
        <Circle cx={20.5} cy={26.5} r={2.6} fill={markBackground} />
      </Svg>

      {withWordmark ? (
        <Text style={[styles.wordmark, { fontSize: size * 0.62 }]}>{BRAND.nameAr}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontWeight: '800', color: COLORS.ink, letterSpacing: -0.5 },
});
