import type { ReactNode } from "react";

export function Badge({ tone = "cyan", children }: { tone?: "cyan" | "green" | "gold" | "red" | "violet"; children: ReactNode }) {
  return <span className={`pg-badge pg-badge-${tone}`}>{children}</span>;
}
