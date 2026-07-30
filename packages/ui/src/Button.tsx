import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-400/20 px-3 py-2 text-sm text-cyan-200",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
