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
  resolveCreateStatus,
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
import { GLOBAL_MARKET, type MarketCode } from "./feed/rank";
import { DEFAULT_LAUNCH_POLICY, type LaunchPolicy } from "./launch-policy";
import { scanAdContent } from "./moderation/ai-scan";
import { resolvePublishQuote } from "./pricing/resolve-quote";

type NewAd = {
  title: string;
  description: string;
  categoryId: string;
  cityId: string;
  countryCode?: string;
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
  posts: ProfilePost[];
  savedIds: string[];
  metrics: Record<string, Metrics>;
  notifications: NotificationItem[];
  reports: ReportItem[];
  orders: Order[];
  invoices: Invoice[];
  audit: AuditLog[];
  blockedOwners: string[];
  /** Feed market filter. Defaults to ALL (global). */
  marketCode: MarketCode;
  /** Account/home country — organizational only, never hides the global feed. */
  accountCountry: string;
  launchMode: LaunchMode;
  launchPolicy: LaunchPolicy;
  categoryFilter: string;
  forceCountryFilter: boolean;
};

type Value = State & {
  login: (profile?: Partial<UserProfile>) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  upsertBrand: (data: Partial<BrandProfile>) => void;
  requestVerification: () => void;
  createAd: (data: NewAd) => Ad;
  createPost: (data: { title: string; text: string; media?: AdMedia }) => ProfilePost;
  setMarket: (code: MarketCode, forceFilter?: boolean) => void;
  setAccountCountry: (code: string) => void;
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

const initial: State = {
  ready: false,
  loadError: null,
  user: null,
  brand: seedBrand,
  ads: seedAds,
  posts: [],
  savedIds: [],
  blockedOwners: [],
  marketCode: GLOBAL_MARKET,
  accountCountry: "SA",
  launchMode: DEFAULT_LAUNCH_MODE,
  launchPolicy: DEFAULT_LAUNCH_POLICY,
  categoryFilter: "",
  forceCountryFilter: false,
  metrics: {
    AD10001: { impressions: 128547, views: 128547, saves: 1926, shares: 3842, contacts: 1243 },
    AD10002: { impressions: 26480, views: 21970, saves: 318, shares: 229, contacts: 156 },
    AD10003: { impressions: 18420, views: 15210, saves: 210, shares: 188, contacts: 96 },
    AD10004: { impressions: 22110, views: 19880, saves: 260, shares: 140, contacts: 112 },
  },
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
      setState({
        ...initial,
        ...stored,
        posts: stored.posts ?? [],
        marketCode: stored.marketCode ?? GLOBAL_MARKET,
        accountCountry: stored.accountCountry ?? "SA",
        launchMode: stored.launchMode ?? DEFAULT_LAUNCH_MODE,
        launchPolicy: stored.launchPolicy ?? DEFAULT_LAUNCH_POLICY,
        categoryFilter: stored.categoryFilter ?? "",
        forceCountryFilter: stored.forceCountryFilter ?? false,
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
        setState((current) => {
          const countryCode = profile?.countryCode ?? current.accountCountry ?? "SA";
          return {
            ...current,
            accountCountry: countryCode,
            user: {
              id: "U1",
              name: "معلن إعلاني",
              phone: "+966500000000",
              email: "owner@e3lani.sa",
              cityId: "riyadh",
              countryCode,
              accountType: "brand",
              role: "owner",
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
        const now = new Date().toISOString();
        const policy = state.launchPolicy;
        const quote = resolvePublishQuote({
          policy,
          countryId: data.countryCode ?? state.accountCountry,
          categoryId: data.categoryId,
          accountType: state.user?.accountType,
          nowIso: now,
        });
        const scan = policy.aiModeration
          ? scanAdContent({
              title: data.title,
              description: data.description,
              contactValue: data.contacts[0]?.value,
              mediaKind: data.media[0]?.kind,
            })
          : { label: "SAFE" as const, reasons: [], autoAction: "keep_published" as const };

        let lifecycle = resolveCreateStatus(
          policy.instantPublishing && quote.paymentStatus === "not_required"
            ? "FREE_LAUNCH"
            : state.launchMode,
          now,
        );

        if (scan.autoAction === "auto_pause") {
          lifecycle = { status: "paused" };
        } else if (policy.manualPreApproval) {
          lifecycle = { status: "pending_review" };
        }

        const ad: Ad = {
          id: uid("AD"),
          ownerId: state.user?.id ?? "U1",
          brandId: state.brand?.id,
          ...data,
          countryCode: data.countryCode ?? state.accountCountry,
          ...lifecycle,
          revision: 1,
          verified: Boolean(state.brand?.verified),
          featured: data.promotions.length > 0,
          sponsored: data.promotions.length > 0,
          createdAt: now,
          aiLabel: scan.label,
          paymentStatus: quote.paymentStatus === "pending" ? "pending" : "not_required",
          priceSnapshot: {
            basePrice: quote.basePrice,
            discount: quote.discount,
            tax: quote.tax,
            finalPrice: quote.finalPrice,
            currency: quote.currency,
            freeReason: quote.freeReason,
          },
        };

        setState((current) => ({
          ...current,
          ads: [ad, ...current.ads],
          metrics: { ...current.metrics, [ad.id]: { ...zero } },
          audit:
            scan.label !== "SAFE"
              ? [
                  {
                    id: uid("A"),
                    actor: "ai.moderation",
                    action: `ai.${scan.label.toLowerCase()}`,
                    target: ad.id,
                    reason: scan.reasons.join(", ") || scan.label,
                    createdAt: now,
                  },
                  ...current.audit,
                ]
              : current.audit,
          notifications: [
            {
              id: uid("N"),
              title:
                ad.status === "active"
                  ? "تم نشر إعلانك"
                  : ad.status === "paused"
                    ? "تم إيقاف الإعلان تلقائيًا"
                    : "تم إنشاء إعلانك",
              body:
                ad.status === "active"
                  ? `${ad.title} أصبح ظاهرًا في الموجز العالمي.`
                  : ad.status === "paused"
                    ? `أوقفت المراجعة الآلية إعلانك: ${scan.reasons[0] ?? "مخالفة واضحة"}`
                    : `${ad.title} بانتظار استكمال مسار النشر.`,
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
          title: data.title,
          text: data.text,
          media: data.media,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({ ...current, posts: [post, ...current.posts] }));
        return post;
      },
      setMarket: (code, forceFilter = code !== GLOBAL_MARKET) =>
        setState((current) => ({
          ...current,
          marketCode: code,
          forceCountryFilter: code === GLOBAL_MARKET ? false : forceFilter,
        })),
      setAccountCountry: (code) =>
        setState((current) => ({
          ...current,
          accountCountry: code,
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
