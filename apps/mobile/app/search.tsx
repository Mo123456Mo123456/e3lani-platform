import * as React from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { AdDto, CategoryDto, CityDto, PaginatedDto } from '@e3lani/types';
import { api, buildQuery } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Badge, EmptyState, Loading } from '@/components/ui';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; subcategoryId?: string }>();
  const insets = useSafeAreaInsets();
  const [term, setTerm] = React.useState('');
  const [categories, setCategories] = React.useState<CategoryDto[]>([]);
  const [cities, setCities] = React.useState<CityDto[]>([]);
  const [filters, setFilters] = React.useState({
    categoryId: params.categoryId ?? '',
    subcategoryId: params.subcategoryId ?? '',
    cityId: '',
    mediaType: '' as '' | 'IMAGE' | 'VIDEO',
    verifiedOnly: false,
    highlightedOnly: false,
    promotedOnly: false,
    sort: 'latest' as 'latest' | 'most-viewed',
  });
  const [items, setItems] = React.useState<AdDto[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    void Promise.all([api<CategoryDto[]>('/categories'), api<CityDto[]>('/cities')])
      .then(([categoryRows, cityRows]) => {
        setCategories(categoryRows);
        setCities(cityRows);
      })
      .catch(() => undefined);
  }, []);

  const run = React.useCallback(async () => {
    setLoading(true);
    try {
      const page = await api<PaginatedDto<AdDto>>(
        `/search${buildQuery({
          q: term || undefined,
          categoryId: filters.categoryId || undefined,
          subcategoryId: filters.subcategoryId || undefined,
          cityId: filters.cityId || undefined,
          mediaType: filters.mediaType || undefined,
          verifiedOnly: filters.verifiedOnly || undefined,
          highlightedOnly: filters.highlightedOnly || undefined,
          promotedOnly: filters.promotedOnly || undefined,
          sort: filters.sort,
          limit: 20,
        })}`,
      );
      setItems(page.items);
    } finally {
      setLoading(false);
    }
  }, [term, filters]);

  React.useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const toggle = (key: 'verifiedOnly' | 'highlightedOnly' | 'promotedOnly') =>
    setFilters((current) => ({ ...current, [key]: !current[key] }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchRow}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={22} color={theme.colors.ink} />
        </Pressable>
        <TextInput
          value={term}
          onChangeText={setTerm}
          onSubmitEditing={run}
          returnKeyType="search"
          placeholder="ابحث عن أي شيء…"
          placeholderTextColor="#9A9A9A"
          style={styles.input}
        />
      </View>

      <View style={styles.filters}>
        {(
          [
            ['verifiedOnly', 'موثقة'],
            ['highlightedOnly', 'مميزة'],
            ['promotedOnly', 'ممولة'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => toggle(key)}
            style={[styles.chip, filters[key] ? styles.chipActive : null]}
          >
            <Text style={styles.chipText}>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() =>
            setFilters({ ...filters, mediaType: filters.mediaType === 'VIDEO' ? '' : 'VIDEO' })
          }
          style={[styles.chip, filters.mediaType === 'VIDEO' ? styles.chipActive : null]}
        >
          <Text style={styles.chipText}>فيديو فقط</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setFilters({ ...filters, mediaType: filters.mediaType === 'IMAGE' ? '' : 'IMAGE' })
          }
          style={[styles.chip, filters.mediaType === 'IMAGE' ? styles.chipActive : null]}
        >
          <Text style={styles.chipText}>صور فقط</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setFilters({ ...filters, sort: filters.sort === 'latest' ? 'most-viewed' : 'latest' })
          }
          style={[styles.chip, filters.sort === 'most-viewed' ? styles.chipActive : null]}
        >
          <Text style={styles.chipText}>
            {filters.sort === 'latest' ? 'الأحدث' : 'الأكثر مشاهدة'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(category) => category.id}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: 'center' }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              setFilters({
                ...filters,
                categoryId: filters.categoryId === item.id ? '' : item.id,
                subcategoryId: '',
              })
            }
            style={[styles.chip, filters.categoryId === item.id ? styles.chipActive : null]}
          >
            <Text style={styles.chipText}>{item.nameAr}</Text>
          </Pressable>
        )}
      />

      <FlatList
        horizontal
        data={cities}
        keyExtractor={(city) => city.id}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: 'center' }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              setFilters({ ...filters, cityId: filters.cityId === item.id ? '' : item.id })
            }
            style={[styles.chip, filters.cityId === item.id ? styles.chipActive : null]}
          >
            <Text style={styles.chipText}>{item.nameAr}</Text>
          </Pressable>
        )}
      />

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 8, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          ListEmptyComponent={<EmptyState title="لا توجد نتائج" description="جرّب كلمات أو فلاتر مختلفة." />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/ad/${item.id}`)}>
              <Image
                source={{ uri: item.media[0]?.thumbnailUrl ?? undefined }}
                style={styles.cardImage}
                contentFit="cover"
              />
              <View style={{ padding: 8, gap: 4 }}>
                <Text numberOfLines={2} style={styles.cardTitle}>
                  {item.title}
                </Text>
                {item.price !== null ? (
                  <Text style={styles.cardPrice}>{item.price.toLocaleString('ar-SA')} ر.س</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {item.city ? <Badge label={item.city.nameAr} /> : null}
                  {item.isHighlighted ? <Badge label="مميز" tone="primary" /> : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    fontSize: 15,
    textAlign: 'right',
    color: theme.colors.ink,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', aspectRatio: 0.8, backgroundColor: theme.colors.surface },
  cardTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.ink },
  cardPrice: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },
});
