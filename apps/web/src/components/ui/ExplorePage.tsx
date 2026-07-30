"use client";

import { usePlanetQuery } from "@/lib/queries";
import { useI18n } from "@/stores/locale-store";
import { AppShell } from "@/components/ui/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/Status";
import styles from "@/app/app.module.css";

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function ExplorePage() {
  const { locale, t } = useI18n();
  const planet = usePlanetQuery();

  return (
    <AppShell>
      <section className={styles.routeHero}>
        <span className={styles.eyebrow}>{t.nav.explore}</span>
        <h1>{t.explore.title}</h1>
        <p>{t.explore.subtitle}</p>
      </section>

      {planet.isLoading ? <LoadingState /> : null}
      {planet.error ? <ErrorState error={planet.error} /> : null}
      {!planet.isLoading && !planet.error && !planet.data?.regions?.length ? <EmptyState /> : null}

      <section className={styles.routeGrid}>
        {planet.data?.regions?.map((region) => (
          <article key={region.id} className={styles.routeCard}>
            <span className={styles.eyebrow}>{region.biome}</span>
            <h2>{locale === "ar" ? region.nameAr : region.name}</h2>
            <p>
              {t.explore.population}: {region.population.toLocaleString(locale)}
            </p>
            <div className={styles.miniList}>
              <div>
                <span>{t.explore.fertility}</span>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: percent(region.fertility) }} />
                </div>
              </div>
              <div>
                <span>{t.explore.pollution}</span>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: percent(region.pollution) }} />
                </div>
              </div>
            </div>
            <p className={styles.hint}>
              {t.explore.temperature}: {region.temperature} · {t.explore.resources}: {region.resourceCount}
            </p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
