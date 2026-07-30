"use client";

import { usePlanetQuery } from "@/lib/queries";
import { useI18n } from "@/stores/locale-store";
import { AppShell } from "@/components/ui/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/Status";
import styles from "@/app/app.module.css";

function metricWidth(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function CivilizationsPage() {
  const { locale, t } = useI18n();
  const planet = usePlanetQuery();

  return (
    <AppShell>
      <section className={styles.routeHero}>
        <span className={styles.eyebrow}>{t.nav.civilizations}</span>
        <h1>{t.civilizations.title}</h1>
        <p>{t.civilizations.subtitle}</p>
      </section>

      {planet.isLoading ? <LoadingState /> : null}
      {planet.error ? <ErrorState error={planet.error} /> : null}
      {!planet.isLoading && !planet.error && !planet.data?.civilizations?.length ? <EmptyState /> : null}

      <section className={styles.routeGrid}>
        {planet.data?.civilizations?.map((civilization) => (
          <article key={civilization.id} className={styles.routeCard}>
            <span className={styles.eyebrow} style={{ color: civilization.color }}>
              {t.civilizations.population}: {civilization.population.toLocaleString(locale)}
            </span>
            <h2>{locale === "ar" ? civilization.nameAr : civilization.name}</h2>
            <div className={styles.formGrid}>
              {[
                [t.civilizations.tech, civilization.techLevel],
                [t.civilizations.military, civilization.military],
                [t.civilizations.economy, civilization.economy],
                [t.civilizations.stability, civilization.stability],
                [t.civilizations.happiness, civilization.happiness],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className={styles.hint}>{label}</span>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: metricWidth(Number(value)) }} />
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.hint}>
              {t.explore.pollution}: {civilization.pollution}
            </p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
