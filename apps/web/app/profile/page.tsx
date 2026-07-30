"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function ProfilePage() {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);

  const { data: contribs } = useQuery({
    queryKey: ["contributions", user?.id],
    queryFn: () => api.getContributions(),
    enabled: !!token,
  });

  const { data: notes } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.getNotifications(),
    enabled: !!token,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Panel title={dict.pages.profile}>
          <p className="mb-4 text-sm text-muted">
            {locale === "ar" ? "سجّل الدخول لعرض ملفك." : "Sign in to view your profile."}
          </p>
          <Link href="/login">
            <Button>{dict.nav.login}</Button>
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8 lg:grid-cols-2">
      <Panel title={dict.pages.profile}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan/40 bg-cyan/10 text-xl font-bold text-cyan">
            {user.displayName.slice(0, 1)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">{user.displayName}</h2>
            <p className="text-xs text-muted">{user.email}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(user.roles || ["explorer"]).map((r) => (
                <Badge key={r} tone="cyan">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 bg-gradient-to-r from-cyan to-green" />
        </div>
        <p className="mb-4 text-xs text-muted">
          {dict.level} {Math.min(99, 5 + (contribs?.contributions?.length || 0))}
        </p>
        <Button variant="ghost" size="sm" onClick={() => clear()}>
          {dict.nav.logout}
        </Button>
      </Panel>

      <Panel title={dict.impact.contributions}>
        <div className="space-y-2">
          {(contribs?.contributions || []).map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 p-3">
              <div className="flex items-center gap-2">
                <Badge tone="gold">{c.type}</Badge>
                <Badge tone="muted">{c.status}</Badge>
              </div>
              <div className="mt-1 text-sm font-medium text-ink">{c.title}</div>
            </div>
          ))}
          {!contribs?.contributions?.length && (
            <p className="text-sm text-muted">{dict.pages.empty}</p>
          )}
        </div>
      </Panel>

      <Panel title={dict.notifications} className="lg:col-span-2">
        <div className="space-y-2">
          {(notes?.notifications || []).map((n) => (
            <div key={n.id} className="rounded-lg border border-white/10 p-3">
              <div className="text-sm font-medium text-ink">{n.title}</div>
              {n.body && <p className="text-xs text-muted">{n.body}</p>}
            </div>
          ))}
          {!notes?.notifications?.length && (
            <p className="text-sm text-muted">{dict.pages.empty}</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
