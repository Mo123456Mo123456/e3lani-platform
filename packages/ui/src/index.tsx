import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#FFC400] text-[#111111] hover:bg-[#eab400]",
        dark: "bg-[#111111] text-white hover:bg-black",
        outline: "border border-black/15 bg-white text-[#111111] hover:bg-[#F7F7F7]",
        danger: "bg-red-600 text-white hover:bg-red-700"
      }
    },
    defaultVariants: { variant: "primary" }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ asChild, className, variant, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-black/10 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2 font-black text-[#111111]" aria-label="إعلاني">
      <span className={compact ? "text-lg" : "text-2xl"}>إعلاني</span>
      {!compact && <span className="text-xs font-medium text-black/55">E3lani</span>}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-black/60">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
