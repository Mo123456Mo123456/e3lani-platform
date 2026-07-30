import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager, Platform } from "react-native";

import { api, clearSession, refreshSession, storeSession } from "./api";

type Locale = "ar" | "en";
type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<{ verificationToken?: string }>;
  register: (input: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
};
type LocaleContextValue = {
  locale: Locale;
  rtl: boolean;
  setLocale: (locale: Locale) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [locale, updateLocale] = useState<Locale>("ar");

  useEffect(() => {
    Promise.all([
      refreshSession().then(setAuthenticated),
      AsyncStorage.getItem("e3lani.locale").then((value) => {
        if (value === "ar" || value === "en") updateLocale(value);
      }),
    ]).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    I18nManager.allowRTL(true);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const auth = useMemo<AuthContextValue>(
    () => ({
      ready,
      authenticated,
      requestOtp: async (phone) => {
        await api("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) });
      },
      verifyOtp: async (phone, code) => {
        const result = await api<{
          registrationRequired: boolean;
          verificationToken?: string;
          accessToken?: string;
          refreshToken?: string;
        }>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
        if (result.accessToken && result.refreshToken) {
          await storeSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
          setAuthenticated(true);
        }
        return { verificationToken: result.verificationToken };
      },
      register: async (input) => {
        const session = await api<{ accessToken: string; refreshToken: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(input),
        });
        await storeSession(session);
        setAuthenticated(true);
      },
      logout: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        await clearSession();
        setAuthenticated(false);
      },
    }),
    [authenticated, ready],
  );
  const localization = useMemo<LocaleContextValue>(
    () => ({
      locale,
      rtl: locale === "ar",
      setLocale: (value) => {
        updateLocale(value);
        void AsyncStorage.setItem("e3lani.locale", value);
      },
    }),
    [locale],
  );
  return (
    <AuthContext.Provider value={auth}>
      <LocaleContext.Provider value={localization}>{children}</LocaleContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthContext missing");
  return value;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("LocaleContext missing");
  return value;
}
