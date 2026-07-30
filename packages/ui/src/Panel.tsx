import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Panel({
  children,
  className,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; title?: string }) {
  return (
    <div
      className={clsx("rounded-xl border border-cyan-400/30 bg-slate-900/70 p-4 backdrop-blur", className)}
      {...props}
    >
      {title && <h2 className="mb-3 text-sm font-semibold">{title}</h2>}
      {children}
    </div>
  );
}
