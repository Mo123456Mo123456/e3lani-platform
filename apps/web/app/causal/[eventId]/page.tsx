"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { CausalPreview } from "@/components/contribute/CausalPreview";
import { Button } from "@/components/ui/Button";

export default function CausalPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <Panel
        title={dict.pages.causal}
        action={
          <Link href="/timeline">
            <Button variant="ghost" size="sm">
              {dict.nav.timeline}
            </Button>
          </Link>
        }
      >
        {isLoading && <p className="text-sm text-muted">{dict.pages.loading}</p>}
        {isError && <p className="text-sm text-red">{dict.pages.offline}</p>}
        {data?.event && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="orange">{data.event.type}</Badge>
              <Badge tone="cyan">t{data.event.tick}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-ink">{data.event.title}</h1>
            {data.event.description && (
              <p className="text-sm text-muted">{data.event.description}</p>
            )}
          </div>
        )}
      </Panel>

      <Panel title={locale === "ar" ? "الأسباب" : "Causes"}>
        <CausalPreview
          events={(data?.causes || []).map((c) => ({
            id: c.causeEventId,
            title: c.explanation || c.causeEventId,
            type: c.relation,
          }))}
        />
      </Panel>

      <Panel title={locale === "ar" ? "الآثار" : "Effects"}>
        <CausalPreview
          events={(data?.effects || []).map((c) => ({
            id: c.effectEventId,
            title: c.explanation || c.effectEventId,
            type: c.relation,
          }))}
        />
      </Panel>
    </div>
  );
}
