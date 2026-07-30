"use client";

import {
  Activity,
  Bell,
  Biohazard,
  CircleDot,
  CloudLightning,
  Dna,
  Factory,
  FastForward,
  Globe2,
  Languages,
  Leaf,
  LoaderCircle,
  Menu,
  Mountain,
  Network,
  Pause,
  Play,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Swords,
  Users,
  Waves,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import type { RealtimeServerEvent, WorldEvent } from "@planet/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

import { ContributionFlow } from "@/components/contribution-flow";
import {
  API_URL,
  fetchEvents,
  fetchRegions,
  fetchWorld,
  runTicks,
} from "@/lib/api";
import { useWorldStore, type WorldLayer } from "@/lib/world-store";

const PlanetCanvas = dynamic(
  () =>
    import("@/components/planet-canvas").then(
      (module) => module.PlanetCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="planet-loading">
        <LoaderCircle className="spin" />
        <span>توليد طبقات الكوكب…</span>
      </div>
    ),
  },
);

const layerOptions: Array<{
  id: WorldLayer;
  label: string;
  icon: typeof Globe2;
}> = [
  { id: "surface", label: "السطح", icon: Globe2 },
  { id: "biome", label: "الأقاليم", icon: Leaf },
  { id: "temperature", label: "الحرارة", icon: CloudLightning },
  { id: "pollution", label: "التلوث", icon: Factory },
  { id: "civilization", label: "الحضارات", icon: Users },
];

export default function HomePage() {
  const queryClient = useQueryClient();
  const [realtime, setRealtime] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );
  const worldQuery = useQuery({ queryKey: ["world"], queryFn: fetchWorld });
  const worldId = worldQuery.data?.id;
  const regionsQuery = useQuery({
    queryKey: ["regions", worldId],
    queryFn: () => fetchRegions(worldId!),
    enabled: Boolean(worldId),
  });
  const eventsQuery = useQuery({
    queryKey: ["events", worldId],
    queryFn: () => fetchEvents(worldId!),
    enabled: Boolean(worldId),
  });
  const tickMutation = useMutation({
    mutationFn: (count: number) => runTicks(worldId!, count),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["world"] }),
        queryClient.invalidateQueries({ queryKey: ["regions", worldId] }),
        queryClient.invalidateQueries({ queryKey: ["events", worldId] }),
      ]),
  });

  useEffect(() => {
    if (!worldId) return;
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "") ?? API_URL;
    const socket = io(`${wsUrl}/world`, {
      transports: ["websocket"],
      withCredentials: true,
      reconnectionDelayMax: 8_000,
    });
    socket.on("connect", () => setRealtime("live"));
    socket.on("disconnect", () => setRealtime("offline"));
    socket.on("connect_error", () => setRealtime("offline"));
    socket.on("delta", (delta: RealtimeServerEvent) => {
      if (delta.kind === "world.event") {
        queryClient.setQueryData<WorldEvent[]>(
          ["events", worldId],
          (current = []) =>
            [delta.data, ...current.filter(({ id }) => id !== delta.data.id)].slice(
              0,
              120,
            ),
        );
        void queryClient.invalidateQueries({
          queryKey: ["regions", worldId],
        });
      }
      if (delta.kind === "world.tick") {
        void queryClient.invalidateQueries({ queryKey: ["world"] });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, worldId]);

  if (worldQuery.isPending || regionsQuery.isPending || eventsQuery.isPending) {
    return <LoadingScreen />;
  }
  if (
    worldQuery.error ||
    regionsQuery.error ||
    eventsQuery.error ||
    !worldQuery.data
  ) {
    return (
      <ErrorScreen
        message={
          worldQuery.error?.message ??
          regionsQuery.error?.message ??
          eventsQuery.error?.message ??
          "تعذر تحميل العالم"
        }
      />
    );
  }

  const world = worldQuery.data;
  const regions = regionsQuery.data ?? [];
  const events = eventsQuery.data ?? [];

  return (
    <main className="world-shell">
      <TopBar realtime={realtime} />
      <section className="world-stage">
        <EventPanel events={events} regions={regions} />
        <div className="planet-stage">
          <PlanetCanvas regions={regions} events={events} />
          <WorldStatus world={world} />
          <LayerPicker />
          <SelectedRegionCard />
        </div>
        <ContributionPanel world={world} />
      </section>
      <Timeline
        world={world}
        events={events}
        isRunning={tickMutation.isPending}
        onAdvance={(count) => tickMutation.mutate(count)}
      />
      <ContributionFlow worldId={world.id} regions={regions} />
    </main>
  );
}

function TopBar({ realtime }: { realtime: string }) {
  const locale = useWorldStore((state) => state.locale);
  const toggleLocale = useWorldStore((state) => state.toggleLocale);
  return (
    <header className="topbar">
      <a className="brand" href="#" aria-label="كوكب يولد أمامك">
        <span className="brand-planet">
          <Globe2 size={23} />
        </span>
        <span>
          <strong>كوكب يولد أمامك</strong>
          <small>عالمك، قرارك، أثر لا ينتهي.</small>
        </span>
      </a>
      <nav aria-label="التنقل الرئيسي">
        {["الرئيسية", "استكشف", "الحضارات", "المخلوقات", "الموارد", "التقنيات", "التحالفات"].map(
          (item, index) => (
            <a key={item} className={index === 0 ? "active" : ""} href="#">
              {item}
            </a>
          ),
        )}
      </nav>
      <div className="top-actions">
        <span className={`live-indicator ${realtime}`}>
          <i /> {realtime === "live" ? "مباشر" : "غير متصل"}
        </span>
        <button aria-label="بحث">
          <Search size={17} />
        </button>
        <button aria-label="الإشعارات">
          <Bell size={17} />
          <i className="notification-dot" />
        </button>
        <button onClick={toggleLocale} aria-label="تغيير اللغة">
          <Languages size={18} />
          <small>{locale.toUpperCase()}</small>
        </button>
        <button className="profile-button" aria-label="الحساب">
          م
        </button>
        <button className="mobile-menu" aria-label="القائمة">
          <Menu size={19} />
        </button>
      </div>
    </header>
  );
}

function EventPanel({
  events,
  regions,
}: {
  events: WorldEvent[];
  regions: Array<{ id: string; nameAr: string }>;
}) {
  const [filter, setFilter] = useState("all");
  const regionNames = useMemo(
    () => new Map(regions.map((region) => [region.id, region.nameAr])),
    [regions],
  );
  const shown = events.filter(
    (event) =>
      filter === "all" ||
      (filter === "climate" &&
        ["CLIMATE_CHANGED", "POLLUTION_CHANGED"].includes(event.type)) ||
      (filter === "life" &&
        ["SPECIES_CREATED", "PLANT_SPREAD", "SPECIES_EXTINCT"].includes(
          event.type,
        )) ||
      (filter === "civilization" &&
        ["CIVILIZATION_FOUNDED", "WAR_STARTED", "ALLIANCE_CREATED"].includes(
          event.type,
        )),
  );

  return (
    <aside className="event-panel glass-panel" aria-label="سجل الأحداث">
      <header className="panel-header">
        <div>
          <span className="panel-icon">
            <Activity size={16} />
          </span>
          <h2>سجل الأحداث</h2>
        </div>
        <span className="pulse-wave">⌁</span>
      </header>
      <div className="event-filters">
        {[
          ["all", "الكل"],
          ["climate", "المناخ"],
          ["life", "الحياة"],
          ["civilization", "الحضارات"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="event-list">
        {shown.length === 0 && (
          <div className="empty-events">
            لا أحداث في هذا المرشح. شغّل الزمن لتوليد أحداث سببية.
          </div>
        )}
        {shown.slice(0, 18).map((event) => (
          <article className={`event-item event-${eventTone(event.type)}`} key={event.id}>
            <div className="event-symbol">{eventIcon(event.type)}</div>
            <div className="event-copy">
              <h3>{eventTitle(event.type)}</h3>
              <p>{causeLabel(event.cause)}</p>
              <footer>
                <span>سنة {formatYear(event.year)}</span>
                {event.regionId && (
                  <span>{regionNames.get(event.regionId) ?? "منطقة مجهولة"}</span>
                )}
              </footer>
            </div>
            <i className="importance" style={{ height: `${30 + event.confidence * 45}%` }} />
          </article>
        ))}
      </div>
      <button className="panel-footer-button">
        عرض جميع الأحداث <ZoomIn size={14} />
      </button>
    </aside>
  );
}

function ContributionPanel({
  world,
}: {
  world: Awaited<ReturnType<typeof fetchWorld>>;
}) {
  const setOpen = useWorldStore((state) => state.setContributionOpen);
  return (
    <aside className="contribution-panel glass-panel">
      <div className="impact-intro">
        <span className="spark-orbit">
          <Sparkles size={29} />
        </span>
        <h2>أضف عنصرًا واحدًا إلى العالم</h2>
        <p>فكرة واحدة قد يستمر أثرها آلاف السنوات داخل المحاكاة.</p>
      </div>
      <button className="add-world-button" onClick={() => setOpen(true)}>
        <Sparkles size={19} />
        ابدأ بناء عنصرك
      </button>
      <div className="quick-categories">
        {[
          [Dna, "مخلوق"],
          [Leaf, "نبات"],
          [PackageOpenIcon, "مورد"],
          [LandmarkIcon, "حضارة"],
          [Zap, "اختراع"],
          [Mountain, "ظاهرة"],
        ].map(([Icon, label]) => {
          const Component = Icon as typeof Dna;
          return (
            <button key={String(label)} onClick={() => setOpen(true)}>
              <Component size={18} />
              <span>{String(label)}</span>
            </button>
          );
        })}
      </div>
      <div className="impact-card">
        <header>
          <span>حالة العالم</span>
          <Shield size={15} />
        </header>
        <div className="impact-numbers">
          <div>
            <b>{world.counts.civilizations}</b>
            <small>حضارة</small>
          </div>
          <div>
            <b>{world.counts.species.toLocaleString("ar")}</b>
            <small>نوعًا</small>
          </div>
          <div>
            <b>{world.counts.events.toLocaleString("ar")}</b>
            <small>حدثًا</small>
          </div>
        </div>
      </div>
      <div
        className={`persistence-badge ${world.persistenceMode === "postgresql" ? "ready" : "sandbox"}`}
      >
        <CircleDot size={13} />
        {world.persistenceMode === "postgresql"
          ? "PostgreSQL متصل"
          : "Sandbox · الذاكرة غير دائمة"}
      </div>
    </aside>
  );
}

function WorldStatus({
  world,
}: {
  world: Awaited<ReturnType<typeof fetchWorld>>;
}) {
  return (
    <div className="world-status">
      <span>
        <Waves size={14} /> العالم: {world.nameAr}
      </span>
      <i />
      <span>Seed: {world.seed.slice(0, 13)}…</span>
      <i />
      <span>Tick {world.currentTick.toLocaleString("ar")}</span>
    </div>
  );
}

function LayerPicker() {
  const layer = useWorldStore((state) => state.layer);
  const setLayer = useWorldStore((state) => state.setLayer);
  const quality = useWorldStore((state) => state.quality);
  const setQuality = useWorldStore((state) => state.setQuality);
  return (
    <div className="layer-picker glass-panel">
      <div className="layer-buttons">
        {layerOptions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={layer === item.id ? "active" : ""}
              onClick={() => setLayer(item.id)}
              title={item.label}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <label>
        <Settings2 size={15} />
        <select
          value={quality}
          onChange={(event) =>
            setQuality(event.target.value as typeof quality)
          }
        >
          <option value="ultra">فائقة</option>
          <option value="high">عالية</option>
          <option value="medium">متوسطة</option>
          <option value="power-saver">توفير الطاقة</option>
        </select>
      </label>
    </div>
  );
}

function SelectedRegionCard() {
  const region = useWorldStore((state) => state.selectedRegion);
  const setSelected = useWorldStore((state) => state.setSelectedRegion);
  if (!region) {
    return (
      <div className="region-hint">
        <CircleDot size={15} /> انقر على أي خلية لعرض بياناتها الحقيقية
      </div>
    );
  }
  return (
    <div className="selected-region glass-panel">
      <button onClick={() => setSelected(null)} aria-label="إغلاق">
        <X size={15} />
      </button>
      <i className="biome-swatch" style={{ background: region.color }} />
      <div>
        <span>{region.biome}</span>
        <h3>{region.nameAr}</h3>
        <p>
          {region.temperature}°C · رطوبة {Math.round(region.moisture * 100)}% ·
          خصوبة {Math.round(region.fertility * 100)}%
        </p>
      </div>
    </div>
  );
}

function Timeline({
  world,
  events,
  isRunning,
  onAdvance,
}: {
  world: Awaited<ReturnType<typeof fetchWorld>>;
  events: WorldEvent[];
  isRunning: boolean;
  onAdvance: (count: number) => void;
}) {
  const timeline = [...events].reverse().slice(-9);
  return (
    <section className="timeline glass-panel" aria-label="الخط الزمني">
      <div className="timeline-controls">
        <span className="timeline-label">خط الزمن</span>
        <button
          className="play-button"
          onClick={() => onAdvance(10)}
          disabled={isRunning}
          aria-label="تقديم عشر سنوات"
        >
          {isRunning ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <button onClick={() => onAdvance(1)} disabled={isRunning}>
          <FastForward size={16} /> +1
        </button>
        <div className="current-year">
          <small>السنة الحالية</small>
          <b>{formatYear(world.currentYear)}</b>
        </div>
      </div>
      <div className="timeline-events">
        <div className="timeline-line" />
        {timeline.map((event, index) => (
          <button
            key={event.id}
            className={index === timeline.length - 1 ? "current" : ""}
          >
            <i>{eventIcon(event.type)}</i>
            <span>
              <small>{formatYear(event.year)}</small>
              <b>{eventTitle(event.type)}</b>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LoadingScreen() {
  return (
    <main className="full-screen-state">
      <span className="loading-planet">
        <Globe2 size={44} />
      </span>
      <h1>يُعاد توليد العالم من الـSeed</h1>
      <p>تحميل التضاريس والأقاليم والأحداث السببية…</p>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="full-screen-state error">
      <Biohazard size={42} />
      <h1>تعذر الاتصال بمحرك العالم</h1>
      <p>{message}</p>
      <code>pnpm dev:api</code>
    </main>
  );
}

function eventIcon(type: string) {
  const props = { size: 16 };
  if (type.includes("WAR")) return <Swords {...props} />;
  if (type.includes("CLIMATE")) return <CloudLightning {...props} />;
  if (type.includes("SPECIES")) return <Dna {...props} />;
  if (type.includes("PLANT")) return <Leaf {...props} />;
  if (type.includes("CIVILIZATION")) return <Users {...props} />;
  if (type.includes("POLLUTION")) return <Factory {...props} />;
  if (type.includes("CONTRIBUTION")) return <Sparkles {...props} />;
  return <Activity {...props} />;
}

function eventTitle(type: string): string {
  return (
    {
      WORLD_CREATED: "نشأة العالم",
      CLIMATE_CHANGED: "تغير مناخي",
      CONTRIBUTION_ADDED: "مساهمة جديدة",
      PLANT_SPREAD: "انتشار نبات",
      POLLUTION_CHANGED: "تغير مستوى التلوث",
      SPECIES_CREATED: "ظهور مخلوق",
      SPECIES_EXTINCT: "انقراض نوع",
      CIVILIZATION_FOUNDED: "نشأة حضارة",
      TECHNOLOGY_DISCOVERED: "اكتشاف تقنية",
      WAR_STARTED: "اندلاع حرب",
      ALLIANCE_CREATED: "تشكّل تحالف",
      MIGRATION_STARTED: "هجرة جماعية",
      DISEASE_OUTBREAK: "تفشي مرض",
      VOLCANO_ERUPTED: "ثوران بركاني",
    }[type] ?? type.replaceAll("_", " ")
  );
}

function causeLabel(cause: string): string {
  return (
    {
      procedural_generation_from_seed: "توليد إجرائي حتمي من Seed ثابت.",
      seasonal_climate_oscillation: "دورة مناخية موسمية محسوبة.",
      seasonal_cycle_and_volcanic_activity: "تداخل موسمي مع نشاط بركاني.",
      user_confirmed_balanced_contribution: "إضافة مستخدم اجتازت التوازن والتحقق.",
      habitat_suitability_and_seed_dispersal: "ملاءمة الموطن وانتقال البذور.",
      contribution_pollution_absorption: "امتصاص التلوث بواسطة مساهمة نشطة.",
    }[cause] ?? cause.replaceAll("_", " ")
  );
}

function eventTone(type: string) {
  if (type.includes("WAR") || type.includes("EXTINCT")) return "danger";
  if (type.includes("CLIMATE") || type.includes("VOLCANO")) return "warning";
  if (type.includes("PLANT") || type.includes("SPECIES")) return "life";
  if (type.includes("CIVILIZATION")) return "gold";
  return "tech";
}

function formatYear(year: number) {
  return year < 0
    ? `${Math.abs(year).toLocaleString("ar")} ق.ح`
    : year.toLocaleString("ar");
}

const PackageOpenIcon = CircleDot;
const LandmarkIcon = Network;
