import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="muted empty">{children}</p>;
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return <p className="error">{message}</p>;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatMoney(amount: unknown, currency = 'SAR') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${String(amount ?? '-')} ${currency}`;
  return `${value.toFixed(2)} ${currency}`;
}
