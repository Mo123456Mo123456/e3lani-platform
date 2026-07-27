import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { LocaleProvider } from '../src/lib/locale';
import { colors } from '../src/theme';

I18nManager.allowRTL(true);

export default function RootLayout() {
  return (
    <LocaleProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.black },
          animation: 'fade',
        }}
      />
    </LocaleProvider>
  );
}
