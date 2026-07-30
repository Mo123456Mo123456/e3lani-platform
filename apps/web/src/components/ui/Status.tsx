"use client";

import { getApiErrorMessage } from "@/lib/api";
import { useI18n } from "@/stores/locale-store";
import styles from "@/app/app.module.css";

export function ErrorState({ error, compact = false }: { error: unknown; compact?: boolean }) {
  const { t } = useI18n();

  return (
    <div className={compact ? styles.errorBadge : styles.routeCard} role="alert">
      <strong>{t.states.error}</strong>
      {!compact ? <p>{t.dashboard.apiRequired}</p> : null}
      <p>{getApiErrorMessage(error)}</p>
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();

  return (
    <div className={styles.routeCard}>
      <span className={styles.successBadge}>{t.states.connected}</span>
      <p>{label ?? t.states.loading}</p>
    </div>
  );
}

export function EmptyState({ label }: { label?: string }) {
  const { t } = useI18n();

  return (
    <div className={styles.routeCard}>
      <p>{label ?? t.states.empty}</p>
    </div>
  );
}
