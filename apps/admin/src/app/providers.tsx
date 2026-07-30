'use client';

import { AdminShell } from '@/components/AdminShell';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
