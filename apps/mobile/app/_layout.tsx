import * as React from 'react';
import { I18nManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { AnimatedSplash } from '@/components/animated-splash';
import { theme } from '@/lib/theme';

// واجهة عربية RTL افتراضيًا
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {
  // بعض المنصات (الويب) لا تدعم التبديل وقت التشغيل
}

// نُبقي شاشة النظام ظاهرة حتى ترسم شاشتنا المتحركة، فلا يظهر أي وميض أبيض بينهما
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * جذر التطبيق.
 *
 * تسلسل الإقلاع: شاشة النظام الصفراء ← الشاشة المتحركة بنفس الخلفية
 * ← الموجز العمودي مباشرة. الزائر يتصفح فورًا بلا أي بوابة تسجيل دخول.
 */
function AppShell() {
  const { loading } = useAuth();
  const [splashVisible, setSplashVisible] = React.useState(true);

  // بمجرد رسم أول إطار نُخفي شاشة النظام، فتتسلّم شاشتنا المتحركة بسلاسة
  const onRootLayout = React.useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }} onLayout={onRootLayout}>
      <StatusBar style={splashVisible ? 'dark' : 'dark'} />

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

      {splashVisible ? (
        <AnimatedSplash isReady={!loading} onFinish={() => setSplashVisible(false)} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
