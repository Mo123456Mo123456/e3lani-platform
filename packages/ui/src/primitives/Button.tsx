import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`pg-btn pg-btn-${variant} ${className}`} {...props} />;
}
