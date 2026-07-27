import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdDetail, Category, City, FeedSearchFilters } from '@e3lani/api-client';
import { api } from '../src/lib/api';
import { useLocale } from '../src/lib/locale';
import { colors } from '../src/theme';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string; cityId?: string; q?: string }>();
  const { locale, t, rowDirection, textAlign } = useLocale();
  const [q, setQ] = useState(params.q ?? '');
  const [categoryId, setCategoryId] = useState(params.categoryId ?? '');
  const [cityId, setCityId] = useState(params.cityId ?? '');
  const [kind, setKind] = useState<FeedSearchFilters['kind']>();
  const [sort, setSort] = useState<FeedSearchFilters['sort']>('latest');
  const [verified, setVerified] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [items, setItems] = useState<AdDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.categories(), api.cities()])
      .then(([cats, cts]) => {
        setCategories(cats);
        setCities(cts);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api.searchFeed({
        q: q.trim() || undefined,
        categoryId: categoryId || undefined,
        cityId: cityId || undefined,
        kind,
        sort,
        verified: verified || undefined,
        featured: featured || undefined,
        take: 20,
      });
      setItems(page.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [categoryId, cityId, featured, kind, q, sort, verified]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>{t('search.title')}</Text>
      </View>

      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load()}
        placeholder={t('search.placeholder')}
        placeholderTextColor={colors.gray}
        style={[styles.input, { textAlign }]}
      />

      <Text style={[styles.section, { textAlign }]}>{t('search.filters')}</Text>
      <FilterRow
        label={t('search.sort')}
        options={[
          { label: t('search.sortLatest'), value: 'latest' },
          { label: t('search.sortViews'), value: 'views' },
          { label: t('search.sortFeatured'), value: 'featured' },
        ]}
        value={sort}
        rowDirection={rowDirection}
        onChange={(value) => setSort(value as FeedSearchFilters['sort'])}
      />
      <FilterRow
        label={t('search.kind')}
        options={[
          { label: t('search.kindAll'), value: '' },
          { label: t('search.kindImage'), value: 'image' },
          { label: t('search.kindVideo'), value: 'video' },
        ]}
        value={kind ?? ''}
        rowDirection={rowDirection}
        onChange={(value) => setKind((value || undefined) as FeedSearchFilters['kind'])}
      />
      <FilterRow
        label={t('search.category')}
        options={[
          { label: t('common.all'), value: '' },
          ...categories.slice(0, 8).map((category) => ({
            label: locale === 'ar' ? category.nameAr : category.nameEn,
            value: category.id,
          })),
        ]}
        value={categoryId}
        rowDirection={rowDirection}
        onChange={setCategoryId}
      />
      <FilterRow
        label={t('search.city')}
        options={[
          { label: t('common.all'), value: '' },
          ...cities.slice(0, 8).map((city) => ({
            label: locale === 'ar' ? city.nameAr : city.nameEn,
            value: city.id,
          })),
        ]}
        value={cityId}
        rowDirection={rowDirection}
        onChange={setCityId}
      />
      <View style={[styles.toggleRow, { flexDirection: rowDirection }]}>
        <Toggle label={t('search.verified')} enabled={verified} onPress={() => setVerified((v) => !v)} />
        <Toggle label={t('search.featured')} enabled={featured} onPress={() => setFeatured((v) => !v)} />
        <Pressable style={styles.applyBtn} onPress={() => void load()}>
          <Text style={styles.applyText}>{t('nav.search')}</Text>
        </Pressable>
      </View>

      <Text style={[styles.section, { textAlign }]}>{t('search.results')}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <Pressable style={styles.error} onPress={() => void load()}>
          <Text style={styles.errorTitle}>{t('feed.offlineTitle')}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Text style={styles.retry}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <Text style={[styles.empty, { textAlign }]}>{t('feed.emptyTitle')}</Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.resultRow} onPress={() => router.push(`/ads/${item.id}` as never)}>
            <Text style={[styles.resultTitle, { textAlign }]}>{item.currentRevision?.title}</Text>
            <Text style={[styles.resultMeta, { textAlign }]}>
              {locale === 'ar' ? item.currentRevision?.city?.nameAr : item.currentRevision?.city?.nameEn}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function FilterRow({
  label,
  options,
  value,
  rowDirection,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value?: string;
  rowDirection: 'row' | 'row-reverse';
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={[styles.chips, { flexDirection: rowDirection }]}>
        {options.map((option) => (
          <Pressable
            key={`${label}:${option.value}`}
            style={[styles.chip, value === option.value && styles.chipOn]}
            onPress={() => onChange(option.value)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Toggle({ label, enabled, onPress }: { label: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, enabled && styles.chipOn]} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 18 },
  header: { alignItems: 'center', gap: 12, marginBottom: 14 },
  back: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: colors.black, fontWeight: '800' },
  title: { flex: 1, color: colors.black, fontSize: 26, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    color: colors.black,
    backgroundColor: colors.surface,
  },
  section: { color: colors.black, fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  filterBlock: { gap: 8, marginBottom: 10 },
  filterLabel: { color: colors.gray, fontWeight: '700', textAlign: 'right' },
  chips: { flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.black, fontWeight: '700', fontSize: 12 },
  toggleRow: { flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  toggle: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  applyBtn: {
    marginStart: 'auto',
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  applyText: { color: colors.white, fontWeight: '800' },
  error: { backgroundColor: '#FFF4F4', borderRadius: 14, padding: 14, gap: 4 },
  errorTitle: { color: colors.black, fontWeight: '800', textAlign: 'center' },
  errorBody: { color: colors.gray, textAlign: 'center' },
  retry: { color: colors.black, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  empty: { color: colors.gray, marginVertical: 16 },
  resultRow: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  resultTitle: { color: colors.black, fontWeight: '800', fontSize: 15 },
  resultMeta: { color: colors.gray, marginTop: 4 },
});
