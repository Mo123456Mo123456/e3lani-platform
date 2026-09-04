import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { getDeviceToken } from '../lib/api';
import { db } from '../lib/db';
import { C, enforceRtl } from '../lib/theme';

enforceRtl();
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [activated, setActivated] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      await db(); // إنشاء قاعدة البيانات المحلية قبل أي شاشة
      const token = await getDeviceToken();
      setActivated(Boolean(token));
      setReady(true);
      await SplashScreen.hideAsync();
    })().catch(async () => {
      setReady(true);
      await SplashScreen.hideAsync();
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onActivate = segments[0] === 'activate';
    // جهاز غير مُفعَّل → شاشة التفعيل، ومُفعَّل → شاشة التشغيل مباشرة (بلا تسجيل دخول يومي)
    if (!activated && !onActivate) router.replace('/activate');
    if (activated && onActivate) router.replace('/');
  }, [ready, activated, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={C.primary} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: 'رجوع',
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="activate" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: 'مسح رمز الحاوية' }} />
        <Stack.Screen name="history" options={{ title: 'سجل اليوم' }} />
      </Stack>
    </>
  );
}
