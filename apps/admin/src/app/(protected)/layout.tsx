import type { ReactNode } from "react";
import { AdminShell } from "@/components/AdminShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
