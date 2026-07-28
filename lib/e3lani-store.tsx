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
  extendAdPeriod,
  moderatePendingAd,
  republishExpiredAd,
  seedAds,
  seedBrand,
  type Ad,
  type AdContact,
  type AdMedia,
  type AdStatus,
  type AuditLog,
  type BrandProfile,
  type Invoice,
  type Metrics,
  type NotificationItem,
  type Order,
  type PromotionCode,
  type ReportItem,
  type UserProfile,
} from "./e3lani-data";
import {
  DEFAULT_FEED_ACCESS_MODE,
  initialAdStatusForMode,
  requiresPaymentForPublishing,
  resolveFeedAccessMode,
  type FeedAccessMode,
} from "../shared/feed-access";
import {
  DEFAULT_PUBLIC_USER_ROLE,
  stripRoleFromPublicProfile,
} from "../shared/user-role-policy";

const DEMO_DATA_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_DATA === "true";
const PREFERENCES_KEY = "e3lani.preferences.v2";
const LEGACY_STORE_KEY = "e3lani.store.v1";

type PublicUserProfileInput = Omit<Partial<UserProfile>, "role">;
type LocalPreferences = { blockedOwners: string[] };

type NewAd = {
  title: string;
  description?: string;
  categoryId: string;
  cityId: string;
  media: AdMedia[];
  contacts: AdContact[];
  promotions: PromotionCode[];
};

type State = {
  ready: boolean;
  loadError: "storage_load_failed" | null;
  user: UserProfile | null;
  brand: BrandProfile | null;
  ads: Ad[];
  savedIds: string[];
  metrics: Record<string, Metrics>;
  notifications: NotificationItem[];
  reports: ReportItem[];
  orders: Order[];
  invoices: Invoice[];
  audit: AuditLog[];
  blockedOwners: string[];
};

type Value = State & {
  login: (profile?: PublicUserProfileInput) => void;
  logout: () => void;
  updateProfile: (data: PublicUserProfileInput) => void;
  upsertBrand: (data: Partial<BrandProfile>) => void;
  requestVerification: () => void;
  createAd: (data: NewAd, feedAccessMode?: FeedAccessMode) => Ad;
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
const demoMetrics: Record<string, Metrics> = {
  AD10001: { impressions: 128547, views: 128547, saves: 1926, shares: 3842, contacts: 1243 },
  AD10002: { impressions: 26480, views: 21970, saves: 318, shares: 229, contacts: 156 },
};

function initialState(): State {
  return {
    ready: false,
    loadError: null,
    user: null,
    brand: DEMO_DATA_ENABLED ? seedBrand : null,
    ads: DEMO_DATA_ENABLED ? seedAds : [],
    savedIds: [],
    blockedOwners: [],
    metrics: DEMO_DATA_ENABLED ? demoMetrics : {},
    notifications: DEMO_DATA_ENABLED
      ? [
          {
            id: "N1",
            title: "وضع العرض التجريبي",
            body: "هذه بيانات عرض محلية وليست بيانات إنتاج.",
            read: false,
            createdAt: new Date().toISOString(),
            kind: "system",
          },
        ]
      : [],
    reports: [],
    orders: [],
    invoices: [],
    audit: [],
  };
}

const C = createContext<Value | null>(null);
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export function E3laniProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => initialState());

  const loadStoredState = useCallback(async () => {
    setState((current) => ({ ...current, ready: false, loadError: null }));
    try {
      const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
      const preferences = raw ? (JSON.parse(raw) as Partial<LocalPreferences>) : {};
      const blockedOwners = Array.isArray(preferences.blockedOwners)
        ? preferences.blockedOwners.filter((value): value is string => typeof value === "string")
        : [];

      await AsyncStorage.removeItem(LEGACY_STORE_KEY).catch(() => undefined);
      setState({ ...initialState(), blockedOwners, ready: true, loadError: null });
    } catch {
      setState({ ...initialState(), ready: true, loadError: "storage_load_failed" });
    }
  }, []);

  useEffect(() => {
    void loadStoredState();
  }, [loadStoredState]);

  useEffect(() => {
    if (!state.ready || state.loadError) return;
    const preferences: LocalPreferences = { blockedOwners: state.blockedOwners };
    AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)).catch(() => undefined);
  }, [state.blockedOwners, state.loadError, state.ready]);

  const value = useMemo<Value>(
    () => ({
      ...state,
      login: (profile) => {
        const safeProfile = stripRoleFromPublicProfile(profile);
        setState((current) => ({
          ...current,
          user: {
            id: "DEMO_USER",
            name: "مستخدم عرض تجريبي",
            phone: "+966500000000",
            email: "demo@e3lani.local",
            cityId: "riyadh",
            accountType: "viewer",
            ...safeProfile,
            role: DEFAULT_PUBLIC_USER_ROLE,
          },
        }));
      },
      logout: () => setState((current) => ({ ...current, user: null })),
      updateProfile: (data) => {
        const safeProfile = stripRoleFromPublicProfile(data);
        setState((current) => ({
          ...current,
          user: current.user
            ? { ...current.user, ...safeProfile, role: DEFAULT_PUBLIC_USER_ROLE }
            : current.user,
        }));
      },
      upsertBrand: (data) =>
        setState((current) => ({
          ...current,
          brand: current.brand
            ? { ...current.brand, ...data }
            : { ...seedBrand, ownerId: current.user?.id ?? "DEMO_USER", ...data },
        })),
      requestVerification: () =>
        setState((current) => ({
          ...current,
          brand: current.brand ? { ...current.brand, verificationStatus: "pending" } : current.brand,
        })),
      createAd: (data, requestedMode = DEFAULT_FEED_ACCESS_MODE) => {
        if (!DEMO_DATA_ENABLED) {
          throw new Error("LOCAL_AD_CREATION_DISABLED");
        }
        const feedAccessMode = resolveFeedAccessMode(requestedMode);
        const paidPublishing = requiresPaymentForPublishing(feedAccessMode);
        const effectivePromotions = paidPublishing ? data.promotions : [];
        const ad: Ad = {
          id: uid("DEMO_AD"),
          ownerId: state.user?.id ?? "DEMO_USER",
          brandId: state.brand?.id,
          ...data,
          description: data.description?.trim() ?? "",
          promotions: effectivePromotions,
          status: initialAdStatusForMode(feedAccessMode),
          revision: 1,
          verified: Boolean(state.brand?.verified),
          featured: effectivePromotions.length > 0,
          sponsored: effectivePromotions.length > 0,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          ads: [ad, ...current.ads],
          metrics: { ...current.metrics, [ad.id]: { ...zero } },
        }));
        return ad;
      },
      toggleSave: (id) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => {
          const has = current.savedIds.includes(id);
          const metrics = current.metrics[id] ?? zero;
          return {
            ...current,
            savedIds: has
              ? current.savedIds.filter((savedId) => savedId !== id)
              : [...current.savedIds, id],
            metrics: {
              ...current.metrics,
              [id]: { ...metrics, saves: Math.max(0, metrics.saves + (has ? -1 : 1)) },
            },
          };
        });
      },
      recordMetric: (id, key) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => {
          const metrics = current.metrics[id] ?? zero;
          return {
            ...current,
            metrics: { ...current.metrics, [id]: { ...metrics, [key]: metrics[key] + 1 } },
          };
        });
      },
      submitReport: (id, reason, details) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => ({
          ...current,
          reports: [
            {
              id: uid("DEMO_REPORT"),
              adId: id,
              reason,
              details,
              status: "open",
              createdAt: new Date().toISOString(),
            },
            ...current.reports,
          ],
        }));
      },
      toggleBlock: (id) =>
        setState((current) => ({
          ...current,
          blockedOwners: current.blockedOwners.includes(id)
            ? current.blockedOwners.filter((ownerId) => ownerId !== id)
            : [...current.blockedOwners, id],
        })),
      setAdStatus: (id, status, reason = "إجراء تجريبي") => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => ({
          ...current,
          ads: current.ads.map((ad) => (ad.id === id ? { ...ad, status } : ad)),
          audit: [
            {
              id: uid("DEMO_AUDIT"),
              actor: current.user?.name ?? "وضع العرض",
              action: `ad.${status}`,
              target: id,
              reason,
              createdAt: new Date().toISOString(),
            },
            ...current.audit,
          ],
        }));
      },
      extendAd: (id) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => ({
          ...current,
          ads: current.ads.map((ad) => (ad.id === id ? extendAdPeriod(ad) : ad)),
        }));
      },
      republishAd: (id) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => {
          const now = new Date().toISOString();
          return {
            ...current,
            ads: current.ads.map((ad) => (ad.id === id ? republishExpiredAd(ad, now) : ad)),
          };
        });
      },
      moderateAd: (id, decision, reason) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => {
          const now = new Date().toISOString();
          const target = current.ads.find((ad) => ad.id === id);
          if (!target || target.status !== "pending_review") return current;
          return {
            ...current,
            ads: current.ads.map((ad) => (ad.id === id ? moderatePendingAd(ad, decision, now) : ad)),
            audit: [
              {
                id: uid("DEMO_AUDIT"),
                actor: current.user?.name ?? "مراجع العرض",
                action: `moderation.${decision}`,
                target: id,
                reason,
                createdAt: now,
              },
              ...current.audit,
            ],
          };
        });
      },
      markNotificationsRead: () =>
        setState((current) => ({
          ...current,
          notifications: current.notifications.map((notification) => ({ ...notification, read: true })),
        })),
      resolveReport: (id, resolution) => {
        if (!DEMO_DATA_ENABLED) return;
        setState((current) => ({
          ...current,
          reports: current.reports.map((report) =>
            report.id === id ? { ...report, status: "resolved" } : report,
          ),
          audit: [
            {
              id: uid("DEMO_AUDIT"),
              actor: current.user?.name ?? "دعم العرض",
              action: "report.resolve",
              target: id,
              reason: resolution,
              createdAt: new Date().toISOString(),
            },
            ...current.audit,
          ],
        }));
      },
      retryLoad: () => {
        void loadStoredState();
      },
      continueWithFreshState: () => setState({ ...initialState(), ready: true, loadError: null }),
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
