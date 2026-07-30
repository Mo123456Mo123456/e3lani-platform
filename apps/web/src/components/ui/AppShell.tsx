"use client";

import type { ReactNode } from "react";
import { TopBar } from "@/components/ui/TopBar";
import styles from "@/app/app.module.css";

export function AppShell({ children, notificationCount = 0 }: { children: ReactNode; notificationCount?: number }) {
  return (
    <main className={styles.shell}>
      <TopBar notificationCount={notificationCount} />
      {children}
    </main>
  );
}
