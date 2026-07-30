import React, {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export type Tone = "tech" | "nature" | "civ" | "culture" | "danger" | "warning";

export function Panel(props: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`pb-panel ${props.className ?? ""}`}>
      {props.title ? (
        <header className="pb-panel-header">
          <span>{props.title}</span>
          {props.actions}
        </header>
      ) : null}
      <div className="pb-panel-body">{props.children}</div>
    </section>
  );
}

export function Card(props: HTMLAttributes<HTMLDivElement> & { clickable?: boolean }) {
  const { clickable, className, ...rest } = props;
  return <div className={`pb-card ${clickable ? "pb-card--clickable" : ""} ${className ?? ""}`} {...rest} />;
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "nature" | "danger" | "ghost" | "default";
  size?: "sm" | "md" | "lg";
  block?: boolean;
}

export function Button({ variant = "default", size = "md", block, className, ...rest }: BtnProps) {
  const cls = [
    "pb-btn",
    variant !== "default" ? `pb-btn--${variant}` : "",
    size === "sm" ? "pb-btn--sm" : "",
    size === "lg" ? "pb-btn--lg" : "",
    block ? "pb-btn--block" : "",
    className ?? "",
  ].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}

export function Badge({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pb-badge ${tone ? `pb-badge--${tone}` : ""}`}>{children}</span>;
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="pb-label">{children}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pb-input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="pb-textarea" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="pb-select" {...props} />;
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: Tone }) {
  return (
    <div className={`pb-stat ${tone ? `pb-stat--${tone}` : ""}`}>
      <span className="pb-stat-value">{value}</span>
      <span className="pb-stat-label">{label}</span>
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone?: Tone }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="pb-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`pb-progress-fill ${tone ? `pb-progress-fill--${tone}` : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: ReactNode }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="pb-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          className={`pb-tab ${t.id === active ? "pb-tab--active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="pb-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        {title ? (
          <header className="pb-panel-header">
            <span>{title}</span>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="close">
              ✕
            </Button>
          </header>
        ) : null}
        <div className="pb-panel-body">{children}</div>
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="pb-spinner" role="status" aria-label="loading" />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="pb-empty">{children}</div>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="pb-error-box" role="alert">{children}</div>;
}

/** Tiny SVG sparkline, dependency-free. */
export function Sparkline({ values, width = 120, height = 32, color = "var(--pb-tech)" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (!values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 3) - 1.5).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

export function EventRow({ importance, children, time }: { importance: number; children: ReactNode; time?: ReactNode }) {
  return (
    <div className={`pb-event ${importance >= 3 ? `pb-event--imp${importance}` : ""}`}>
      <div style={{ flex: 1 }}>
        {children}
        {time ? <div className="pb-event-time">{time}</div> : null}
      </div>
    </div>
  );
}
