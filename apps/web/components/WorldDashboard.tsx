"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Biohazard,
  Bot,
  ChevronLeft,
  CircleDot,
  CloudRain,
  Dna,
  Droplets,
  Factory,
  FastForward,
  Flame,
  Flower2,
  Globe2,
  Handshake,
  Languages,
  Layers3,
  Leaf,
  LoaderCircle,
  Map,
  Menu,
  MessageSquare,
  Mountain,
  Network,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Swords,
  Thermometer,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import type { WorldEvent } from "@living-planet/shared-types";
import { ContributionWizard } from "./ContributionWizard";
import {
  advanceTick,
  getSnapshot,
  useSandboxAuth,
  useWorldOverview,
  useWorldSocket,
} from "@/lib/api";
import { type WorldLayer, useWorldUi } from "@/lib/world-store";

const PlanetScene = dynamic(
  () => import("./planet/PlanetScene").then((module) => module.PlanetScene),
  {
    ssr: false,
    loading: () => (
      <div className="planet-loading">
        <LoaderCircle className="spin" />
        <span>توليد الكوكب من البذرة…</span>
      </div>
    ),
  },
);

const navItems = [
  ["الرئيسية", "Home"],
  ["استكشف", "Explore"],
  ["الحضارات", "Civilizations"],
  ["المخلوقات", "Creatures"],
  ["الموارد", "Resources"],
  ["التقنيات", "Technologies"],
  ["التحالفات", "Alliances"],
] as const;

const layers: { id: WorldLayer; ar: string; en: string; icon: typeof Globe2 }[] = [
  { id: "surface", ar: "السطح", en: "Surface", icon: Globe2 },
  { id: "biome", ar: "الأقاليم", en: "Biomes", icon: Leaf },
  { id: "weather", ar: "الطقس", en: "Weather", icon: CloudRain },
  { id: "civilization", ar: "الحضارات", en: "Civilizations", icon: Users },
  { id: "resource", ar: "الموارد", en: "Resources", icon: CircleDot },
  { id: "conflict", ar: "النزاعات", en: "Conflict", icon: Swords },
  { id: "migration", ar: "الهجرات", en: "Migration", icon: Network },
  { id: "trade", ar: "التجارة", en: "Trade", icon: Activity },
  { id: "pollution", ar: "التلوث", en: "Pollution", icon: Factory },
  { id: "temperature", ar: "الحرارة", en: "Temperature", icon: Thermometer },
];

const eventIcon: Partial<Record<WorldEvent["type"], typeof Activity>> = {
  CLIMATE_CHANGED: CloudRain,
  WAR_STARTED: Swords,
  VOLCANO_ERUPTED: Flame,
  SPECIES_CREATED: Dna,
  SPECIES_EXTINCT: Biohazard,
  CIVILIZATION_FOUNDED: Mountain,
  TECHNOLOGY_DISCOVERED: Zap,
  ALLIANCE_CREATED: Handshake,
  MIGRATION_STARTED: Network,
  RESOURCE_DISCOVERED: Droplets,
  CONTRIBUTION_ADDED: Sparkles,
};

function EventFeed({
  events,
  locale,
  onSelect,
}: {
  events: WorldEvent[];
  locale: "ar" | "en";
  onSelect(id?: string): void;
}) {
  return (
    <aside className="side-panel event-panel">
      <div className="panel-heading">
        <div>
          <span className="live-dot" />
          <h2>{locale === "ar" ? "سجل الأحداث" : "Live events"}</h2>
        </div>
        <button className="text-button">{locale === "ar" ? "الكل" : "All"}</button>
      </div>
      <div className="event-list">
        {events.slice(0, 12).map((event) => {
          const Icon = eventIcon[event.type] ?? Activity;
          const tone =
            event.type.includes("WAR") || event.type.includes("EXTINCT")
              ? "danger"
              : event.type.includes("CLIMATE")
                ? "weather"
                : event.type.includes("CONTRIBUTION")
                  ? "nature"
                  : "tech";
          return (
            <button
              className={`event-item ${tone}`}
              key={event.id}
              onClick={() => onSelect(event.regionId)}
            >
              <span className="event-icon">
                <Icon size={19} />
              </span>
              <span className="event-copy">
                <strong>{locale === "ar" ? event.titleAr : event.titleEn}</strong>
                <small>
                  {locale === "ar" ? event.descriptionAr : event.descriptionEn}
                </small>
                <span>
                  {locale === "ar" ? "السنة" : "Year"} {event.simulationYear.toLocaleString()}
                  <i>•</i>
                  {Math.round(event.confidence * 100)}%
                </span>
              </span>
              <b className="importance">{Math.round(event.importance * 5)}</b>
            </button>
          );
        })}
      </div>
      <button className="panel-more">
        {locale === "ar" ? "عرض جميع الأحداث" : "View all events"}
        <ChevronLeft size={16} />
      </button>
    </aside>
  );
}

function ContributionPanel({
  locale,
  eventCount,
  civilizationCount,
  year,
  onOpen,
}: {
  locale: "ar" | "en";
  eventCount: number;
  civilizationCount: number;
  year: number;
  onOpen(): void;
}) {
  return (
    <aside className="side-panel contribution-panel">
      <div className="panel-intro">
        <span className="eyebrow">{locale === "ar" ? "قرار واحد" : "One decision"}</span>
        <h2>{locale === "ar" ? "أضف عنصرًا واحدًا إلى العالم" : "Add one element to the world"}</h2>
        <p>
          {locale === "ar"
            ? "اختر من العناصر أدناه وأضفها إلى كوكبك."
            : "Choose an element and introduce it to your planet."}
        </p>
      </div>
      <button className="add-world-button" onClick={onOpen}>
        <span>
          <Plus size={31} />
        </span>
        <b>{locale === "ar" ? "ابدأ الإضافة" : "Start adding"}</b>
      </button>
      <div className="quick-categories">
        {[
          [Dna, "مخلوق", "Creature", "cyan"],
          [Leaf, "نبات", "Plant", "green"],
          [Droplets, "مورد", "Resource", "blue"],
          [Mountain, "حضارة", "Civilization", "gold"],
          [Settings2, "اختراع", "Invention", "cyan"],
          [CloudRain, "ظاهرة طبيعية", "Phenomenon", "purple"],
        ].map(([Icon, ar, en, tone]) => {
          const ItemIcon = Icon as typeof Dna;
          return (
            <button key={String(ar)} className={`quick-category ${tone}`} onClick={onOpen}>
              <ItemIcon size={18} />
              <span>{locale === "ar" ? String(ar) : String(en)}</span>
            </button>
          );
        })}
      </div>
      <div className="future-card">
        <div>
          <Bot size={18} />
          <strong>{locale === "ar" ? "ماذا سيحدث بعد إضافتك؟" : "What happens next?"}</strong>
        </div>
        <p>
          {locale === "ar"
            ? "شاهد كيف يتغير العالم عبر سيناريوهات سببية."
            : "Explore causal future scenarios."}
        </p>
        <ChevronLeft size={18} />
      </div>
      <div className="impact-heading">
        <span>{locale === "ar" ? "تأثيرك على العالم" : "Your world impact"}</span>
        <CircleDot size={15} />
      </div>
      <div className="impact-grid">
        <div>
          <Sparkles size={17} />
          <b>{eventCount}</b>
          <small>{locale === "ar" ? "أثر مسجل" : "Recorded effects"}</small>
        </div>
        <div>
          <Mountain size={17} />
          <b>{civilizationCount}</b>
          <small>{locale === "ar" ? "حضارة" : "Civilizations"}</small>
        </div>
        <div>
          <Activity size={17} />
          <b>{year}</b>
          <small>{locale === "ar" ? "السنة الحالية" : "Current year"}</small>
        </div>
      </div>
    </aside>
  );
}

function Timeline({
  tick,
  year,
  onAdvance,
  busy,
}: {
  tick: number;
  year: number;
  onAdvance(): void;
  busy: boolean;
}) {
  const locale = useWorldUi((state) => state.locale);
  const [playing, setPlaying] = useState(false);
  const [historicTick, setHistoricTick] = useState(tick);
  const [snapshotLabel, setSnapshotLabel] = useState<string>();

  return (
    <section className="timeline">
      <div className="timeline-controls">
        <button
          className="play-button"
          onClick={() => {
            setPlaying(!playing);
            if (!playing) onAdvance();
          }}
          aria-label={playing ? "إيقاف" : "تشغيل"}
        >
          {busy ? <LoaderCircle className="spin" size={21} /> : playing ? <Pause size={21} /> : <Play size={21} />}
        </button>
        <button onClick={onAdvance} disabled={busy} aria-label="تسريع دورة">
          <FastForward size={18} />
        </button>
        <div>
          <span>{locale === "ar" ? "خط الزمن" : "Timeline"}</span>
          <b>{year.toLocaleString(locale === "ar" ? "ar" : "en")}</b>
        </div>
      </div>
      <div className="timeline-track">
        <input
          type="range"
          min={0}
          max={Math.max(1, tick)}
          value={historicTick}
          onChange={(event) => setHistoricTick(Number(event.target.value))}
          onPointerUp={() => {
            void getSnapshot(historicTick)
              .then((snapshot) => setSnapshotLabel(`${snapshot.year} · ${snapshot.checksum}`))
              .catch(() => setSnapshotLabel(locale === "ar" ? "لا توجد لقطة لهذه الدورة" : "No snapshot at this tick"));
          }}
          aria-label="التنقل عبر تاريخ العالم"
        />
        <div className="milestones">
          {[
            ["نشأة المحيطات", "Oceans formed", Waves],
            ["ظهور الحياة", "Life appeared", Dna],
            ["نمو النباتات", "Plants spread", Flower2],
            ["بداية الحضارات", "Civilizations", Mountain],
            ["اكتشاف المعادن", "Metallurgy", CircleDot],
            ["الثورة التقنية", "Tech revolution", Zap],
            ["الوقت الحالي", "Present", Globe2],
          ].map(([ar, en, Icon], index) => {
            const MilestoneIcon = Icon as typeof Waves;
            return (
              <div key={String(ar)} className={index === 6 ? "current" : ""}>
                <span>
                  <MilestoneIcon size={15} />
                </span>
                <small>{locale === "ar" ? String(ar) : String(en)}</small>
              </div>
            );
          })}
        </div>
        {snapshotLabel && <output>{snapshotLabel}</output>}
      </div>
    </section>
  );
}

export function WorldDashboard() {
  useSandboxAuth();
  useWorldSocket();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useWorldOverview();
  const locale = useWorldUi((state) => state.locale);
  const setLocale = useWorldUi((state) => state.setLocale);
  const selectedRegionId = useWorldUi((state) => state.selectedRegionId);
  const selectRegion = useWorldUi((state) => state.selectRegion);
  const activeLayer = useWorldUi((state) => state.activeLayer);
  const setLayer = useWorldUi((state) => state.setLayer);
  const setContributionOpen = useWorldUi((state) => state.setContributionOpen);
  const quality = useWorldUi((state) => state.quality);
  const setQuality = useWorldUi((state) => state.setQuality);
  const [tickBusy, setTickBusy] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const selectedRegion = useMemo(
    () => data?.regions.find((region) => region.id === selectedRegionId),
    [data?.regions, selectedRegionId],
  );

  if (isLoading) {
    return (
      <main className="boot-screen">
        <div className="brand-planet">
          <Globe2 />
        </div>
        <h1>كوكب يولد أمامك</h1>
        <p>تُعاد الآن توليد أزورا من بذرتها الحتمية…</p>
        <LoaderCircle className="spin" />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="boot-screen error-screen">
        <Globe2 />
        <h1>تعذر الاتصال بمحرك العالم</h1>
        <p>{error instanceof Error ? error.message : "WORLD_API_UNAVAILABLE"}</p>
        <code>pnpm dev</code>
      </main>
    );
  }

  const isArabic = locale === "ar";
  const advance = async () => {
    setTickBusy(true);
    try {
      await advanceTick();
      await queryClient.invalidateQueries({ queryKey: ["world-overview"] });
    } finally {
      setTickBusy(false);
    }
  };

  return (
    <main className="world-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="mini-planet">
            <Globe2 size={24} />
          </span>
          <div>
            <strong>{isArabic ? "كوكب يولد أمامك" : "A Planet Born Before You"}</strong>
            <small>{isArabic ? "عالمك، قرارك، أثر لا ينتهي." : "Your world. Your decision. Endless impact."}</small>
          </div>
        </div>
        <nav>
          {navItems.map(([ar, en], index) => (
            <button key={ar} className={index === 0 ? "active" : ""}>
              {isArabic ? ar : en}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button onClick={() => setLocale(isArabic ? "en" : "ar")} aria-label="تغيير اللغة">
            <Languages size={17} />
            <span>{isArabic ? "EN" : "ع"}</span>
          </button>
          <button aria-label="الإشعارات">
            <Bell size={18} />
            <i />
          </button>
          <button aria-label="الرسائل">
            <MessageSquare size={18} />
          </button>
          <span className="profile-chip">
            <span>م</span>
            <b>{isArabic ? "مستكشف أزورا" : "Azura Explorer"}</b>
            <small>7</small>
          </span>
        </div>
      </header>

      <section className="workspace">
        <EventFeed events={data.events} locale={locale} onSelect={selectRegion} />

        <section className="planet-stage">
          <div className="space-haze" />
          <PlanetScene regions={data.regions} events={data.events} seed={data.planet.seed} />
          <div className="planet-title">
            <span className={data.sandbox ? "sandbox-badge" : "live-badge"}>
              {data.sandbox ? "SANDBOX" : "LIVE"}
            </span>
            <strong>{isArabic ? "أزورا الحية" : "Living Azura"}</strong>
            <small>
              Seed: {data.planet.seed} · v{data.planet.version}
            </small>
          </div>
          <div className="world-metrics">
            <span>
              <Leaf size={16} />
              <b>{Math.round(data.climate.vegetation * 100)}%</b>
              {isArabic ? "غطاء نباتي" : "Vegetation"}
            </span>
            <span>
              <Thermometer size={16} />
              <b>{data.climate.meanTemperature.toFixed(1)}°</b>
              {isArabic ? "متوسط الحرارة" : "Mean temp"}
            </span>
            <span>
              <Mountain size={16} />
              <b>{data.civilizations.length}</b>
              {isArabic ? "حضارة حية" : "Civilizations"}
            </span>
          </div>

          <button
            className="layers-toggle"
            onClick={() => setLayersOpen(!layersOpen)}
            aria-label="طبقات العرض"
          >
            <Layers3 size={19} />
          </button>
          <div className={layersOpen ? "layer-toolbar open" : "layer-toolbar"}>
            {layers.map((layer) => {
              const Icon = layer.icon;
              return (
                <button
                  key={layer.id}
                  className={activeLayer === layer.id ? "active" : ""}
                  onClick={() => setLayer(layer.id)}
                  title={isArabic ? layer.ar : layer.en}
                >
                  <Icon size={17} />
                  <span>{isArabic ? layer.ar : layer.en}</span>
                </button>
              );
            })}
          </div>

          <div className="quality-control">
            <Settings2 size={14} />
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value as typeof quality)}
              aria-label="جودة الرسومات"
            >
              <option value="ultra">{isArabic ? "فائقة" : "Ultra"}</option>
              <option value="high">{isArabic ? "عالية" : "High"}</option>
              <option value="medium">{isArabic ? "متوسطة" : "Medium"}</option>
              <option value="eco">{isArabic ? "توفير الطاقة" : "Eco"}</option>
            </select>
          </div>

          {selectedRegion && (
            <article className="region-card">
              <button onClick={() => selectRegion(undefined)} aria-label="إغلاق">
                <X size={15} />
              </button>
              <span className="eyebrow">{selectedRegion.biome}</span>
              <h3>{isArabic ? selectedRegion.nameAr : selectedRegion.nameEn}</h3>
              <div>
                <span>
                  <Thermometer size={14} />
                  {Math.round(selectedRegion.temperature * 45 - 10)}°
                </span>
                <span>
                  <Droplets size={14} />
                  {Math.round(selectedRegion.moisture * 100)}%
                </span>
                <span>
                  <Users size={14} />
                  {selectedRegion.population.toLocaleString()}
                </span>
              </div>
              <button className="region-add" onClick={() => setContributionOpen(true)}>
                <Plus size={14} />
                {isArabic ? "ابدأ عنصرًا هنا" : "Start here"}
              </button>
            </article>
          )}
        </section>

        <ContributionPanel
          locale={locale}
          eventCount={data.events.length}
          civilizationCount={data.civilizations.length}
          year={data.planet.year}
          onOpen={() => setContributionOpen(true)}
        />
      </section>

      <Timeline
        tick={data.planet.tick}
        year={data.planet.year}
        onAdvance={advance}
        busy={tickBusy}
      />
      <footer className="statusbar">
        <span>
          <Activity size={13} />
          {isArabic ? "المحرك متصل" : "Engine connected"}
        </span>
        <span>
          <Shield size={13} />
          {isArabic ? "نتائج قابلة للتتبع" : "Traceable results"}
        </span>
        <span>
          {isArabic ? "آخر دورة" : "Last tick"} #{data.planet.tick}
        </span>
        <div>
          <button aria-label="بحث">
            <Search size={15} />
          </button>
          <button aria-label="الخريطة">
            <Map size={15} />
          </button>
          <button aria-label="القائمة">
            <Menu size={15} />
          </button>
        </div>
      </footer>

      <ContributionWizard overview={data} />
    </main>
  );
}
