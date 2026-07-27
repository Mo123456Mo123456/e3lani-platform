import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category } from '@e3lani/api-client';
import { t } from '@e3lani/i18n';
import { LogoMark } from '../../src/components/LogoMark';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.categories().then(setCategories).catch(console.error);
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }}
    >
      <View style={styles.header}>
        <LogoMark size={26} />
        <Text style={styles.title}>{t('ar', 'categories.title')}</Text>
      </View>
      <View style={styles.grid}>
        {categories.slice(0, 6).map((category) => (
          <Pressable key={category.id} style={styles.card}>
            <View style={styles.iconBubble}>
              <Text style={styles.iconLetter}>{category.nameAr.slice(0, 1)}</Text>
            </View>
            <Text style={styles.cardLabel}>{category.nameAr}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.section}>{t('ar', 'categories.exploreMore')}</Text>
      <View style={styles.list}>
        {categories.slice(6).map((category) => (
          <Pressable key={category.id} style={styles.listRow}>
            <Text style={styles.listLabel}>{category.nameAr}</Text>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: { color: colors.black, fontSize: 28, fontWeight: '800' },
  grid: { paddingHorizontal: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLetter: { color: colors.black, fontSize: 20, fontWeight: '800' },
  cardLabel: { color: colors.black, fontWeight: '700', fontSize: 15 },
  section: {
    marginTop: 28,
    marginBottom: 10,
    paddingHorizontal: 20,
    color: colors.black,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  list: { paddingHorizontal: 16, gap: 8 },
  listRow: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listLabel: { color: colors.black, fontWeight: '600', fontSize: 15 },
  chevron: { color: colors.gray, fontSize: 22 },
});
