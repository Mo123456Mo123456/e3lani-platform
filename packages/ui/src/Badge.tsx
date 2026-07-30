import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Badge({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
