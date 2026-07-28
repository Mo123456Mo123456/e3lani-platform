import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LogoMark } from './LogoMark';
import { useLocale } from '../lib/locale';
import { colors } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  markSize?: number;
};

/** Black/yellow brand row with framed dual yellow arrows — Categories & Account. */
export function BrandHeader({ title, subtitle, trailing, markSize = 44 }: Props) {
  const { rowDirection, textAlign } = useLocale();

  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <LogoMark size={markSize} framed />
      <View style={styles.textCol}>
        <Text style={[styles.brand, { textAlign }]}>إعلاني | E3lani</Text>
        <Text style={[styles.title, { textAlign }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { textAlign }]}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  textCol: { flex: 1, minWidth: 0 },
  brand: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  title: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 4,
  },
  trailing: { marginStart: 'auto' },
});
