"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { useEventsQuery, useImpactQuery, usePlanetQuery, useTimelineQuery } from "@/lib/queries";
import { useI18n } from "@/stores/locale-store";
import { usePlanetStore } from "@/stores/planet-store";
import type { ElementCategory, PlanetLayer, WorldEventDto } from "@/types/domain";
import { AppShell } from "@/components/ui/AppShell";
import { ErrorState } from "@/components/ui/Status";
import styles from "@/app/app.module.css";

const PlanetScene = dynamic(() => import("@/components/planet/PlanetScene"), {
  ssr: false,
  loading: () => <div className={styles.planetStage} />,
});

const visibleLayers: PlanetLayer[] = ["surface", "biome", "weather", "civilization", "resource", "conflict", "migration", "pollution"];

const impactCategories: Array<{ key: ElementCategory; icon: string; color: string }> = [
  { key: "plant", icon: "✽", color: "var(--green)" },
  { key: "creature", icon: "◇", color: "var(--cyan)" },
  { key: "civilization", icon: "▣", color: "var(--gold)" },
  { key: "resource", icon: "◆", color: "var(--cyan)" },
  { key: "technology", icon: "⌁", color: "var(--purple)" },
  { key: "disaster", icon: "▲", color: "var(--orange)" },
];

function formatRelative(date: string, locale: string) {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) {
    return date;
  }

  const diff = Math.round((timestamp - Date.now()) / 1000);
  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, seconds] of divisions) {
    if (Math.abs(diff) >= seconds) {
      return formatter.format(Math.round(diff / seconds), unit);
    }
  }

  return formatter.format(diff, "second");
}

function eventColor(event: WorldEventDto) {
  const type = event.type.toLowerCase();
  if (type.includes("war")) return "var(--red)";
  if (type.includes("migration")) return "var(--purple)";
  if (type.includes("volcano") || type.includes("disaster")) return "var(--orange)";
  if (type.includes("civil")) return "var(--gold)";
  if (type.includes("plant")) return "var(--green)";
  return "var(--cyan)";
}

function EventLog({ events, error, isLoading }: { events?: WorldEventDto[]; error: unknown; isLoading: boolean }) {
  const { locale, t } = useI18n();

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{t.dashboard.eventLog}</h2>
          <p className={styles.panelSubtitle}>{t.dashboard.liveFromApi}</p>
        </div>
        <span className={error ? styles.errorBadge : styles.successBadge}>{error ? t.states.offline : t.states.connected}</span>
      </div>

      {isLoading ? <p className={styles.hint}>{t.states.loading}</p> : null}
      {error ? <ErrorState error={error} compact /> : null}
      {!isLoading && !error && !events?.length ? <p className={styles.hint}>{t.dashboard.noEvents}</p> : null}

      <div className={styles.eventList}>
        {events?.slice(0, 12).map((event) => (
          <article key={event.id} className={styles.eventItem} style={{ "--marker": eventColor(event) } as React.CSSProperties}>
            <div className={styles.eventThumb}>{event.thumbnailUrl ? "▧" : "✦"}</div>
            <div>
              <h3>{locale === "ar" ? event.titleAr || event.title : event.title}</h3>
              <p>{locale === "ar" ? event.descriptionAr || event.description : event.description}</p>
              <div className={styles.eventMeta}>
                <span>{formatRelative(event.createdAt, locale)}</span>
                <span>•</span>
                <span>{Math.round((event.importance ?? 0) * 100)}%</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RightPanel() {
  const { t } = useI18n();
  const impact = useImpactQuery();

  return (
    <aside className={styles.rightStack}>
      <section className={styles.ctaCard}>
        <span className={styles.eyebrow}>{t.taglineEn}</span>
        <h2>{t.actions.addElement}</h2>
        <p className={styles.hint}>{t.contribute.subtitle}</p>
        <div className={styles.actionsRow}>
          <Link className={styles.button} href="/contribute">
            {t.actions.startContribution}
          </Link>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>{t.dashboard.categoryIcons}</h2>
            <p className={styles.panelSubtitle}>{t.dashboard.pwaInactive}</p>
          </div>
          <span className={styles.inactiveBadge}>{t.dashboard.inactive}</span>
        </div>
        <div className={styles.categoryGrid}>
          {impactCategories.map((category) => (
            <div key={category.key} className={styles.categoryPill} style={{ color: category.color }}>
              <span className={styles.categoryIcon}>{category.icon}</span>
              <span>{t.categories[category.key]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>{t.dashboard.impactStats}</h2>
            <p className={styles.panelSubtitle}>{t.dashboard.predictiveTeaser}</p>
          </div>
          <span className={styles.inactiveBadge}>{t.dashboard.inactive}</span>
        </div>
        {impact.error ? <ErrorState error={impact.error} compact /> : null}
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <strong>{impact.data?.elementsAdded ?? "—"}</strong>
            <span>{t.me.elementsAdded}</span>
          </div>
          <div className={styles.statCard}>
            <strong>{impact.data?.totalImpacts ?? "—"}</strong>
            <span>{t.me.totalImpacts}</span>
          </div>
          <div className={styles.statCard}>
            <strong>{impact.data?.evolutionDays ?? "—"}</strong>
            <span>{t.me.evolutionDays}</span>
          </div>
          <div className={styles.statCard}>
            <strong>{impact.data?.civilizationsAffected ?? "—"}</strong>
            <span>{t.me.civilizationsAffected}</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

function Timeline() {
  const { locale, t } = useI18n();
  const planet = usePlanetQuery();
  const timeline = useTimelineQuery(planet.data?.id);

  return (
    <section id="timeline" className={styles.timeline}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{t.dashboard.timeline}</h2>
          <p className={styles.panelSubtitle}>{t.dashboard.scrubberHint}</p>
        </div>
        {timeline.error ? <span className={styles.errorBadge}>{t.states.offline}</span> : <span className={styles.successBadge}>{t.states.connected}</span>}
      </div>
      {timeline.error ? <ErrorState error={timeline.error} compact /> : null}
      <div className={styles.timelineTrack}>
        {timeline.data?.length
          ? timeline.data.map((milestone) => (
              <article key={milestone.id} className={styles.milestone}>
                <span>Y{milestone.year ?? milestone.tick}</span>
                <strong>{locale === "ar" ? milestone.titleAr || milestone.title : milestone.title}</strong>
                {milestone.description ? <p className={styles.hint}>{locale === "ar" ? milestone.descriptionAr || milestone.description : milestone.description}</p> : null}
              </article>
            ))
          : !timeline.isLoading && !timeline.error
            ? [0, 1, 2].map((index) => (
                <article key={index} className={styles.milestone}>
                  <span>{t.states.empty}</span>
                  <strong>{t.dashboard.timeline}</strong>
                </article>
              ))
            : null}
      </div>
    </section>
  );
}

export function DashboardShell() {
  const { locale, t } = useI18n();
  const planet = usePlanetQuery();
  const events = useEventsQuery(planet.data?.id);
  const selectedRegionId = usePlanetStore((state) => state.selectedRegionId);
  const activeLayer = usePlanetStore((state) => state.activeLayer);
  const setActiveLayer = usePlanetStore((state) => state.setActiveLayer);
  const quality = usePlanetStore((state) => state.quality);
  const setQuality = usePlanetStore((state) => state.setQuality);

  const selectedRegion = useMemo(
    () => planet.data?.regions?.find((region) => region.id === selectedRegionId),
    [planet.data?.regions, selectedRegionId],
  );

  return (
    <AppShell notificationCount={events.data?.length ?? 0}>
      <div className={styles.dashboardGrid}>
        <EventLog events={events.data} error={events.error} isLoading={events.isLoading} />

        <section className={styles.heroPanel}>
          <div className={styles.heroHeader}>
            <div className={styles.heroTitle}>
              <span className={styles.eyebrow}>{t.taglineEn}</span>
              <h1>{t.brand}</h1>
              <p>{t.tagline}</p>
              {planet.error ? <ErrorState error={planet.error} compact /> : null}
            </div>
            <div className={styles.heroControls}>
              <label className={styles.field}>
                <span>{t.dashboard.activeLayer}</span>
                <select className={styles.select} value={activeLayer} onChange={(event) => setActiveLayer(event.target.value as PlanetLayer)}>
                  {visibleLayers.map((layer) => (
                    <option key={layer} value={layer}>
                      {t.layers[layer]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>{t.dashboard.quality}</span>
                <select className={styles.select} value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                  {(["ultra", "high", "medium", "power_saver"] as const).map((item) => (
                    <option key={item} value={item}>
                      {t.quality[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className={styles.planetStage}>
            {planet.isLoading ? <p className={styles.hint}>{t.dashboard.loadingPlanet}</p> : null}
            <PlanetScene planet={planet.data} events={events.data} />
          </div>

          <div className={styles.canvasOverlay}>
            <div className={styles.metricStrip}>
              <div className={styles.metric}>
                <strong>{planet.data?.pollution ?? "—"}%</strong>
                <span>{t.dashboard.pollution}</span>
              </div>
              <div className={styles.metric}>
                <strong>{planet.data?.biodiversity ?? "—"}%</strong>
                <span>{t.dashboard.biodiversity}</span>
              </div>
              <div className={styles.metric}>
                <strong>{planet.data?.civilizations?.reduce((sum, civ) => sum + civ.population, 0).toLocaleString(locale) ?? "—"}</strong>
                <span>{t.dashboard.cityLights}</span>
              </div>
            </div>
            <div className={styles.metric}>
              <strong>{selectedRegion ? (locale === "ar" ? selectedRegion.nameAr : selectedRegion.name) : t.dashboard.noRegion}</strong>
              <span>{t.dashboard.selectedRegion}</span>
            </div>
            <span className={styles.hint}>{t.dashboard.orbitHint}</span>
          </div>
        </section>

        <RightPanel />
      </div>

      <Timeline />
    </AppShell>
  );
}
