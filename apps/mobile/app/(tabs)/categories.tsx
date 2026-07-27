import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category } from '@e3lani/api-client';
import { LogoMark } from '../../src/components/LogoMark';
import { api } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, rowDirection, textAlign } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.categories().then(setCategories).catch(console.error);
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }}
    >
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <LogoMark size={26} />
        <Text style={styles.title}>{t('categories.title')}</Text>
        <Pressable style={styles.searchBtn} onPress={() => router.push('/search' as never)}>
          <Text style={styles.searchBtnText}>{t('nav.search')}</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {categories.slice(0, 6).map((category) => (
          <Pressable
            key={category.id}
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/search', params: { categoryId: category.id } } as never)
            }
          >
            <View style={styles.iconBubble}>
              <Text style={styles.iconLetter}>
                {(locale === 'ar' ? category.nameAr : category.nameEn).slice(0, 1)}
              </Text>
            </View>
            <Text style={styles.cardLabel}>{locale === 'ar' ? category.nameAr : category.nameEn}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.section, { textAlign }]}>{t('categories.exploreMore')}</Text>
      <View style={styles.list}>
        {categories.slice(6).map((category) => (
          <Pressable
            key={category.id}
            style={[styles.listRow, { flexDirection: rowDirection }]}
            onPress={() =>
              router.push({ pathname: '/search', params: { categoryId: category.id } } as never)
            }
          >
            <Text style={styles.listLabel}>{locale === 'ar' ? category.nameAr : category.nameEn}</Text>
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: { color: colors.black, fontSize: 28, fontWeight: '800' },
  searchBtn: {
    marginStart: 'auto',
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchBtnText: { color: colors.white, fontWeight: '800' },
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listLabel: { color: colors.black, fontWeight: '600', fontSize: 15 },
  chevron: { color: colors.gray, fontSize: 22 },
});
