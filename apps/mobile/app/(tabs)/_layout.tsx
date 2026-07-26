import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNav } from '../../src/components/BottomNav';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <Slot />
        <BottomNav />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
});
