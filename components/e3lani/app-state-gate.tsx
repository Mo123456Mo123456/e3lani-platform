import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";

export function AppStateGate({ children }: { children: ReactNode }) {
  const { ready, loadError, retryLoad, continueWithFreshState } = useE3lani();
  const { locale } = useI18n();

  if (!ready) {
    return (
      <SafeAreaView style={styles.safeArea} accessibilityLiveRegion="polite">
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={BRAND.yellowDark} />
          <Text style={styles.title}>{locale === "ar" ? "جارٍ تجهيز إعلاني" : "Preparing E3lani"}</Text>
          <Text style={styles.body}>
            {locale === "ar" ? "نستعيد بياناتك المحفوظة على هذا الجهاز." : "Restoring data saved on this device."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea} accessibilityLiveRegion="assertive">
        <View style={styles.stateCard}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="sync-problem" size={34} color={BRAND.black} />
          </View>
          <Text style={styles.title}>{locale === "ar" ? "تعذر استعادة البيانات" : "Could not restore data"}</Text>
          <Text style={styles.body}>
            {locale === "ar"
              ? "تحقق من توفر مساحة التخزين ثم أعد المحاولة، أو تابع ببيانات محلية جديدة."
              : "Check available device storage and try again, or continue with fresh local data."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === "ar" ? "إعادة محاولة استعادة البيانات" : "Retry restoring data"}
            onPress={retryLoad}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="refresh" size={21} color={BRAND.black} />
            <Text style={styles.primaryLabel}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === "ar" ? "المتابعة ببيانات محلية جديدة" : "Continue with fresh local data"}
            onPress={continueWithFreshState}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>{locale === "ar" ? "المتابعة ببيانات جديدة" : "Continue with fresh data"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateCard: {
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 28,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 18,
    color: BRAND.black,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: BRAND.yellow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: {
    color: BRAND.black,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  secondaryButton: {
    width: "100%",
    minHeight: 48,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    color: BRAND.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
});
