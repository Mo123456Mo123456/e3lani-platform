"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

type CausalItem = { id?: string; title?: string; type?: string; relation?: string };

export function CausalPreview({
  events,
  links,
}: {
  events: CausalItem[];
  links?: { causeEventId?: string; effectEventId?: string; relation?: string; explanation?: string }[];
}) {
  if (!events.length) {
    return <p className="text-sm text-muted">—</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((ev, i) => (
        <div key={ev.id || i} className="flex items-start gap-2">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_#22d3ee]" />
          <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="flex flex-wrap items-center gap-2">
              {ev.type && <Badge tone="orange">{ev.type}</Badge>}
              {ev.id ? (
                <Link href={`/causal/${ev.id}`} className="text-sm text-cyan hover:underline">
                  {ev.title || ev.id}
                </Link>
              ) : (
                <span className="text-sm text-ink">{ev.title || "event"}</span>
              )}
            </div>
            {links?.[i]?.explanation && (
              <p className="mt-1 text-[11px] text-muted">{links[i]?.explanation}</p>
            )}
          </div>
          {i < events.length - 1 && (
            <span className="self-center text-[10px] text-muted">↓</span>
          )}
        </div>
      ))}
    </div>
  );
}
