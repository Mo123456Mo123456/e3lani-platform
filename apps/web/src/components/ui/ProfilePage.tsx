"use client";

import Link from "next/link";
import { useImpactQuery } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/stores/locale-store";
import { AppShell } from "@/components/ui/AppShell";
import { ErrorState, LoadingState } from "@/components/ui/Status";
import styles from "@/app/app.module.css";

export function ProfilePage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const impact = useImpactQuery();

  return (
    <AppShell>
      <section className={styles.routeHero}>
        <span className={styles.eyebrow}>{t.nav.userPanel}</span>
        <h1>{t.me.title}</h1>
        <p>{t.me.subtitle}</p>
        {!user ? (
          <p className={styles.hint}>
            <Link className={styles.navLink} href="/login">
              {t.actions.login}
            </Link>
          </p>
        ) : null}
      </section>

      {impact.isLoading ? <LoadingState /> : null}
      {impact.error ? <ErrorState error={impact.error} /> : null}

      <section className={styles.routeGrid}>
        {[
          [t.me.elementsAdded, impact.data?.elementsAdded],
          [t.me.totalImpacts, impact.data?.totalImpacts],
          [t.me.evolutionDays, impact.data?.evolutionDays],
          [t.me.civilizationsAffected, impact.data?.civilizationsAffected],
        ].map(([label, value]) => (
          <article key={label} className={styles.routeCard}>
            <span className={styles.eyebrow}>{label}</span>
            <h2 className="font-latin">{value ?? "—"}</h2>
          </article>
        ))}
        <article className={styles.routeCard}>
          <span className={styles.eyebrow}>{t.me.lastEvent}</span>
          <h2>{impact.data?.lastEventTitleAr ?? impact.data?.lastEventTitle ?? t.states.unavailable}</h2>
        </article>
      </section>
    </AppShell>
  );
}
