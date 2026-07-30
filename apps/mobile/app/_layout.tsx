import { Stack } from "expo-router";
import { I18nManager } from "react-native";
import { StatusBar } from "expo-status-bar";

I18nManager.allowRTL(true);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
