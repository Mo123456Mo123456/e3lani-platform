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

type NewAd = {
  title: string;
  description: string;
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
  login: (profile?: Partial<UserProfile>) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  upsertBrand: (data: Partial<BrandProfile>) => void;
  requestVerification: () => void;
  createAd: (data: NewAd) => Ad;
  publishFreeAd: (data: NewAd) => Ad;
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

const zero: Metrics = {
  impressions: 0,
  views: 0,
  saves: 0,
  shares: 0,
  contacts: 0,
};

const initial: State = {
  ready: false,
  loadError: null,
  user: null,
  brand: seedBrand,
  ads: seedAds,
  savedIds: [],
  blockedOwners: [],
  metrics: {
    AD10001: {
      impressions: 128547,
      views: 128547,
      saves: 1926,
      shares: 3842,
      contacts: 1243,
    },
    AD10002: {
      impressions: 36240,
      views: 36240,
      saves: 618,
      shares: 329,
      contacts: 256,
    },
    AD10003: {
      impressions: 24810,
      views: 21874,
      saves: 284,
      shares: 192,
      contacts: 103,
    },
  },
  notifications: [
    {
      id: "N1",
      title: "مرحبًا بك في إعلاني",
      body: "اكتشف الإعلانات المرئية أو ابدأ نشر إعلانك.",
      read: false,
      createdAt: new Date().toISOString(),
      kind: "system",
    },
  ],
  reports: [],
  orders: [],
  invoices: [],
  audit: [],
};

const C = createContext<Value | null>(null);
const KEY = "e3lani.store.v1";
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export function E3laniProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);

  const loadStoredState = useCallback(async () => {
    setState((current) => ({ ...current, ready: false, loadError: null }));
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const stored = raw ? (JSON.parse(raw) as Partial<State>) : {};
      setState({ ...initial, ...stored, ready: true, loadError: null });
    } catch {
      setState((current) => ({
        ...current,
        ready: true,
        loadError: "storage_load_failed",
      }));
    }
  }, []);

  useEffect(() => {
    void loadStoredState();
  }, [loadStoredState]);

  useEffect(() => {
    if (!state.ready || state.loadError) return;
    const persisted: Partial<State> = { ...state };
    delete persisted.ready;
    delete persisted.loadError;
    AsyncStorage.setItem(KEY, JSON.stringify(persisted)).catch(() => undefined);
  }, [state]);

  const value = useMemo<Value>(
    () => ({
      ...state,
      login: (profile) =>
        setState((current) => ({
          ...current,
          user: {
            id: "U1",
            name: "معلن إعلاني",
            phone: "+966500000000",
            email: "owner@e3lani.sa",
            cityId: "riyadh",
            accountType: "brand",
            role: "owner",
            ...profile,
          },
        })),
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
          brand: current.brand
            ? { ...current.brand, verificationStatus: "pending" }
            : current.brand,
          notifications: [
            {
              id: uid("N"),
              title: "تم استلام طلب التوثيق",
              body: "سيتم مراجعته يدويًا.",
              read: false,
              createdAt: new Date().toISOString(),
              kind: "review",
            },
            ...current.notifications,
          ],
        })),
      createAd: (data) => {
        const ad: Ad = {
          id: uid("AD"),
          ownerId: state.user?.id ?? "U1",
          ownerName: state.brand?.name ?? state.user?.name,
          countryCode: "SA",
          brandId: state.brand?.id,
          ...data,
          status: "awaiting_payment",
          revision: 1,
          verified: Boolean(state.brand?.verified),
          featured: data.promotions.length > 0,
          sponsored: data.promotions.length > 0,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          ads: [ad, ...current.ads],
          metrics: { ...current.metrics, [ad.id]: { ...zero } },
        }));
        return ad;
      },
      publishFreeAd: (data) => {
        const now = new Date().toISOString();
        const ad: Ad = {
          id: uid("AD"),
          ownerId: state.user?.id ?? "local-user",
          ownerName: state.brand?.name ?? state.user?.name ?? "حسابي",
          countryCode: "SA",
          brandId: state.brand?.id,
          ...data,
          status: "active",
          revision: 1,
          verified: Boolean(state.brand?.verified),
          featured: false,
          sponsored: false,
          createdAt: now,
          activatedAt: now,
          expiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        };
        setState((current) => ({
          ...current,
          ads: [ad, ...current.ads],
          metrics: { ...current.metrics, [ad.id]: { ...zero } },
          notifications: [
            {
              id: uid("N"),
              title: "تم نشر إعلانك",
              body: `${ad.title} أصبح ظاهرًا في الموجز المحلي.`,
              read: false,
              createdAt: now,
              kind: "system",
            },
            ...current.notifications,
          ],
        }));
        return ad;
      },
      toggleSave: (id) =>
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
              [id]: {
                ...metrics,
                saves: Math.max(0, metrics.saves + (has ? -1 : 1)),
              },
            },
          };
        }),
      recordMetric: (id, key) =>
        setState((current) => {
          const metrics = current.metrics[id] ?? zero;
          return {
            ...current,
            metrics: {
              ...current.metrics,
              [id]: { ...metrics, [key]: metrics[key] + 1 },
            },
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
      setAdStatus: (id, status, reason = "إجراء المعلن") =>
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
          ads: current.ads.map((ad) =>
            ad.id === id ? extendAdPeriod(ad) : ad,
          ),
        })),
      republishAd: (id) =>
        setState((current) => {
          const now = new Date().toISOString();
          return {
            ...current,
            ads: current.ads.map((ad) =>
              ad.id === id ? republishExpiredAd(ad, now) : ad,
            ),
          };
        }),
      moderateAd: (id, decision, reason) =>
        setState((current) => {
          const now = new Date().toISOString();
          const target = current.ads.find((ad) => ad.id === id);
          if (!target || target.status !== "pending_review") return current;
          return {
            ...current,
            ads: current.ads.map((ad) =>
              ad.id === id ? moderatePendingAd(ad, decision, now) : ad,
            ),
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
            notifications: [
              {
                id: uid("N"),
                title:
                  decision === "approved"
                    ? "تم قبول إعلانك"
                    : "تحديث على مراجعة إعلانك",
                body: reason,
                read: false,
                createdAt: now,
                kind: "review",
              },
              ...current.notifications,
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
      continueWithFreshState: () =>
        setState({ ...initial, ready: true, loadError: null }),
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
