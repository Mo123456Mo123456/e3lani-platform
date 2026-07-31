import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CategoryDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Loading } from '@/components/ui';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = React.useState<CategoryDto[] | null>(null);

  React.useEffect(() => {
    void api<CategoryDto[]>('/categories?withCounts=true')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  if (!categories) return <Loading />;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ padding: 12, gap: 10 }}
    >
      <Text style={theme.text.title}>الأقسام</Text>
      {categories.map((category) => (
        <View key={category.id} style={styles.card}>
          <Pressable
            style={styles.cardHeader}
            onPress={() => router.push(`/search?categoryId=${category.id}`)}
          >
            <Text style={styles.categoryName}>{category.nameAr}</Text>
            <Text style={styles.count}>{category.adsCount ?? 0} إعلان</Text>
          </Pressable>
          <View style={styles.chips}>
            {category.children?.map((child) => (
              <Pressable
                key={child.id}
                style={styles.chip}
                onPress={() =>
                  router.push(`/search?categoryId=${category.id}&subcategoryId=${child.id}`)
                }
              >
                <Text style={styles.chipText}>{child.nameAr}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  count: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, color: theme.colors.inkMuted, fontWeight: '600' },
});
