import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { t } from '@e3lani/i18n';
import { colors } from '../theme';

const tabs = [
  { href: '/', labelKey: 'nav.home' as const },
  { href: '/categories', labelKey: 'nav.categories' as const },
  { href: '/create', labelKey: 'nav.add' as const, center: true },
  { href: '/saved', labelKey: 'nav.saved' as const },
  { href: '/account', labelKey: 'nav.account' as const },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
        if (tab.center) {
          return (
            <Pressable
              key={tab.href}
              accessibilityRole="button"
              accessibilityLabel={t('ar', tab.labelKey)}
              onPress={() => router.push(tab.href as never)}
              style={styles.centerBtn}
            >
              <Text style={styles.centerPlus}>+</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={tab.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => router.push(tab.href as never)}
            style={styles.tab}
          >
            <Text style={[styles.tabLabel, active && styles.tabActive]}>{t('ar', tab.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(17,17,17,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  tabActive: {
    color: colors.primary,
  },
  centerBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  centerPlus: {
    color: colors.black,
    fontSize: 34,
    fontWeight: '700',
    marginTop: -2,
  },
});
