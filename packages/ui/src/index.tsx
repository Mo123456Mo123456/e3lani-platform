import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export function GlassPanel({
  children,
  style,
  className = "",
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={`pb-glass ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
}) {
  return (
    <button
      className={`pb-btn ${variant === "primary" ? "pb-btn-primary" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "var(--pb-muted)", fontSize: 12 }}>{label}</span>
      <strong style={{ color: color ?? "var(--pb-text)", fontSize: 20 }}>{value}</strong>
    </div>
  );
}
