import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@e3lani/i18n';
import { colors } from '../../src/theme';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>{t('ar', 'nav.saved')}</Text>
      <Text style={styles.empty}>لا توجد إعلانات محفوظة بعد.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  title: { color: colors.black, fontSize: 28, fontWeight: '800', textAlign: 'right' },
  empty: { marginTop: 24, color: colors.gray, textAlign: 'right', fontSize: 16 },
});
