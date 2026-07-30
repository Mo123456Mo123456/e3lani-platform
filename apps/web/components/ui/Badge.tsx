import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "cyan" | "green" | "gold" | "purple" | "red" | "orange" | "muted";

const tones: Record<Tone, string> = {
  cyan: "bg-cyan/15 text-cyan border-cyan/30",
  green: "bg-green/15 text-green border-green/30",
  gold: "bg-gold/15 text-gold border-gold/30",
  purple: "bg-purple/15 text-purple border-purple/30",
  red: "bg-red/15 text-red border-red/30",
  orange: "bg-orange/15 text-orange border-orange/30",
  muted: "bg-white/5 text-muted border-white/10",
};

export function Badge({
  children,
  tone = "cyan",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
