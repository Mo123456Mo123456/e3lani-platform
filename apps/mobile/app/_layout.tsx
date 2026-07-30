import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

I18nManager.allowRTL(true);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerBackTitle: "رجوع", headerTitleAlign: "center" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "تسجيل الدخول", presentation: "modal" }} />
        <Stack.Screen name="ad/[id]" options={{ title: "تفاصيل الإعلان" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
