import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { normalizeLaunchPolicy } from "@/lib/launch-policy";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useProductData } from "@/lib/use-product-data";
import { getVisitorToken, setVisitorToken } from "@/lib/_core/auth";

function LaunchPolicyHydrator() {
  const { hydrateLaunchPolicy } = useE3lani();
  const productData = useProductData();

  useEffect(() => {
    if (productData.launchPolicy) {
      hydrateLaunchPolicy(normalizeLaunchPolicy(productData.launchPolicy));
    }
  }, [hydrateLaunchPolicy, productData.launchPolicy]);

  return null;
}

function LoadingState({ locale, label }: { locale: "ar" | "en"; label?: string }) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.04, duration: 650, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, scale]);

  return (
    <SafeAreaView style={styles.safeArea} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.logo, { opacity, transform: [{ scale }] }]}>
        <Text style={styles.logoLetter}>إ</Text>
      </Animated.View>
      <Text style={styles.brand}>إعلاني | E3lani</Text>
      <ActivityIndicator size="small" color={BRAND.yellowDark} />
      <Text style={styles.body}>
        {label ?? (locale === "ar" ? "ندخلك مباشرة كزائر" : "Opening directly as a guest")}
      </Text>
    </SafeAreaView>
  );
}

function VisitorIdentityBoundary({ children }: { children: ReactNode }) {
  const store = useE3lani();
  const { locale } = useI18n();
  const ensure = trpc.visitor.ensure.useMutation();
  const upsert = trpc.visitor.upsert.useMutation();
  const ensureVisitor = ensure.mutateAsync;
  const upsertVisitor = upsert.mutate;
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    if (!store.ready || store.loadError || identityReady) return;

    let active = true;
    const openGuestFallback = setTimeout(() => {
      if (active) setIdentityReady(true);
    }, 2500);

    void (async () => {
      try {
        const current = await getVisitorToken();
        const result = await ensureVisitor();
        if (result.token !== current) await setVisitorToken(result.token);
      } catch (error) {
        console.warn("[Visitor] Identity initialization failed; continuing in browse-only guest mode", error);
      } finally {
        clearTimeout(openGuestFallback);
        if (active) setIdentityReady(true);
      }
    })();

    return () => {
      active = false;
      clearTimeout(openGuestFallback);
    };
  }, [ensureVisitor, identityReady, store.loadError, store.ready]);

  useEffect(() => {
    if (!store.ready || store.loadError || !identityReady) return;

    const timer = setTimeout(() => {
      upsertVisitor({
        prefs: {
          accountCountry: store.accountCountry,
          marketCode: String(store.marketCode),
          forceCountryFilter: store.forceCountryFilter,
          categoryFilter: store.categoryFilter,
          countryGateCompleted: true,
          blockedOwners: store.blockedOwners.slice(0, 500),
        },
        savedAdPublicIds: store.savedIds.slice(0, 200),
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [
    identityReady,
    store.accountCountry,
    store.blockedOwners,
    store.categoryFilter,
    store.forceCountryFilter,
    store.loadError,
    store.marketCode,
    store.ready,
    store.savedIds,
    upsertVisitor,
  ]);

  if (!identityReady) return <LoadingState locale={locale} />;
  return <>{children}</>;
}

export function AppStateGate({ children }: { children: ReactNode }) {
  const {
    ready,
    loadError,
    retryLoad,
    continueWithFreshState,
    countryGateCompleted,
    accountCountry,
    completeCountryGate,
  } = useE3lani();
  const { locale } = useI18n();

  useEffect(() => {
    if (!ready || loadError || countryGateCompleted) return;
    completeCountryGate(accountCountry || "SA");
  }, [accountCountry, completeCountryGate, countryGateCompleted, loadError, ready]);

  if (!ready) {
    return (
      <LoadingState
        locale={locale}
        label={locale === "ar" ? "نستعيد بياناتك ونفتح التطبيق مباشرة" : "Restoring your data and opening the app"}
      />
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
              ? "تحقق من مساحة التخزين ثم أعد المحاولة، أو تابع ببيانات محلية جديدة."
              : "Check device storage and retry, or continue with fresh local data."}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retryLoad}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="refresh" size={21} color={BRAND.black} />
            <Text style={styles.primaryLabel}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={continueWithFreshState}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>
              {locale === "ar" ? "المتابعة ببيانات جديدة" : "Continue with fresh data"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <VisitorIdentityBoundary>
      <LaunchPolicyHydrator />
      {children}
    </VisitorIdentityBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  logoLetter: { color: BRAND.black, fontSize: 57, lineHeight: 70, fontWeight: "900" },
  brand: {
    marginTop: 16,
    marginBottom: 14,
    color: BRAND.black,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
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
  body: { marginTop: 8, color: BRAND.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
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
  primaryLabel: { color: BRAND.black, fontSize: 15, lineHeight: 21, fontWeight: "900" },
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
  secondaryLabel: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
