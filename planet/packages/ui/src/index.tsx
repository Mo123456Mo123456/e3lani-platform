import React, { type CSSProperties, type ReactNode } from "react";

/** Design-system primitives shared by web and admin apps. */

export function Panel(props: { title?: ReactNode; right?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        background: "var(--planet-bg-panel)",
        border: "1px solid var(--planet-border)",
        borderRadius: "var(--planet-radius)",
        padding: 12,
        backdropFilter: "blur(8px)",
        ...props.style,
      }}
    >
      {(props.title || props.right) && (
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: "var(--planet-accent)", fontWeight: 600 }}>{props.title}</h3>
          {props.right}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  const palette = {
    primary: { bg: "var(--planet-accent-dim)", fg: "#ecfeff", border: "var(--planet-accent)" },
    ghost: { bg: "transparent", fg: "var(--planet-text)", border: "var(--planet-border)" },
    danger: { bg: "rgba(248,113,113,0.12)", fg: "var(--planet-red)", border: "var(--planet-red)" },
  }[props.variant ?? "primary"];
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        fontFamily: "inherit",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "filter 120ms",
        ...props.style,
      }}
    >
      {props.children}
    </button>
  );
}

export function Badge(props: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 11,
        border: `1px solid ${props.color ?? "var(--planet-border)"}`,
        color: props.color ?? "var(--planet-text-dim)",
      }}
    >
      {props.children}
    </span>
  );
}

export function Stat(props: { label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, color: "var(--planet-text-dim)" }}>{props.label}</span>
      <span style={{ fontSize: 18, fontWeight: 600, color: props.color ?? "var(--planet-text)" }}>{props.value}</span>
    </div>
  );
}

export function Spinner(props: { size?: number }) {
  const s = props.size ?? 18;
  return (
    <span
      role="status"
      aria-label="loading"
      style={{
        display: "inline-block",
        width: s,
        height: s,
        borderRadius: "50%",
        border: "2px solid var(--planet-border)",
        borderTopColor: "var(--planet-accent)",
        animation: "planet-spin 0.8s linear infinite",
      }}
    />
  );
}

export function EmptyState(props: { children: ReactNode }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--planet-text-dim)", fontSize: 13 }}>
      {props.children}
    </div>
  );
}
