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
  applyLaunchPublish,
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
  type LaunchMode,
  type Metrics,
  type NotificationItem,
  type Order,
  type ProfilePost,
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
  ownerName?: string;
};

type State = {
  ready: boolean;
  loadError: "storage_load_failed" | null;
  user: UserProfile | null;
  brand: BrandProfile | null;
  ads: Ad[];
  posts: ProfilePost[];
  savedIds: string[];
  marketCode: string;
  launchMode: LaunchMode;
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
  ensureLocalUser: (profile?: Partial<UserProfile>) => UserProfile;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  upsertBrand: (data: Partial<BrandProfile>) => void;
  requestVerification: () => void;
  setMarket: (code: string) => void;
  createAd: (data: NewAd, options?: { freeLaunch?: boolean }) => Ad;
  createPost: (data: Omit<ProfilePost, "id" | "ownerId" | "createdAt">) => ProfilePost;
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

const initial: State = {
  ready: false,
  loadError: null,
  user: null,
  brand: seedBrand,
  ads: seedAds,
  posts: [],
  marketCode: "SA",
  launchMode: DEFAULT_LAUNCH_MODE,
  savedIds: [],
  blockedOwners: [],
  metrics: {
    AD10001: { impressions: 128547, views: 128547, saves: 1926, shares: 3842, contacts: 1243 },
    AD10002: { impressions: 36240, views: 36240, saves: 318, shares: 229, contacts: 156 },
    AD10003: { impressions: 21874, views: 21874, saves: 210, shares: 188, contacts: 97 },
  },
  notifications: [
    {
      id: "N1",
      title: "مرحبًا بك في إعلاني",
      body: "النشر مجاني حاليًا — أضف إعلانك وشاهده مباشرة في الموجز.",
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

function mergeSeedAds(storedAds: Ad[] | undefined): Ad[] {
  const current = storedAds ?? [];
  const byId = new Map(current.map((ad) => [ad.id, ad]));
  for (const seed of seedAds) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const C = createContext<Value | null>(null);
const KEY = "e3lani.store.v2";
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export function E3laniProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);

  const loadStoredState = useCallback(async () => {
    setState((current) => ({ ...current, ready: false, loadError: null }));
    try {
      const raw = (await AsyncStorage.getItem(KEY)) ?? (await AsyncStorage.getItem("e3lani.store.v1"));
      const stored = raw ? (JSON.parse(raw) as Partial<State>) : {};
      setState({
        ...initial,
        ...stored,
        ads: mergeSeedAds(stored.ads),
        posts: stored.posts ?? [],
        marketCode: stored.marketCode ?? "SA",
        launchMode: stored.launchMode ?? DEFAULT_LAUNCH_MODE,
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
            name: "حسابي",
            phone: "+966500000000",
            email: "owner@e3lani.sa",
            cityId: "riyadh",
            accountType: "advertiser",
            role: "user",
            bio: "صفحتك العامة للإعلانات والمنشورات المجانية.",
            ...profile,
          },
        })),
      ensureLocalUser: (profile) => {
        let created: UserProfile = {
          id: "U1",
          name: "حسابي",
          phone: "+966500000000",
          cityId: "riyadh",
          accountType: "advertiser",
          role: "user",
          bio: "صفحتك العامة للإعلانات والمنشورات المجانية.",
          ...profile,
        };
        setState((current) => {
          if (current.user) {
            created = { ...current.user, ...profile };
            return { ...current, user: created };
          }
          return { ...current, user: created };
        });
        return created;
      },
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
      setMarket: (code) => setState((current) => ({ ...current, marketCode: code })),
      createAd: (data, options) => {
        const now = new Date().toISOString();
        const freeLaunch = options?.freeLaunch ?? state.launchMode === "FREE_LAUNCH";
        const draft = {
          id: uid("AD"),
          ownerId: state.user?.id ?? "U1",
          brandId: state.brand?.id,
          ownerName: data.ownerName ?? state.user?.name ?? state.brand?.name,
          ...data,
          revision: 1,
          verified: Boolean(state.brand?.verified),
          featured: data.promotions.length > 0,
          sponsored: data.promotions.length > 0,
          createdAt: now,
        };
        const ad = freeLaunch
          ? applyLaunchPublish(draft, "FREE_LAUNCH", now)
          : applyLaunchPublish({ ...draft, status: "awaiting_payment" }, "PAID_ONLY", now);
        setState((current) => ({
          ...current,
          ads: [ad, ...current.ads],
          metrics: { ...current.metrics, [ad.id]: { ...zero } },
          notifications: [
            {
              id: uid("N"),
              title: ad.status === "active" ? "تم نشر إعلانك" : "تم إنشاء إعلانك",
              body:
                ad.status === "active"
                  ? `${ad.title} أصبح ظاهرًا في الموجز المحلي.`
                  : `${ad.title} بانتظار إكمال الدفع.`,
              read: false,
              createdAt: now,
              kind: "system",
            },
            ...current.notifications,
          ],
        }));
        return ad;
      },
      createPost: (data) => {
        const post: ProfilePost = {
          id: uid("POST"),
          ownerId: state.user?.id ?? "U1",
          createdAt: new Date().toISOString(),
          ...data,
        };
        setState((current) => ({ ...current, posts: [post, ...current.posts] }));
        return post;
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
              [id]: { ...metrics, saves: Math.max(0, metrics.saves + (has ? -1 : 1)) },
            },
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
          notifications: [
            {
              id: uid("N"),
              title: "تم استلام البلاغ",
              body: `سبب البلاغ: ${reason}`,
              read: false,
              createdAt: new Date().toISOString(),
              kind: "system",
            },
            ...current.notifications,
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
            notifications: [
              {
                id: uid("N"),
                title: decision === "approved" ? "تم قبول إعلانك" : "تحديث على مراجعة إعلانك",
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
          notifications: current.notifications.map((notification) => ({ ...notification, read: true })),
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
