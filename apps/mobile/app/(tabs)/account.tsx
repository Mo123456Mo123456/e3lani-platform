import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@e3lani/i18n';
import { LogoMark } from '../../src/components/LogoMark';
import { colors } from '../../src/theme';

const stats = [
  { key: 'account.views', value: '128,547' },
  { key: 'account.clicks', value: '3,842' },
  { key: 'account.saves', value: '1,926' },
  { key: 'account.shares', value: '1,243' },
] as const;

const menu = ['إعلاناتي', 'المحفوظات', 'المفضلة', 'الإعدادات'];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <LogoMark size={28} />
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>معلن موثق</Text>
          <Text style={styles.meta}>الرياض · حساب تجريبي</Text>
        </View>
      </View>

      <Text style={styles.section}>{t('ar', 'account.overview')}</Text>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.key} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{t('ar', stat.key)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chart}>
        <Text style={styles.chartTitle}>المشاهدات خلال الفترة</Text>
        <View style={styles.chartLine}>
          {[20, 35, 28, 48, 62, 70, 85].map((h, i) => (
            <View key={i} style={[styles.bar, { height: h }]} />
          ))}
        </View>
      </View>

      <View style={styles.menu}>
        {menu.map((item) => (
          <View key={item} style={styles.menuRow}>
            <Text style={styles.menuLabel}>{item}</Text>
            <Text style={styles.chevron}>‹</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  profile: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileText: { flex: 1 },
  name: { color: colors.black, fontSize: 22, fontWeight: '800', textAlign: 'right' },
  meta: { color: colors.gray, marginTop: 4, textAlign: 'right' },
  section: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 10,
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    minHeight: 84,
  },
  statValue: { color: colors.black, fontSize: 22, fontWeight: '800', textAlign: 'right' },
  statLabel: { color: colors.gray, marginTop: 6, textAlign: 'right' },
  chart: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    minHeight: 150,
  },
  chartTitle: { color: colors.black, fontWeight: '700', textAlign: 'right', marginBottom: 16 },
  chartLine: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    gap: 8,
    height: 90,
  },
  bar: {
    flex: 1,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  menu: { marginTop: 18, gap: 8 },
  menuRow: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: { color: colors.black, fontWeight: '600' },
  chevron: { color: colors.gray, fontSize: 22 },
});
