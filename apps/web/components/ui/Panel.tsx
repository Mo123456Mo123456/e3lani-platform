import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Panel({
  children,
  className,
  title,
  action,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className={clsx("glass-panel p-3 sm:p-4", className)} {...props}>
      {(title || action) && (
        <div className="relative z-10 mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-semibold tracking-wide text-ink/95">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
