import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category } from '@e3lani/api-client';
import { BrandHeader } from '../../src/components/BrandHeader';
import { api } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, textAlign } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.categories().then(setCategories).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const ar = c.nameAr.toLowerCase();
      const en = c.nameEn.toLowerCase();
      return ar.includes(q) || en.includes(q);
    });
  }, [categories, query]);

  function openCategory(category: Category) {
    router.push({ pathname: '/search', params: { categoryId: category.id } } as never);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.pad}>
        <BrandHeader title={t('categories.title')} markSize={48} />
        <Pressable
          style={[styles.searchBar, { flexDirection: locale === 'ar' ? 'row-reverse' : 'row' }]}
          onPress={() => router.push('/search' as never)}
        >
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={locale === 'ar' ? 'ابحث في الأقسام' : 'Search in categories'}
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={[styles.searchInput, { textAlign }]}
            onSubmitEditing={() => {
              if (query.trim()) {
                router.push({ pathname: '/search', params: { q: query.trim() } } as never);
              } else {
                router.push('/search' as never);
              }
            }}
            returnKeyType="search"
          />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {filtered.map((category) => (
          <Pressable key={category.id} style={styles.card} onPress={() => openCategory(category)}>
            <View style={styles.iconBubble}>
              <Text style={styles.iconLetter}>
                {(locale === 'ar' ? category.nameAr : category.nameEn).slice(0, 1)}
              </Text>
            </View>
            <Text style={styles.cardLabel} numberOfLines={2}>
              {locale === 'ar' ? category.nameAr : category.nameEn}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  pad: { paddingHorizontal: 16 },
  searchBar: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.charcoal,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.22)',
  },
  searchIcon: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '31%',
    backgroundColor: colors.charcoal,
    borderRadius: 18,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.14)',
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLetter: { color: colors.black, fontSize: 18, fontWeight: '800' },
  cardLabel: { color: colors.white, fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
