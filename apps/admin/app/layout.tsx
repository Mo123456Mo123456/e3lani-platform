import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "إدارة المحاكاة | كوكب يولد أمامك",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
