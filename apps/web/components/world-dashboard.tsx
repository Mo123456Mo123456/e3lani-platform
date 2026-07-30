"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  CircleGauge,
  CloudRain,
  Dna,
  Flame,
  Globe2,
  Languages,
  Leaf,
  LogIn,
  MapPin,
  Menu,
  Orbit,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  ThermometerSun,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import type { RealtimeDelta, RegionSummary, WorldEvent } from "@living-planet/shared-types";
import { AuthDialog } from "@/components/auth-dialog";
import { ContributionWizard } from "@/components/contribution-wizard";
import { planetApi, WS_URL } from "@/lib/api";
import { useWorldStore, type GlobeLayer } from "@/lib/store";

const PlanetGlobe = dynamic(() => import("./planet-globe").then((module) => module.PlanetGlobe), {
  ssr: false,
  loading: () => <div className="globe-loading"><Orbit className="spin" /><span>تهيئة محرك WebGL…</span></div>,
});

const nav = [
  ["الرئيسية", "Home"],
  ["استكشف", "Explore"],
  ["الحضارات", "Civilizations"],
  ["المخلوقات", "Creatures"],
  ["الموارد", "Resources"],
  ["التقنيات", "Technologies"],
  ["التحالفات", "Alliances"],
  ["الخط الزمني", "Timeline"],
];

const layerOptions: Array<{ id: GlobeLayer; ar: string; en: string; icon: typeof Globe2 }> = [
  { id: "surface", ar: "السطح", en: "Surface", icon: Globe2 },
  { id: "biome", ar: "الأقاليم", en: "Biomes", icon: Leaf },
  { id: "weather", ar: "الرطوبة", en: "Moisture", icon: CloudRain },
  { id: "pollution", ar: "التلوث", en: "Pollution", icon: Flame },
  { id: "temperature", ar: "الحرارة", en: "Temperature", icon: ThermometerSun },
];

function eventAppearance(type: string): { icon: typeof Activity; color: string } {
  if (type.includes("WAR")) return { icon: Shield, color: "#ff584d" };
  if (type.includes("CLIMATE") || type.includes("VOLCANO")) return { icon: CloudRain, color: "#43cfe8" };
  if (type.includes("SPECIES")) return { icon: Dna, color: "#40dc8a" };
  if (type.includes("TECHNOLOGY")) return { icon: Zap, color: "#f8bd4a" };
  if (type.includes("MIGRATION")) return { icon: Users, color: "#ba78ff" };
  return { icon: Sparkles, color: "#5be0ff" };
}

function formatPopulation(value: number, locale: "ar" | "en") {
  return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function EventFeed({ events, locale, onLocate }: { events: WorldEvent[]; locale: "ar" | "en"; onLocate(event: WorldEvent): void }) {
  const ar = locale === "ar";
  return (
    <aside className="panel event-panel">
      <header className="panel-header">
        <div><Activity size={17} /><h2>{ar ? "سجل الأحداث" : "World events"}</h2></div>
        <span className="live-pill"><i /> {ar ? "مباشر" : "Live"}</span>
      </header>
      <div className="event-list">
        {events.slice(0, 9).map((event) => {
          const appearance = eventAppearance(event.type);
          const Icon = appearance.icon;
          return (
            <button className="event-item" key={event.id} onClick={() => onLocate(event)}>
              <span className="event-icon" style={{ "--event-color": appearance.color } as React.CSSProperties}><Icon size={19} /></span>
              <span className="event-content">
                <b>{event.title}</b>
                <small>{event.summary}</small>
                <em><MapPin size={11} /> {ar ? `السنة ${event.year}` : `Year ${event.year}`} · {Math.round(event.importance * 100)}%</em>
              </span>
            </button>
          );
        })}
      </div>
      <button className="panel-footer-button">{ar ? "عرض سجل العالم" : "Open world history"}</button>
    </aside>
  );
}

function ContributionPanel({
  locale,
  metrics,
  onAdd,
}: {
  locale: "ar" | "en";
  metrics: { population: number; biodiversity: number; civilizations: number };
  onAdd(): void;
}) {
  const ar = locale === "ar";
  return (
    <aside className="panel contribution-panel">
      <div className="contribution-hero">
        <p className="eyebrow">{ar ? "قرار واحد، تاريخ ممتد" : "One choice, lasting history"}</p>
        <h2>{ar ? "أضف عنصرًا واحدًا إلى العالم" : "Add one element to the world"}</h2>
        <p>{ar ? "سيحلله النظام ويوازن خصائصه قبل تشغيل المحاكاة السببية." : "The system analyzes and balances it before causal simulation."}</p>
        <button className="add-world-button" onClick={onAdd}><Plus size={25} /><span>{ar ? "ابدأ الإضافة" : "Start adding"}</span></button>
      </div>
      <div className="mini-category-grid">
        {[["مخلوق", "Creature", Dna], ["نبات", "Plant", Leaf], ["مورد", "Resource", Waves], ["حضارة", "Civilization", Users], ["اختراع", "Invention", Zap], ["ظاهرة", "Phenomenon", CloudRain]].map(([arLabel, enLabel, Icon]) => {
          const Glyph = Icon as typeof Dna;
          return <button key={arLabel as string} onClick={onAdd}><Glyph size={17} /><span>{ar ? arLabel as string : enLabel as string}</span></button>;
        })}
      </div>
      <section className="world-impact">
        <header><Globe2 size={16} /><b>{ar ? "حالة العالم الآن" : "World now"}</b></header>
        <div className="world-stat-grid">
          <div><Users size={15} /><b>{formatPopulation(metrics.population, locale)}</b><small>{ar ? "السكان" : "Population"}</small></div>
          <div><Leaf size={15} /><b>{Math.round(metrics.biodiversity * 100)}%</b><small>{ar ? "التنوع" : "Biodiversity"}</small></div>
          <div><Shield size={15} /><b>{metrics.civilizations}</b><small>{ar ? "حضارة" : "Civilizations"}</small></div>
        </div>
      </section>
      <div className="feature-status">
        <i /> {ar ? "خريطة أثر المستخدم تُفعّل بعد أول مساهمة." : "Your impact map activates after the first contribution."}
      </div>
    </aside>
  );
}

function Timeline({ events, currentYear, locale }: { events: WorldEvent[]; currentYear: number; locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const ordered = [...events].sort((left, right) => left.year - right.year).slice(-8);
  return (
    <section className="timeline-panel">
      <header>
        <div><CircleGauge size={16} /><b>{ar ? "الخط الزمني" : "Timeline"}</b><span>{ar ? `السنة ${currentYear}` : `Year ${currentYear}`}</span></div>
        <div className="timeline-actions">
          <button disabled title={ar ? "التشغيل التاريخي يتطلب Snapshot متاحًا" : "Historical playback requires an available snapshot"}>{ar ? "تشغيل التاريخ" : "Play history"}</button>
          <button disabled>{ar ? "مقارنة حقبتين" : "Compare eras"}</button>
        </div>
      </header>
      <div className="timeline-track">
        <span className="timeline-line" />
        {ordered.map((event, index) => {
          const appearance = eventAppearance(event.type);
          const Icon = appearance.icon;
          return (
            <article key={event.id} className={index === ordered.length - 1 ? "current" : ""}>
              <i style={{ "--event-color": appearance.color } as React.CSSProperties}><Icon size={13} /></i>
              <b>{ar ? `سنة ${event.year}` : `Year ${event.year}`}</b>
              <span>{event.title}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function WorldDashboard() {
  const queryClient = useQueryClient();
  const locale = useWorldStore((state) => state.locale);
  const setLocale = useWorldStore((state) => state.setLocale);
  const layer = useWorldStore((state) => state.layer);
  const setLayer = useWorldStore((state) => state.setLayer);
  const quality = useWorldStore((state) => state.quality);
  const setQuality = useWorldStore((state) => state.setQuality);
  const selectedRegion = useWorldStore((state) => state.selectedRegion);
  const selectRegion = useWorldStore((state) => state.selectRegion);
  const user = useWorldStore((state) => state.user);
  const setUser = useWorldStore((state) => state.setUser);
  const setAuthOpen = useWorldStore((state) => state.setAuthOpen);
  const setWizardOpen = useWorldStore((state) => state.setWizardOpen);
  const [mobileMenu, setMobileMenu] = useState(false);
  const ar = locale === "ar";

  const world = useQuery({
    queryKey: ["planet-bootstrap"],
    queryFn: planetApi.bootstrap,
  });

  useEffect(() => {
    planetApi.refresh().then(setUser).catch(() => undefined);
  }, [setUser]);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onmessage = (message) => {
        const delta = JSON.parse(String(message.data)) as RealtimeDelta;
        if (delta.kind === "event.created" || delta.kind === "region.updated") {
          void queryClient.invalidateQueries({ queryKey: ["planet-bootstrap"] });
        }
      };
      socket.onclose = () => {
        if (!disposed) reconnect = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (reconnect) clearTimeout(reconnect);
      socket?.close();
    };
  }, [queryClient]);

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    if (cores <= 4 || memory <= 4) setQuality("medium");
  }, [setQuality]);

  const locateEvent = (event: WorldEvent) => {
    const region = world.data?.regions.find((candidate) => candidate.id === event.regionId);
    if (region) selectRegion(region);
  };

  const selectedEvents = useMemo(
    () => world.data?.events.filter((event) => event.regionId === selectedRegion?.id).slice(0, 3) ?? [],
    [world.data?.events, selectedRegion?.id],
  );

  if (world.isPending) {
    return <main className="boot-screen"><Orbit className="spin" /><h1>كوكب يولد أمامك</h1><p>جارٍ استعادة حالة العالم من سجل الأحداث…</p></main>;
  }
  if (world.isError || !world.data) {
    return (
      <main className="boot-screen error-screen">
        <Flame />
        <h1>{ar ? "تعذر الاتصال بمحرك العالم" : "World engine unavailable"}</h1>
        <p>{world.error instanceof Error ? world.error.message : "API unavailable"}</p>
        <button className="primary-button" onClick={() => world.refetch()}>{ar ? "إعادة المحاولة" : "Retry"}</button>
      </main>
    );
  }

  const data = world.data;
  return (
    <main className="world-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-planet"><Globe2 size={25} /></span>
          <span><b>{ar ? "كوكب يولد أمامك" : "A Planet Born Before You"}</b><small>{ar ? "عالمك، قرارك، أثر لا ينتهي." : "Your world. Your choice. Endless impact."}</small></span>
        </a>
        <nav className={mobileMenu ? "open" : ""}>
          {nav.map(([arabic, english], index) => <a key={english} className={index === 0 ? "active" : ""} href="#">{ar ? arabic : english}</a>)}
        </nav>
        <div className="top-actions">
          <button className="icon-button"><Search size={17} /></button>
          <button className="icon-button"><Bell size={17} /><i className="notification-dot" /></button>
          <button className="language-button" onClick={() => setLocale(ar ? "en" : "ar")}><Languages size={16} /> {ar ? "EN" : "ع"}</button>
          {user ? (
            <button className="user-button"><span>{user.displayName.slice(0, 1)}</span><small>{user.displayName}</small></button>
          ) : (
            <button className="login-button" onClick={() => setAuthOpen(true)}><LogIn size={16} /> {ar ? "دخول" : "Sign in"}</button>
          )}
          <button className="icon-button mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </header>

      <section className="world-stage">
        <EventFeed events={data.events} locale={locale} onLocate={locateEvent} />
        <div className="globe-stage">
          <div className="world-title">
            <span className="status-dot" />
            <div><small>{ar ? "الكوكب الحي" : "Living planet"}</small><b>{data.planet.name}</b></div>
            <em>{ar ? `السنة ${data.planet.currentYear}` : `Year ${data.planet.currentYear}`}</em>
          </div>
          <div className="globe-canvas">
            <PlanetGlobe
              regions={data.regions}
              events={data.events}
              layer={layer}
              quality={quality}
              onSelect={selectRegion}
            />
          </div>
          <div className="layer-bar">
            {layerOptions.map((option) => {
              const Icon = option.icon;
              return <button key={option.id} className={layer === option.id ? "active" : ""} onClick={() => setLayer(option.id)}><Icon size={15} /><span>{ar ? option.ar : option.en}</span></button>;
            })}
          </div>
          <label className="quality-control"><Settings2 size={14} /><select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
            <option value="ultra">{ar ? "فائقة" : "Ultra"}</option>
            <option value="high">{ar ? "عالية" : "High"}</option>
            <option value="medium">{ar ? "متوسطة" : "Medium"}</option>
            <option value="eco">{ar ? "توفير الطاقة" : "Eco"}</option>
          </select></label>
          {selectedRegion && (
            <article className="region-card">
              <button onClick={() => selectRegion(null)}><X size={15} /></button>
              <p className="eyebrow">{ar ? "بيانات المنطقة" : "Region data"}</p>
              <h3><MapPin size={17} /> {selectedRegion.name}</h3>
              <div>
                <span><ThermometerSun size={14} /> {ar ? "الحرارة" : "Temperature"} <b>{Math.round(selectedRegion.temperature * 100)}%</b></span>
                <span><Waves size={14} /> {ar ? "الرطوبة" : "Moisture"} <b>{Math.round(selectedRegion.moisture * 100)}%</b></span>
                <span><Leaf size={14} /> {ar ? "الخصوبة" : "Fertility"} <b>{Math.round(selectedRegion.fertility * 100)}%</b></span>
                <span><Users size={14} /> {ar ? "السكان" : "Population"} <b>{formatPopulation(selectedRegion.population, locale)}</b></span>
              </div>
              <footer><span>{selectedRegion.biome}</span><small>{selectedEvents.length ? `${selectedEvents.length} ${ar ? "أحداث حديثة" : "recent events"}` : (ar ? "لا أحداث حديثة" : "No recent events")}</small></footer>
            </article>
          )}
        </div>
        <ContributionPanel
          locale={locale}
          metrics={data.metrics}
          onAdd={() => user ? setWizardOpen(true) : setAuthOpen(true)}
        />
      </section>

      <Timeline events={data.events} currentYear={data.planet.currentYear} locale={locale} />
      <AuthDialog />
      <ContributionWizard
        regions={data.regions}
        onComplete={() => void queryClient.invalidateQueries({ queryKey: ["planet-bootstrap"] })}
      />
    </main>
  );
}
