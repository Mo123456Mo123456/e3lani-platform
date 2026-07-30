import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/** Shared primitives styled with plain inline tokens so they work in any app
 *  without a CSS framework. Apps may layer Tailwind classes on top. */

export function Panel(props: HTMLAttributes<HTMLDivElement> & { title?: ReactNode; actions?: ReactNode }) {
  const { title, actions, children, style, ...rest } = props;
  return (
    <div
      {...rest}
      style={{
        background: "rgba(10, 20, 32, 0.86)",
        border: "1px solid #1b2b40",
        borderRadius: 10,
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {(title || actions) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1b2b40" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#e6edf3" }}>{title}</div>
          <div>{actions}</div>
        </div>
      )}
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

export function Badge(props: { color?: string; children: ReactNode; title?: string }) {
  const color = props.color ?? "#38bdf8";
  return (
    <span
      title={props.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        fontSize: 11,
        borderRadius: 999,
        color,
        border: `1px solid ${color}55`,
        background: `${color}14`,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </span>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const { variant = "primary", style, ...rest } = props;
  const palette =
    variant === "primary"
      ? { bg: "#0e7490", border: "#38bdf8", text: "#eaf6ff" }
      : variant === "danger"
        ? { bg: "#7f1d1d", border: "#f87171", text: "#fee2e2" }
        : { bg: "transparent", border: "#1b2b40", text: "#8b98a9" };
  return (
    <button
      {...rest}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        padding: "8px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "filter 120ms",
        ...style,
      }}
    />
  );
}

export function Spinner(props: { size?: number; color?: string }) {
  const size = props.size ?? 18;
  const color = props.color ?? "#38bdf8";
  return (
    <span
      role="status"
      aria-label="loading"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        animation: "kawkab-spin 0.8s linear infinite",
      }}
    />
  );
}

export function Stat(props: { label: ReactNode; value: ReactNode; color?: string; hint?: string }) {
  return (
    <div title={props.hint} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 88 }}>
      <span style={{ fontSize: 11, color: "#8b98a9" }}>{props.label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: props.color ?? "#e6edf3", fontVariantNumeric: "tabular-nums" }}>{props.value}</span>
    </div>
  );
}

export function Progress(props: { value: number; color?: string; height?: number }) {
  const color = props.color ?? "#38bdf8";
  return (
    <div style={{ height: props.height ?? 6, background: "#1b2b40", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, props.value)) * 100)}%`, height: "100%", background: color, transition: "width 300ms" }} />
    </div>
  );
}

export const spinKeyframes = "@keyframes kawkab-spin { to { transform: rotate(360deg) } }";
