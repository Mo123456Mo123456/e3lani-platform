"use client";

import type {
  ContributionAnalysis,
  ContributionCategory,
  ContributionPreview,
  DeltaUpdate,
  PlanetRegion,
  WorldEvent,
  WorldState,
} from "@planet/shared-types";
import { CONTRIBUTION_CATEGORIES } from "@planet/shared-types";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  API_URL,
  analyzeContribution,
  confirmContribution,
  getWorld,
  previewContribution,
  register,
} from "@/lib/api";
import type { GraphicsQuality, PlanetLayer } from "./planet-scene";

const PlanetScene = dynamic(
  () => import("./planet-scene").then((module) => module.PlanetScene),
  {
    ssr: false,
    loading: () => <div className="globe-loading">تهيئة محرك الكوكب…</div>,
  },
);

const CATEGORY_LABELS: Record<
  ContributionCategory,
  { ar: string; en: string; icon: string }
> = {
  creature: { ar: "مخلوق", en: "Creature", icon: "◉" },
  plant: { ar: "نبات", en: "Plant", icon: "◆" },
  resource: { ar: "مورد", en: "Resource", icon: "◇" },
  civilization: { ar: "حضارة", en: "Civilization", icon: "▥" },
  invention: { ar: "اختراع", en: "Invention", icon: "⚙" },
  natural_phenomenon: { ar: "ظاهرة طبيعية", en: "Phenomenon", icon: "✦" },
  disease: { ar: "مرض", en: "Disease", icon: "✣" },
  culture: { ar: "ثقافة", en: "Culture", icon: "◎" },
  world_law: { ar: "قانون عالمي", en: "World law", icon: "⌁" },
  custom: { ar: "عنصر مخصص", en: "Custom", icon: "+" },
};

const EVENT_COLORS: Record<string, string> = {
  CIVILIZATION_FOUNDED: "#d7a73d",
  CONTRIBUTION_ADDED: "#46cfb2",
  VEGETATION_EXPANDED: "#69d968",
  POLLUTION_REDUCED: "#41bff5",
  WATER_STRESS_INCREASED: "#ff9f43",
  WAR_STARTED: "#ff534d",
  CLIMATE_CHANGED: "#8b9eff",
};

const BIOME_AR: Record<string, string> = {
  ocean: "محيط",
  coast: "ساحل",
  plains: "سهول",
  rainforest: "غابة مطيرة",
  temperate_forest: "غابة معتدلة",
  desert: "صحراء",
  mountains: "جبال",
  tundra: "تندرا",
  wetlands: "أراضٍ رطبة",
  steppe: "سهوب",
  volcanic: "بركانية",
  ice: "جليدية",
};

function number(value: number, locale: "ar" | "en", maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en", {
    maximumFractionDigits,
  }).format(value);
}

function applyDelta(world: WorldState, delta: DeltaUpdate): WorldState {
  const changed = new Map(
    delta.changedRegions.map((region) => [region.id, region]),
  );
  return {
    ...world,
    planet: delta.planet,
    regions: world.regions.map((region) =>
      changed.has(region.id)
        ? { ...region, ...changed.get(region.id) }
        : region,
    ),
    latestEvents: [...world.latestEvents, ...delta.events]
      .filter(
        (event, index, all) =>
          all.findIndex((item) => item.id === event.id) === index,
      )
      .slice(-250),
  };
}

function RealtimeBridge({ token }: { token: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = io(`${API_URL}/world`, {
      transports: ["websocket"],
      auth: token ? { token } : {},
      reconnectionDelayMax: 8_000,
    });
    socket.on("connect", () =>
      socket.emit("world.subscribe", { planetId: "primary-world" }),
    );
    socket.on("world.delta", (delta: DeltaUpdate) => {
      queryClient.setQueryData<WorldState>(["world"], (world) =>
        world ? applyDelta(world, delta) : world,
      );
    });
    return () => {
      socket.close();
    };
  }, [queryClient, token]);
  return null;
}

function EventFeed({
  events,
  locale,
}: {
  events: WorldEvent[];
  locale: "ar" | "en";
}) {
  return (
    <aside
      className="panel events-panel"
      aria-label={locale === "ar" ? "سجل الأحداث" : "Event log"}
    >
      <div className="panel-heading">
        <span className="live-wave">⌁</span>
        <h2>{locale === "ar" ? "سجل الأحداث" : "Event log"}</h2>
        <span className="live-pill">{locale === "ar" ? "مباشر" : "LIVE"}</span>
      </div>
      <div className="event-list">
        {[...events]
          .reverse()
          .slice(0, 12)
          .map((event) => (
            <article className="event-row" key={event.id}>
              <span
                className="event-line"
                style={{ background: EVENT_COLORS[event.type] ?? "#557187" }}
              />
              <span
                className="event-icon"
                style={{ color: EVENT_COLORS[event.type] ?? "#78bcd7" }}
              >
                {event.type.includes("CIVILIZATION")
                  ? "▥"
                  : event.type.includes("WATER")
                    ? "≋"
                    : "✦"}
              </span>
              <div>
                <h3>{locale === "ar" ? event.titleAr : event.titleEn}</h3>
                <p>
                  {locale === "ar" ? event.descriptionAr : event.descriptionEn}
                </p>
                <small>
                  {locale === "ar" ? "السنة" : "Year"}{" "}
                  {number(event.year, locale)} ·{" "}
                  {Math.round(event.confidence * 100)}%
                </small>
              </div>
            </article>
          ))}
      </div>
    </aside>
  );
}

function TraitBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="trait">
      <span>{label}</span>
      <div>
        <i style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <b>{Math.round(value * 100)}%</b>
    </div>
  );
}

function ContributionPanel({
  world,
  selectedRegion,
  locale,
  token,
  onToken,
}: {
  world: WorldState;
  selectedRegion?: PlanetRegion;
  locale: "ar" | "en";
  token: string;
  onToken: (token: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ContributionCategory>("plant");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<ContributionAnalysis>();
  const [preview, setPreview] = useState<ContributionPreview>();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const regionId =
    selectedRegion?.id ??
    world.regions.find((region) => region.biome === "plains")?.id;

  const analyze = useMutation({
    mutationFn: () => analyzeContribution({ category, text, locale }),
    onSuccess(value) {
      setAnalysis(value);
      setStep(2);
    },
  });
  const simulate = useMutation({
    mutationFn: () =>
      previewContribution({
        category,
        text,
        locale,
        regionId: regionId!,
        simulationRuns: 64,
      }),
    onSuccess(value) {
      setPreview(value);
      setAnalysis(value.analysis);
      setStep(3);
    },
  });
  const createAccount = useMutation({
    mutationFn: () => register({ email, password, displayName, locale }),
    onSuccess(value) {
      sessionStorage.setItem("planet_access_token", value.accessToken);
      onToken(value.accessToken);
    },
  });
  const confirm = useMutation({
    mutationFn: () =>
      confirmContribution(
        {
          category,
          text,
          locale,
          regionId: regionId!,
          simulationRuns: 64,
          previewToken: preview?.previewToken ?? "",
        },
        token,
      ),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ["world"] });
      setStep(4);
    },
  });
  const activeError =
    analyze.error ?? simulate.error ?? createAccount.error ?? confirm.error;

  if (!open) {
    return (
      <aside className="panel contribution-panel compact">
        <div className="contribution-intro">
          <span className="plus-orbit">+</span>
          <div>
            <h2>
              {locale === "ar"
                ? "أضف عنصرًا واحدًا إلى العالم"
                : "Add one element to the world"}
            </h2>
            <p>
              {locale === "ar"
                ? "سيُحلّل ويُحاكى قبل اعتماده"
                : "It will be analyzed and simulated first"}
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}>
          {locale === "ar" ? "ابدأ الإضافة" : "Start contribution"}
        </button>
        <div className="category-grid">
          {CONTRIBUTION_CATEGORIES.slice(0, 6).map((item) => (
            <button
              key={item}
              onClick={() => {
                setCategory(item);
                setOpen(true);
              }}
            >
              <span>{CATEGORY_LABELS[item].icon}</span>
              {CATEGORY_LABELS[item][locale]}
            </button>
          ))}
        </div>
        <div className="impact-summary">
          <h3>{locale === "ar" ? "تأثيرك على العالم" : "Your world impact"}</h3>
          <div>
            <span>
              <b>{number(world.planet.contributionCount, locale)}</b>
              {locale === "ar" ? "عنصر نشط" : "active items"}
            </span>
            <span>
              <b>{number(world.planet.eventCount, locale)}</b>
              {locale === "ar" ? "أثر سببي" : "causal events"}
            </span>
            <span>
              <b>{number(world.planet.civilizationCount, locale)}</b>
              {locale === "ar" ? "حضارة" : "civilizations"}
            </span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel contribution-panel wizard">
      <div className="wizard-head">
        <div>
          <small>
            {locale === "ar" ? `الخطوة ${step} من 4` : `Step ${step} of 4`}
          </small>
          <h2>
            {locale === "ar" ? "إضافة عنصر إلى العالم" : "Add an element"}
          </h2>
        </div>
        <button
          className="icon-button"
          onClick={() => setOpen(false)}
          aria-label="close"
        >
          ×
        </button>
      </div>
      <div className="step-dots">
        {[1, 2, 3, 4].map((item) => (
          <i key={item} className={item <= step ? "active" : ""} />
        ))}
      </div>

      {step === 1 && (
        <>
          <label>{locale === "ar" ? "الفئة" : "Category"}</label>
          <div className="category-grid mini">
            {CONTRIBUTION_CATEGORIES.map((item) => (
              <button
                className={category === item ? "selected" : ""}
                key={item}
                onClick={() => setCategory(item)}
              >
                <span>{CATEGORY_LABELS[item].icon}</span>
                {CATEGORY_LABELS[item][locale]}
              </button>
            ))}
          </div>
          <label htmlFor="idea">
            {locale === "ar" ? "صف فكرتك" : "Describe your idea"}
          </label>
          <textarea
            id="idea"
            value={text}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              locale === "ar"
                ? "مثال: شجرة عملاقة تمتص التلوث وتضيء في الليل…"
                : "Example: A giant tree that absorbs pollution and glows at night…"
            }
          />
          <button
            className="primary-button"
            disabled={text.trim().length < 8 || analyze.isPending}
            onClick={() => analyze.mutate()}
          >
            {analyze.isPending
              ? locale === "ar"
                ? "جارٍ التحليل…"
                : "Analyzing…"
              : locale === "ar"
                ? "تحليل الفكرة"
                : "Analyze idea"}
          </button>
        </>
      )}

      {step === 2 && analysis && (
        <>
          <div className="analysis-card">
            <small>
              {analysis.sandbox
                ? locale === "ar"
                  ? "وضع Sandbox معلن"
                  : "Declared sandbox mode"
                : analysis.provider}
            </small>
            <h3>{analysis.name}</h3>
            <p>{analysis.description}</p>
          </div>
          <TraitBar
            label={locale === "ar" ? "امتصاص التلوث" : "Pollution absorption"}
            value={analysis.traits.pollutionAbsorption}
          />
          <TraitBar
            label={locale === "ar" ? "الاحتياج للماء" : "Water need"}
            value={analysis.traits.waterNeed}
          />
          <TraitBar
            label={locale === "ar" ? "التكيف" : "Adaptability"}
            value={analysis.traits.adaptability}
          />
          <div className="risk-list">
            <h3>{locale === "ar" ? "المخاطر المحسوبة" : "Calculated risks"}</h3>
            {analysis.risks.map((risk) => (
              <span key={risk}>⚠ {risk.replaceAll("_", " ")}</span>
            ))}
          </div>
          <div className="region-choice">
            <small>
              {locale === "ar"
                ? "منطقة البداية المختارة"
                : "Selected start region"}
            </small>
            <b>
              {selectedRegion
                ? locale === "ar"
                  ? selectedRegion.nameAr
                  : selectedRegion.nameEn
                : locale === "ar"
                  ? "انقر الكوكب لتغيير المنطقة"
                  : "Click the globe to change region"}
            </b>
          </div>
          <button
            className="primary-button"
            disabled={!regionId || simulate.isPending}
            onClick={() => simulate.mutate()}
          >
            {simulate.isPending
              ? locale === "ar"
                ? "تشغيل ٦٤ مسارًا…"
                : "Running 64 paths…"
              : locale === "ar"
                ? "محاكاة المستقبل"
                : "Simulate future"}
          </button>
        </>
      )}

      {step === 3 && preview && (
        <>
          <div className="probability-ring">
            <strong>{Math.round(preview.habitatSuitability * 100)}%</strong>
            <span>{locale === "ar" ? "ملاءمة الموطن" : "Habitat fit"}</span>
          </div>
          <div className="scenario-grid">
            {preview.scenarios.map((scenario) => (
              <article key={scenario.horizonYears}>
                <b>
                  {locale === "ar" ? "بعد" : "After"}{" "}
                  {number(scenario.horizonYears, locale)}{" "}
                  {locale === "ar" ? "سنة" : "years"}
                </b>
                <span>
                  {Math.round(scenario.successProbability * 100)}%{" "}
                  {locale === "ar" ? "نجاح" : "success"}
                </span>
                <small>
                  ±{Math.round(scenario.uncertainty * 100)}%{" "}
                  {locale === "ar" ? "عدم يقين" : "uncertainty"}
                </small>
              </article>
            ))}
          </div>
          {!token && (
            <div className="auth-box">
              <h3>
                {locale === "ar"
                  ? "أنشئ حسابًا لتأكيد الإضافة"
                  : "Create an account to confirm"}
              </h3>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={locale === "ar" ? "الاسم" : "Name"}
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={locale === "ar" ? "البريد الإلكتروني" : "Email"}
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  locale === "ar"
                    ? "كلمة مرور (١٢ حرفًا)"
                    : "Password (12+ characters)"
                }
              />
              <button
                className="secondary-button"
                disabled={
                  password.length < 12 ||
                  !email.includes("@") ||
                  displayName.length < 2 ||
                  createAccount.isPending
                }
                onClick={() => createAccount.mutate()}
              >
                {createAccount.isPending
                  ? "…"
                  : locale === "ar"
                    ? "إنشاء حساب آمن"
                    : "Create secure account"}
              </button>
            </div>
          )}
          <button
            className="primary-button"
            disabled={!token || !preview.previewToken || confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            {confirm.isPending
              ? locale === "ar"
                ? "حفظ وتشغيل Tick…"
                : "Saving and running tick…"
              : locale === "ar"
                ? "تأكيد وإدخال العنصر"
                : "Confirm and add"}
          </button>
        </>
      )}

      {step === 4 && (
        <div className="success-state">
          <span>✓</span>
          <h3>
            {locale === "ar"
              ? "دخل العنصر إلى التاريخ"
              : "The element entered history"}
          </h3>
          <p>
            {locale === "ar"
              ? "حُفظت الأحداث في قاعدة البيانات، ونُشر التغيير إلى الكوكب لحظيًا."
              : "Events were persisted and the world delta was broadcast in real time."}
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              setOpen(false);
              setStep(1);
              setText("");
              setAnalysis(undefined);
              setPreview(undefined);
            }}
          >
            {locale === "ar" ? "العودة إلى العالم" : "Return to world"}
          </button>
        </div>
      )}
      {activeError && <p className="error-message">{activeError.message}</p>}
    </aside>
  );
}

function DashboardContent() {
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [selectedRegionId, setSelectedRegionId] = useState<string>();
  const [layer, setLayer] = useState<PlanetLayer>("surface");
  const [quality, setQuality] = useState<GraphicsQuality>("high");
  const [paused, setPaused] = useState(false);
  const [token, setToken] = useState("");
  const worldQuery = useQuery({
    queryKey: ["world"],
    queryFn: getWorld,
    staleTime: 20_000,
  });

  useEffect(() => {
    setToken(sessionStorage.getItem("planet_access_token") ?? "");
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const world = worldQuery.data;
  const selectedRegion = world?.regions.find(
    (region) => region.id === selectedRegionId,
  );
  const nav =
    locale === "ar"
      ? [
          "الرئيسية",
          "استكشف",
          "الحضارات",
          "المخلوقات",
          "الموارد",
          "التقنيات",
          "التحالفات",
          "الخط الزمني",
        ]
      : [
          "Home",
          "Explore",
          "Civilizations",
          "Creatures",
          "Resources",
          "Technologies",
          "Alliances",
          "Timeline",
        ];

  if (worldQuery.isPending) {
    return (
      <main className="center-state">
        <span className="planet-spinner" />
        <h1>كوكب يولد أمامك</h1>
        <p>جارٍ استعادة الحالة من سجل الأحداث…</p>
      </main>
    );
  }
  if (!world) {
    return (
      <main className="center-state error">
        <h1>
          {locale === "ar" ? "تعذر الاتصال بالعالم" : "World connection failed"}
        </h1>
        <p>{worldQuery.error?.message}</p>
        <button onClick={() => worldQuery.refetch()}>
          {locale === "ar" ? "إعادة المحاولة" : "Retry"}
        </button>
      </main>
    );
  }

  return (
    <main className="world-shell">
      <RealtimeBridge token={token} />
      <header className="topbar">
        <div className="brand">
          <span className="brand-planet">◉</span>
          <div>
            <b>
              {locale === "ar" ? "كوكب يولد أمامك" : "A Planet Born Before You"}
            </b>
            <small>
              {locale === "ar"
                ? "عالمك، قرارك، أثر لا ينتهي."
                : "Your world. Your choice. An endless impact."}
            </small>
          </div>
        </div>
        <nav>
          {nav.map((item, index) => (
            <button
              key={item}
              className={index === 0 ? "active" : ""}
              disabled={index > 1}
              title={
                index > 1
                  ? locale === "ar"
                    ? "غير مفعّل في هذه المرحلة"
                    : "Not enabled in this phase"
                  : undefined
              }
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
            {locale === "ar" ? "EN" : "AR"}
          </button>
          <button aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}>
            ♢
          </button>
          <span className="user-dot">{token ? "✓" : "○"}</span>
        </div>
      </header>

      <section className="world-grid">
        <EventFeed events={world.latestEvents} locale={locale} />
        <section className="globe-stage">
          <div className="world-meta">
            <span>
              <i className="status-dot" />
              {locale === "ar" ? "المحاكاة متصلة" : "Simulation connected"}
            </span>
            <b>{world.planet.nameAr}</b>
            <span>
              {locale === "ar" ? "السنة" : "Year"}{" "}
              {number(world.planet.year, locale)} · Tick{" "}
              {number(world.planet.tick, locale)}
            </span>
          </div>
          <div className="layer-switcher">
            {(
              [
                ["surface", locale === "ar" ? "السطح" : "Surface"],
                ["temperature", locale === "ar" ? "الحرارة" : "Temperature"],
                ["pollution", locale === "ar" ? "التلوث" : "Pollution"],
                [
                  "civilizations",
                  locale === "ar" ? "الحضارات" : "Civilizations",
                ],
              ] as Array<[PlanetLayer, string]>
            ).map(([value, label]) => (
              <button
                className={layer === value ? "active" : ""}
                key={value}
                onClick={() => setLayer(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <PlanetScene
            regions={world.regions}
            events={world.latestEvents}
            layer={layer}
            quality={quality}
            paused={paused}
            onSelect={setSelectedRegionId}
          />
          <div className="globe-help">
            {locale === "ar"
              ? "اسحب للتدوير · مرّر للتقريب · انقر منطقة للتفاصيل"
              : "Drag to rotate · Scroll to zoom · Click a region for details"}
          </div>
          {selectedRegion && (
            <article className="region-card">
              <button onClick={() => setSelectedRegionId(undefined)}>×</button>
              <small>
                {locale === "ar"
                  ? BIOME_AR[selectedRegion.biome]
                  : selectedRegion.biome.replaceAll("_", " ")}
              </small>
              <h2>
                {locale === "ar"
                  ? selectedRegion.nameAr
                  : selectedRegion.nameEn}
              </h2>
              <div>
                <span>
                  {locale === "ar" ? "الحرارة" : "Temperature"}
                  <b>{Math.round(selectedRegion.temperature * 100)}%</b>
                </span>
                <span>
                  {locale === "ar" ? "المياه" : "Water"}
                  <b>{Math.round(selectedRegion.water * 100)}%</b>
                </span>
                <span>
                  {locale === "ar" ? "الخصوبة" : "Fertility"}
                  <b>{Math.round(selectedRegion.fertility * 100)}%</b>
                </span>
                <span>
                  {locale === "ar" ? "السكان" : "Population"}
                  <b>{number(selectedRegion.population, locale)}</b>
                </span>
              </div>
            </article>
          )}
          <div className="quality-control">
            <label>{locale === "ar" ? "الجودة" : "Quality"}</label>
            <select
              value={quality}
              onChange={(event) =>
                setQuality(event.target.value as GraphicsQuality)
              }
            >
              <option value="ultra">
                {locale === "ar" ? "فائقة" : "Ultra"}
              </option>
              <option value="high">{locale === "ar" ? "عالية" : "High"}</option>
              <option value="medium">
                {locale === "ar" ? "متوسطة" : "Medium"}
              </option>
              <option value="eco">
                {locale === "ar" ? "توفير الطاقة" : "Power saver"}
              </option>
            </select>
          </div>
        </section>
        <ContributionPanel
          world={world}
          selectedRegion={selectedRegion}
          locale={locale}
          token={token}
          onToken={setToken}
        />
      </section>

      <footer className="timeline">
        <button className="play-button" onClick={() => setPaused(!paused)}>
          {paused ? "▶" : "Ⅱ"}
        </button>
        <div className="timeline-track">
          {world.latestEvents.slice(-7).map((event, index) => (
            <button
              key={event.id}
              className={
                index === world.latestEvents.slice(-7).length - 1
                  ? "current"
                  : ""
              }
            >
              <span>{event.type.includes("CIVILIZATION") ? "▥" : "✦"}</span>
              <b>{number(event.year, locale)}</b>
              <small>{locale === "ar" ? event.titleAr : event.titleEn}</small>
            </button>
          ))}
        </div>
        <div className="timeline-now">
          <i />
          {locale === "ar" ? "الحاضر" : "Now"}
        </div>
      </footer>
    </main>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
});

export function WorldDashboard() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}
