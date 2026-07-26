import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { colors } from '../src/theme';

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.black },
          animation: 'fade',
        }}
      />
    </>
  );
}
