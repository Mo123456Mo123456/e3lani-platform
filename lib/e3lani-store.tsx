import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LAUNCH_MODE,
  extendAdPeriod,
  moderatePendingAd,
  republishExpiredAd,
  seedBrand,
  type Ad,
  type AdStatus,
  type AuditLog,
  type BrandProfile,
  type Invoice,
  type LaunchMode,
  type Metrics,
  type NotificationItem,
  type Order,
  type ProfilePost,
  type ReportItem,
  type UserProfile,
} from "./e3lani-data";
import { GLOBAL_MARKET, type MarketCode } from "./feed/rank";
import { DEFAULT_LAUNCH_POLICY, type LaunchPolicy } from "./launch-policy";

type Prefs = {
  accountCountry: string;
  marketCode: MarketCode;
  forceCountryFilter: boolean;
  categoryFilter: string;
  countryGateCompleted: boolean;
  blockedOwners: string[];
  launchMode: LaunchMode;
  launchPolicy: LaunchPolicy;
};

type State = Prefs & {
  ready: boolean;
  loadError: "storage_load_failed" | null;
  user: UserProfile | null;
  brand: BrandProfile | null;
  /** Cache only — production source is the server feed. */
  ads: Ad[];
  posts: ProfilePost[];
  savedIds: string[];
  metrics: Record<string, Metrics>;
  notifications: NotificationItem[];
  reports: ReportItem[];
  orders: Order[];
  invoices: Invoice[];
  audit: AuditLog[];
};

type Value = State & {
  login: (profile?: Partial<UserProfile>) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  upsertBrand: (data: Partial<BrandProfile>) => void;
  requestVerification: () => void;
  setServerAds: (ads: Ad[]) => void;
  upsertServerAd: (ad: Ad) => void;
  setSavedIds: (ids: string[]) => void;
  setMarket: (code: MarketCode, forceFilter?: boolean) => void;
  setAccountCountry: (code: string) => void;
  completeCountryGate: (code: string) => void;
  setLaunchPolicy: (policy: Partial<LaunchPolicy>) => void;
  hydrateLaunchPolicy: (policy: Partial<LaunchPolicy>) => void;
  setCategoryFilter: (categoryId: string) => void;
  toggleSave: (id: string) => void;
  recordMetric: (id: string, key: keyof Metrics) => void;
  submitReport: (id: string, reason: string, details?: string) => void;
  toggleBlock: (id: string) => void;
  setAdStatus: (id: string, status: AdStatus, reason?: string) => void;
  extendAd: (id: string) => void;
  republishAd: (id: string) => void;
  moderateAd: (
    id: string,
    decision: "approved" | "changes_requested" | "rejected",
    reason: string,
  ) => void;
  markNotificationsRead: () => void;
  resolveReport: (id: string, resolution: string) => void;
  retryLoad: () => void;
  continueWithFreshState: () => void;
};

const zero: Metrics = { impressions: 0, views: 0, saves: 0, shares: 0, contacts: 0 };
const PREFS_KEY = "e3lani.prefs.v2";
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const defaultPrefs: Prefs = {
  accountCountry: "SA",
  marketCode: GLOBAL_MARKET,
  forceCountryFilter: false,
  categoryFilter: "",
  countryGateCompleted: false,
  blockedOwners: [],
  launchMode: DEFAULT_LAUNCH_MODE,
  launchPolicy: DEFAULT_LAUNCH_POLICY,
};

const initial: State = {
  ready: false,
  loadError: null,
  user: null,
  brand: seedBrand,
  ads: [],
  posts: [],
  savedIds: [],
  metrics: {},
  notifications: [
    {
      id: "N1",
      title: "مرحبًا بك في إعلاني",
      body: "النشر مجاني حاليًا بمناسبة إطلاق إعلاني. الموجز عالمي ويمكنك اختيار أي دولة.",
      read: false,
      createdAt: new Date().toISOString(),
      kind: "system",
    },
  ],
  reports: [],
  orders: [],
  invoices: [],
  audit: [],
  ...defaultPrefs,
};

const C = createContext<Value | null>(null);

function pickPrefs(state: State): Prefs {
  return {
    accountCountry: state.accountCountry,
    marketCode: state.marketCode,
    forceCountryFilter: state.forceCountryFilter,
    categoryFilter: state.categoryFilter,
    countryGateCompleted: state.countryGateCompleted,
    blockedOwners: state.blockedOwners,
    launchMode: state.launchMode,
    launchPolicy: state.launchPolicy,
  };
}

export function E3laniProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);

  const loadStoredState = useCallback(async () => {
    setState((current) => ({ ...current, ready: false, loadError: null }));
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      const stored = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
      // Migrate away from legacy full-store key if present (prefs only).
      const legacy = await AsyncStorage.getItem("e3lani.store.v1");
      let legacyPrefs: Partial<Prefs> = {};
      if (!raw && legacy) {
        try {
          const parsed = JSON.parse(legacy) as Partial<Prefs>;
          legacyPrefs = {
            accountCountry: parsed.accountCountry,
            marketCode: parsed.marketCode ?? GLOBAL_MARKET,
            forceCountryFilter: parsed.forceCountryFilter,
            categoryFilter: parsed.categoryFilter,
            countryGateCompleted: Boolean(parsed.accountCountry),
            blockedOwners: parsed.blockedOwners,
            launchMode: parsed.launchMode,
            launchPolicy: parsed.launchPolicy,
          };
        } catch {
          legacyPrefs = {};
        }
      }
      setState({
        ...initial,
        ...defaultPrefs,
        ...legacyPrefs,
        ...stored,
        marketCode: stored.marketCode ?? legacyPrefs.marketCode ?? GLOBAL_MARKET,
        ads: [],
        ready: true,
        loadError: null,
      });
    } catch {
      setState((current) => ({ ...current, ready: true, loadError: "storage_load_failed" }));
    }
  }, []);

  useEffect(() => {
    void loadStoredState();
  }, [loadStoredState]);

  useEffect(() => {
    if (!state.ready || state.loadError) return;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(pickPrefs(state))).catch(() => undefined);
  }, [state]);

  const value = useMemo<Value>(
    () => ({
      ...state,
      login: (profile) =>
        setState((current) => {
          const countryCode = profile?.countryCode ?? current.accountCountry ?? "SA";
          return {
            ...current,
            accountCountry: countryCode,
            countryGateCompleted: true,
            user: {
              id: profile?.id ?? "U1",
              name: profile?.name ?? "معلن إعلاني",
              phone: profile?.phone ?? "",
              email: profile?.email,
              cityId: profile?.cityId ?? "riyadh",
              countryCode,
              accountType: profile?.accountType ?? "advertiser",
              role: profile?.role ?? "user",
              ...profile,
            },
          };
        }),
      logout: () => setState((current) => ({ ...current, user: null })),
      updateProfile: (data) =>
        setState((current) => ({
          ...current,
          user: current.user ? { ...current.user, ...data } : current.user,
        })),
      upsertBrand: (data) =>
        setState((current) => ({
          ...current,
          brand: current.brand
            ? { ...current.brand, ...data }
            : { ...seedBrand, ownerId: current.user?.id ?? "U1", ...data },
        })),
      requestVerification: () =>
        setState((current) => ({
          ...current,
          brand: current.brand ? { ...current.brand, verificationStatus: "pending" } : current.brand,
        })),
      setServerAds: (ads) => setState((current) => ({ ...current, ads })),
      upsertServerAd: (ad) =>
        setState((current) => ({
          ...current,
          ads: [ad, ...current.ads.filter((item) => item.id !== ad.id)],
        })),
      setSavedIds: (ids) => setState((current) => ({ ...current, savedIds: ids })),
      setMarket: (code, forceFilter = code !== GLOBAL_MARKET && code !== "ALL") =>
        setState((current) => ({
          ...current,
          marketCode: code,
          forceCountryFilter: code === GLOBAL_MARKET || code === "ALL" ? false : forceFilter,
        })),
      setAccountCountry: (code) =>
        setState((current) => ({
          ...current,
          accountCountry: code,
          user: current.user ? { ...current.user, countryCode: code } : current.user,
        })),
      completeCountryGate: (code) =>
        setState((current) => ({
          ...current,
          accountCountry: code,
          countryGateCompleted: true,
          marketCode: GLOBAL_MARKET,
          forceCountryFilter: false,
          user: current.user ? { ...current.user, countryCode: code } : current.user,
        })),
      setLaunchPolicy: (policy) =>
        setState((current) => ({
          ...current,
          launchPolicy: { ...current.launchPolicy, ...policy },
        })),
      hydrateLaunchPolicy: (policy) =>
        setState((current) => ({
          ...current,
          launchPolicy: { ...DEFAULT_LAUNCH_POLICY, ...current.launchPolicy, ...policy },
        })),
      setCategoryFilter: (categoryId) =>
        setState((current) => ({ ...current, categoryFilter: categoryId })),
      toggleSave: (id) =>
        setState((current) => {
          const has = current.savedIds.includes(id);
          return {
            ...current,
            savedIds: has
              ? current.savedIds.filter((savedId) => savedId !== id)
              : [...current.savedIds, id],
          };
        }),
      recordMetric: (id, key) =>
        setState((current) => {
          const metrics = current.metrics[id] ?? zero;
          return {
            ...current,
            metrics: { ...current.metrics, [id]: { ...metrics, [key]: metrics[key] + 1 } },
          };
        }),
      submitReport: (id, reason, details) =>
        setState((current) => ({
          ...current,
          reports: [
            {
              id: uid("R"),
              adId: id,
              reason,
              details,
              status: "open",
              createdAt: new Date().toISOString(),
            },
            ...current.reports,
          ],
        })),
      toggleBlock: (id) =>
        setState((current) => ({
          ...current,
          blockedOwners: current.blockedOwners.includes(id)
            ? current.blockedOwners.filter((ownerId) => ownerId !== id)
            : [...current.blockedOwners, id],
        })),
      setAdStatus: (id, status, reason = "إجراء إداري") =>
        setState((current) => ({
          ...current,
          ads: current.ads.map((ad) => (ad.id === id ? { ...ad, status } : ad)),
          audit: [
            {
              id: uid("A"),
              actor: current.user?.name ?? "النظام",
              action: `ad.${status}`,
              target: id,
              reason,
              createdAt: new Date().toISOString(),
            },
            ...current.audit,
          ],
        })),
      extendAd: (id) =>
        setState((current) => ({
          ...current,
          ads: current.ads.map((ad) => (ad.id === id ? extendAdPeriod(ad) : ad)),
        })),
      republishAd: (id) =>
        setState((current) => {
          const now = new Date().toISOString();
          return {
            ...current,
            ads: current.ads.map((ad) => (ad.id === id ? republishExpiredAd(ad, now) : ad)),
          };
        }),
      moderateAd: (id, decision, reason) =>
        setState((current) => {
          const now = new Date().toISOString();
          const target = current.ads.find((ad) => ad.id === id);
          if (!target || target.status !== "pending_review") return current;
          return {
            ...current,
            ads: current.ads.map((ad) => (ad.id === id ? moderatePendingAd(ad, decision, now) : ad)),
            audit: [
              {
                id: uid("A"),
                actor: current.user?.name ?? "المراجع",
                action: `moderation.${decision}`,
                target: id,
                reason,
                createdAt: now,
              },
              ...current.audit,
            ],
          };
        }),
      markNotificationsRead: () =>
        setState((current) => ({
          ...current,
          notifications: current.notifications.map((notification) => ({
            ...notification,
            read: true,
          })),
        })),
      resolveReport: (id, resolution) =>
        setState((current) => ({
          ...current,
          reports: current.reports.map((report) =>
            report.id === id ? { ...report, status: "resolved" } : report,
          ),
          audit: [
            {
              id: uid("A"),
              actor: current.user?.name ?? "الدعم",
              action: "report.resolve",
              target: id,
              reason: resolution,
              createdAt: new Date().toISOString(),
            },
            ...current.audit,
          ],
        })),
      retryLoad: () => {
        void loadStoredState();
      },
      continueWithFreshState: () => setState({ ...initial, ready: true, loadError: null }),
    }),
    [loadStoredState, state],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useE3lani() {
  const value = useContext(C);
  if (!value) throw new Error("E3laniProvider missing");
  return value;
}
