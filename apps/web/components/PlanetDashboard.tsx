"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import {
  ApiClientError,
  authApi,
  getApiBaseUrl,
  getApiMode,
  worldApi,
} from "../lib/api";
import { getCopy, interpolate } from "../lib/i18n";
import { useUIStore } from "../lib/store";
import type {
  AuthUser,
  EventKind,
  Language,
  Quality,
  Region,
  TimelinePoint,
  WorldEvent,
} from "../lib/types";
import { formatCompactNumber, formatEventTime } from "../lib/world";
import { AuthGate } from "./AuthGate";
import { ContributionModal } from "./ContributionModal";
import { Icon, type IconName } from "./Icon";

const PlanetExperience = dynamic(
  () => import("./PlanetExperience").then((module) => module.PlanetExperience),
  {
    ssr: false,
    loading: () => (
      <div className="planet-loading">
        <span className="planet-loader" />
      </div>
    ),
  },
);

const EVENT_ICONS: Record<EventKind, IconName> = {
  climate: "climate",
  energy: "energy",
  water: "water",
  community: "community",
};

const QUALITY_KEYS: Record<
  Quality,
  "qualityHigh" | "qualityMedium" | "qualityEco"
> = {
  high: "qualityHigh",
  medium: "qualityMedium",
  eco: "qualityEco",
};

function Timeline({
  points,
  language,
}: {
  points: TimelinePoint[];
  language: Language;
}) {
  const t = getCopy(language);
  const coordinates = points.map((point, index) => {
    const x =
      points.length > 1 ? 20 + (index / (points.length - 1)) * 960 : 500;
    const y = 98 - ((point.vitality - 55) / 45) * 76;
    return { ...point, x, y: Math.max(14, Math.min(100, y)) };
  });
  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${line} L ${coordinates.at(-1)?.x ?? 20} 108 L 20 108 Z`;

  return (
    <section className="timeline-panel" aria-labelledby="timeline-title">
      <header>
        <div>
          <span className="eyebrow">{t.projected}</span>
          <h2 id="timeline-title">{t.timeline}</h2>
        </div>
        <p>{t.timelineHint}</p>
        <div className="timeline-legend">
          <span>
            <i className="legend-present" />
            {t.present}
          </span>
          <span>
            <i className="legend-projected" />
            {t.projected}
          </span>
        </div>
      </header>
      <div className="timeline-chart">
        <svg
          aria-label={`${t.timeline}: ${points[0]?.year ?? ""}–${
            points.at(-1)?.year ?? ""
          }`}
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 1000 112"
        >
          <defs>
            <linearGradient id="timeline-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#62f5c4" stopOpacity=".3" />
              <stop offset="100%" stopColor="#62f5c4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="timeline-line" x1="0" x2="1">
              <stop offset="0%" stopColor="#27b99c" />
              <stop offset="52%" stopColor="#72ffd0" />
              <stop offset="100%" stopColor="#d6ff79" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#timeline-fill)" />
          <path
            d={line}
            fill="none"
            stroke="url(#timeline-line)"
            strokeLinecap="round"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          {coordinates.map((point, index) => (
            <g key={point.year}>
              {point.label && (
                <line
                  stroke="#65e4bf"
                  strokeDasharray="3 5"
                  strokeOpacity=".45"
                  x1={point.x}
                  x2={point.x}
                  y1="5"
                  y2="108"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                fill={index === coordinates.length - 1 ? "#dfff7d" : "#071a17"}
                r={point.label ? 5 : 3}
                stroke="#8affd8"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {point.year}: {t.vitality} {point.vitality}%
                </title>
              </circle>
            </g>
          ))}
        </svg>
        <div className="timeline-years" aria-hidden="true">
          {coordinates
            .filter(
              (_, index) =>
                index === 0 ||
                index === coordinates.length - 1 ||
                index === Math.floor(coordinates.length / 2),
            )
            .map((point) => (
              <span key={point.year}>{point.year}</span>
            ))}
        </div>
      </div>
    </section>
  );
}

function EventCard({
  event,
  language,
  onSelect,
}: {
  event: WorldEvent;
  language: Language;
  onSelect: (regionId: string) => void;
}) {
  const t = getCopy(language);
  const categoryKey = `event${
    event.kind.charAt(0).toUpperCase() + event.kind.slice(1)
  }` as "eventClimate" | "eventEnergy" | "eventWater" | "eventCommunity";

  return (
    <article className={`event-card event-${event.kind}`}>
      <div className="event-icon">
        <Icon name={EVENT_ICONS[event.kind]} />
      </div>
      <div>
        <span className="event-meta">
          <b>{t[categoryKey]}</b>
          <time dateTime={event.occurredAt}>
            {formatEventTime(event.occurredAt, language)}
          </time>
        </span>
        <h3>{event.title[language]}</h3>
        <p>{event.description[language]}</p>
        <button onClick={() => onSelect(event.regionId)} type="button">
          {t.inspectEvent}
          <Icon name="arrow" size={14} />
        </button>
      </div>
    </article>
  );
}

function RegionSummary({
  region,
  language,
}: {
  region: Region | undefined;
  language: Language;
}) {
  const t = getCopy(language);
  if (!region) {
    return <p className="region-empty">{t.chooseOnGlobe}</p>;
  }
  return (
    <div className="region-summary">
      <div className="region-name">
        <i style={{ background: region.accentColor }} />
        <div>
          <small>{t.selectedRegion}</small>
          <strong>{region.name[language]}</strong>
        </div>
      </div>
      <div className="region-stats">
        <span>
          <small>{t.vitality}</small>
          <strong>{region.vitality}%</strong>
        </span>
        <span>
          <small>{t.stability}</small>
          <strong>{region.stability}%</strong>
        </span>
      </div>
    </div>
  );
}

export function PlanetDashboard() {
  const queryClient = useQueryClient();
  const language = useUIStore((state) => state.language);
  const quality = useUIStore((state) => state.quality);
  const selectedRegionId = useUIStore((state) => state.selectedRegionId);
  const highlightedRegionId = useUIStore((state) => state.highlightedRegionId);
  const contributionOpen = useUIStore((state) => state.contributionOpen);
  const successMessage = useUIStore((state) => state.successMessage);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const setQuality = useUIStore((state) => state.setQuality);
  const selectRegion = useUIStore((state) => state.selectRegion);
  const highlightRegion = useUIStore((state) => state.highlightRegion);
  const setContributionOpen = useUIStore((state) => state.setContributionOpen);
  const setSuccessMessage = useUIStore((state) => state.setSuccessMessage);
  const [isOnline, setIsOnline] = useState(true);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [realtimeState, setRealtimeState] = useState<
    "idle" | "connecting" | "connected" | "polling" | "local"
  >("idle");
  const t = getCopy(language);

  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });
  const authenticated = Boolean(authQuery.data);
  const worldQuery = useQuery({
    queryKey: ["world"],
    queryFn: worldApi.getWorld,
    enabled: authenticated,
    refetchInterval: realtimeState === "polling" ? 30_000 : false,
  });
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: worldApi.getEvents,
    enabled: authenticated,
    refetchInterval: realtimeState === "polling" ? 30_000 : false,
  });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["world"] });
      queryClient.removeQueries({ queryKey: ["events"] });
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
    },
  });

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    const planetId = worldQuery.data?.id;
    if (!authQuery.data || !planetId) return;
    if (getApiMode() === "sandbox") {
      setRealtimeState("local");
      return;
    }
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
      setRealtimeState("polling");
      return;
    }

    let disposed = false;
    setRealtimeState("connecting");
    const websocketBase = baseUrl.replace(/^http/, "ws");
    const socket = new WebSocket(
      `${websocketBase}/ws?planetId=${encodeURIComponent(planetId)}`,
    );
    const fallbackTimer = window.setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        setRealtimeState("polling");
        socket.close();
      }
    }, 5_000);

    socket.addEventListener("open", () => {
      window.clearTimeout(fallbackTimer);
      setRealtimeState("connected");
    });
    socket.addEventListener("message", () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["world"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
    });
    socket.addEventListener("error", () => {
      if (!disposed) setRealtimeState("polling");
    });
    socket.addEventListener("close", () => {
      window.clearTimeout(fallbackTimer);
      if (!disposed) setRealtimeState("polling");
    });

    return () => {
      disposed = true;
      window.clearTimeout(fallbackTimer);
      socket.close();
    };
  }, [authQuery.data, queryClient, worldQuery.data?.id]);

  useEffect(() => {
    const error = worldQuery.error ?? eventsQuery.error;
    if (error instanceof ApiClientError && error.status === 401) {
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
    }
  }, [eventsQuery.error, queryClient, worldQuery.error]);

  useEffect(() => {
    const regions = worldQuery.data?.regions;
    const firstRegion = regions?.[0];
    if (
      firstRegion &&
      !regions.some((region) => region.id === selectedRegionId)
    ) {
      selectRegion(firstRegion.id);
    }
  }, [selectRegion, selectedRegionId, worldQuery.data?.regions]);

  useEffect(() => {
    if (!highlightedRegionId) return;
    const timer = window.setTimeout(() => highlightRegion(null), 9_000);
    return () => window.clearTimeout(timer);
  }, [highlightRegion, highlightedRegionId]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 7_000);
    return () => window.clearTimeout(timer);
  }, [setSuccessMessage, successMessage]);

  const world = worldQuery.data;
  const events = eventsQuery.data ?? [];
  const selectedRegion = useMemo(
    () =>
      world?.regions.find((region) => region.id === selectedRegionId) ??
      world?.regions[0],
    [selectedRegionId, world?.regions],
  );
  const mode = getApiMode();
  const modeLabel =
    mode === "sandbox"
      ? t.sandbox
      : mode === "production"
        ? t.production
        : t.misconfigured;

  const handleContributionSuccess = async (result: {
    affectedRegionId: string;
    message: Record<Language, string>;
  }) => {
    selectRegion(result.affectedRegionId);
    highlightRegion(result.affectedRegionId);
    setSuccessMessage(result.message[language] || t.contributionSuccess);
    setContributionOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["world"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
    ]);
  };

  const selectAndAnnounce = (regionId: string) => {
    selectRegion(regionId);
    const region = world?.regions.find((item) => item.id === regionId);
    if (region) {
      const announcement = interpolate(t.regionSelectedAnnouncement, {
        region: region.name[language],
      });
      const liveRegion = document.getElementById("selection-announcement");
      if (liveRegion) liveRegion.textContent = announcement;
    }
  };

  if (authQuery.isPending) {
    return (
      <AuthGate
        checking
        language={language}
        onAuthenticated={(user) =>
          queryClient.setQueryData(["auth", "me"], user)
        }
        onLanguageChange={setLanguage}
      />
    );
  }

  if (!authQuery.data) {
    const showError =
      authQuery.error instanceof ApiClientError &&
      authQuery.error.status === 401
        ? undefined
        : authQuery.error?.message;
    return (
      <AuthGate
        initialError={showError}
        language={language}
        onAuthenticated={(user: AuthUser) =>
          queryClient.setQueryData(["auth", "me"], user)
        }
        onLanguageChange={setLanguage}
      />
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t.skipToContent}
      </a>
      <header className="topbar">
        <a aria-label={t.brand} className="brand" href="#main-content">
          <span className="brand-orbit" aria-hidden="true">
            <i />
          </span>
          <span>
            <strong>{t.brand}</strong>
            <small>{t.brandEyebrow}</small>
          </span>
        </a>

        <nav
          aria-label={t.primaryNavigation}
          className={`main-nav ${mobileNavOpen ? "is-open" : ""}`}
        >
          <a className="is-active" href="#planet">
            {t.navWorld}
          </a>
          <a href="#timeline">{t.navScenarios}</a>
          <a href="#events">{t.navCommons}</a>
          <a href="#contribute">{t.navResearch}</a>
        </nav>

        <div className="topbar-actions">
          <button
            className="account-button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            title={t.signOut}
            type="button"
          >
            <span>{authQuery.data.displayName.slice(0, 1).toUpperCase()}</span>
            <small>{authQuery.data.displayName}</small>
          </button>
          <div className="mode-status" title={modeLabel}>
            <i
              className={
                !isOnline
                  ? "is-offline"
                  : mode === "misconfigured"
                    ? "is-warning"
                    : ""
              }
            />
            <span>{!isOnline ? t.offline : modeLabel}</span>
          </div>
          <div className="quality-control">
            <button
              aria-expanded={qualityOpen}
              aria-label={t.openQuality}
              className="topbar-icon-button"
              onClick={() => setQualityOpen((open) => !open)}
              type="button"
            >
              <Icon name="quality" size={18} />
            </button>
            {qualityOpen && (
              <div className="quality-menu">
                <span>{t.quality}</span>
                {(["high", "medium", "eco"] as Quality[]).map((option) => (
                  <button
                    aria-pressed={quality === option}
                    className={quality === option ? "is-active" : ""}
                    key={option}
                    onClick={() => {
                      setQuality(option);
                      setQualityOpen(false);
                    }}
                    type="button"
                  >
                    {t[QUALITY_KEYS[option]]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="language-button"
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            type="button"
          >
            <Icon name="language" size={17} />
            {t.language}
          </button>
          <button
            aria-expanded={mobileNavOpen}
            aria-label={t.openMenu}
            className="mobile-menu-button"
            onClick={() => setMobileNavOpen((open) => !open)}
            type="button"
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      <main id="main-content">
        <div className="dashboard-grid">
          <aside className="events-panel glass-panel" id="events">
            <header className="panel-heading">
              <div>
                <span className="eyebrow">
                  <i className="live-dot" />
                  {t.liveNow}
                </span>
                <h2>{t.liveEvents}</h2>
              </div>
              <span className="event-count">{events.length}</span>
            </header>
            <p className="panel-intro">{t.eventsHint}</p>
            <div className="event-list">
              {eventsQuery.isLoading &&
                Array.from({ length: 4 }, (_, index) => (
                  <div className="event-skeleton" key={index}>
                    <i />
                    <span />
                    <span />
                  </div>
                ))}
              {eventsQuery.isError && (
                <div className="compact-error" role="alert">
                  <strong>{t.worldError}</strong>
                  <button onClick={() => eventsQuery.refetch()} type="button">
                    {t.retry}
                  </button>
                </div>
              )}
              {events.map((event) => (
                <EventCard
                  event={event}
                  key={event.id}
                  language={language}
                  onSelect={selectAndAnnounce}
                />
              ))}
            </div>
          </aside>

          <section className="planet-panel" id="planet">
            <header className="planet-heading">
              <div>
                <span className="eyebrow">
                  <Icon name="globe" size={14} />
                  {t.livingPlanet}
                </span>
                <h1>{t.worldTitle}</h1>
                <p>{t.worldSubtitle}</p>
              </div>
              {world && (
                <div className="cycle-chip">
                  <span>{t.cycle}</span>
                  <strong>#{world.cycle}</strong>
                </div>
              )}
              <div className="scene-mode-chip" title={modeLabel}>
                <i
                  className={
                    !isOnline
                      ? "is-offline"
                      : mode === "misconfigured"
                        ? "is-warning"
                        : ""
                  }
                />
                <span>{!isOnline ? t.offline : modeLabel}</span>
              </div>
            </header>

            <div className="planet-stage">
              {worldQuery.isLoading && (
                <div className="planet-loading">
                  <span className="planet-loader" />
                  <p>{t.worldLoading}</p>
                </div>
              )}
              {worldQuery.isError && (
                <div className="planet-error" role="alert">
                  <span className="broken-orbit" />
                  <h2>{t.worldError}</h2>
                  <p>{worldQuery.error.message}</p>
                  <small>{t.noSynthetic}</small>
                  <button onClick={() => worldQuery.refetch()} type="button">
                    {t.retry}
                  </button>
                </div>
              )}
              {world && (
                <PlanetExperience
                  ariaLabel={t.canvasLabel}
                  events={events}
                  highlightedRegionId={highlightedRegionId}
                  language={language}
                  onSelectRegion={selectAndAnnounce}
                  quality={quality}
                  regions={world.regions}
                  selectedRegionId={selectedRegion?.id ?? null}
                />
              )}
              {world && (
                <>
                  <div className="planet-metric metric-vitality">
                    <small>{t.globalPulse}</small>
                    <strong>{world.vitality}%</strong>
                    <span>+2.4%</span>
                  </div>
                  <div className="planet-metric metric-temperature">
                    <small>{t.temperature}</small>
                    <strong>{world.temperature}°</strong>
                    <span>−0.08°</span>
                  </div>
                  <span className="interaction-hint">
                    <Icon name="activity" size={15} />
                    {t.rotateHint}
                  </span>
                </>
              )}
            </div>

            {world && (
              <div className="world-summary-strip">
                <div>
                  <span>{t.population}</span>
                  <strong>
                    {formatCompactNumber(world.population, language)}
                  </strong>
                </div>
                <div>
                  <span>{t.vitality}</span>
                  <strong>{world.vitality}%</strong>
                </div>
                <div>
                  <span>{t.cityNodes}</span>
                  <strong>
                    {world.regions.reduce(
                      (sum, region) => sum + region.cityLights,
                      0,
                    )}
                  </strong>
                </div>
              </div>
            )}
          </section>

          <aside className="contribution-panel glass-panel" id="contribute">
            <div className="contribution-visual" aria-hidden="true">
              <span className="idea-core">
                <Icon name="spark" size={27} />
              </span>
              <i className="orbit orbit-one" />
              <i className="orbit orbit-two" />
              <b />
              <b />
              <b />
            </div>
            <span className="eyebrow">{t.contributionEyebrow}</span>
            <h2>{t.contributionTitle}</h2>
            <p>{t.contributionText}</p>
            <RegionSummary region={selectedRegion} language={language} />
            <button
              className="contribution-cta"
              disabled={!world}
              onClick={() => setContributionOpen(true)}
              type="button"
            >
              <Icon name="plus" />
              <span>{t.startContribution}</span>
              <Icon name="arrow" size={17} />
            </button>
            <div className="community-stats">
              <span>
                <strong>1,284</strong>
                <small>{t.communityIdeas}</small>
              </span>
              <span>
                <strong>96</strong>
                <small>{t.simulationsToday}</small>
              </span>
            </div>
          </aside>
        </div>

        {world && (
          <div id="timeline">
            <Timeline language={language} points={world.timeline} />
          </div>
        )}
      </main>

      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        id="selection-announcement"
      />

      {successMessage && (
        <div className="success-toast" role="status">
          <span>
            <Icon name="spark" />
          </span>
          <div>
            <strong>{successMessage}</strong>
            <small>{t.viewImpact}</small>
          </div>
          <button
            aria-label={t.close}
            onClick={() => setSuccessMessage(null)}
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {contributionOpen && world && (
        <ContributionModal
          initialRegionId={selectedRegion?.id ?? null}
          language={language}
          onClose={() => setContributionOpen(false)}
          onSuccess={handleContributionSuccess}
          planetId={world.id}
          regions={world.regions}
        />
      )}
    </div>
  );
}
