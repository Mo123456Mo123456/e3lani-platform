import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-brand text-black hover:bg-brand-dark",
    secondary: "bg-black text-white hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "bg-transparent text-current hover:bg-black/5",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-black/10 bg-white p-5 shadow-sm", className)}
      {...props}
    />
  );
}

export function E3laniLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2 font-black text-black" aria-label="إعلاني E3lani">
      <span className={compact ? "text-lg" : "text-2xl"}>إعلاني</span>
      {!compact && <span className="text-xs font-semibold text-zinc-500">E3lani</span>}
    </span>
  );
}

export function PageContainer({ children }: PropsWithChildren) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>;
}
