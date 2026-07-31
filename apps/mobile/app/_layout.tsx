import * as React from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/lib/auth-context';
import { theme } from '@/lib/theme';

// واجهة عربية RTL افتراضيًا
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {
  // بعض المنصات (الويب) لا تدعم التبديل وقت التشغيل
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.white },
              animation: 'slide_from_left',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="report" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
