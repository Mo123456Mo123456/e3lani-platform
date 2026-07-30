import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

const variants: Record<Variant, string> = {
  primary:
    "bg-cyan/20 text-cyan border-cyan/40 hover:bg-cyan/30 shadow-glow",
  secondary:
    "bg-white/5 text-ink border-white/10 hover:bg-white/10",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-white/5",
  danger: "bg-red/15 text-red border-red/40 hover:bg-red/25",
  gold: "bg-gold/15 text-gold border-gold/40 hover:bg-gold/25",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        size === "lg" && "px-5 py-3 text-base",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
