import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";

export function Panel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`planet-panel ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      className={`planet-btn planet-btn-${variant} ${className}`}
      {...props}
    />
  );
}

export function Metric({
  label,
  value,
  accent = "var(--planet-cyan)",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--planet-muted)" }}>{label}</div>
    </div>
  );
}
