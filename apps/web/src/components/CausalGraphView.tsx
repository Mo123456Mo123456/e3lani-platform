"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Modal, Spinner, Empty } from "@planet/ui";
import type { WorldEvent } from "@planet/shared-types";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { describeEvent } from "./EventCard";

/** Causal chain modal: root cause -> the event -> its descendants. */
export function CausalGraphView({
  planetId,
  eventId,
  onClose,
}: {
  planetId: string | null;
  eventId: string | null;
  onClose: () => void;
}) {
  const { dict, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["event-chain", planetId, eventId],
    queryFn: () => api().getEventChain(planetId!, eventId!),
    enabled: Boolean(planetId) && Boolean(eventId),
  });

  const renderChain = (events: WorldEvent[], emptyLabel: string, tone: string) =>
    events.length === 0 ? (
      <Empty>{emptyLabel}</Empty>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {events.slice(0, 14).map((e, i) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 ? <span className="pb-faint" style={{ fontSize: 11 }}>↓</span> : <span style={{ width: 11 }} />}
            <div className="pb-card" style={{ flex: 1, padding: "8px 10px", fontSize: 12 }}>
              <Badge tone={tone as "tech"}>{dict.home.year} {e.tick}</Badge>{" "}
              {describeEvent(e, locale)}
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <Modal open={eventId !== null} onClose={onClose} title={dict.events.viewChain}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner /></div>
      ) : !data ? (
        <Empty>—</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="pb-label">{dict.events.causedBy}</div>
            {renderChain(data.ancestors, "—", "culture")}
          </div>
          <div className="pb-card" style={{ borderColor: "var(--pb-tech)", fontSize: 13 }}>
            <Badge tone="tech">{dict.home.year} {data.event.tick}</Badge>{" "}
            <strong>{describeEvent(data.event, locale)}</strong>
          </div>
          <div>
            <div className="pb-label">{dict.events.descendants}</div>
            {renderChain(data.descendants, "—", "nature")}
          </div>
        </div>
      )}
    </Modal>
  );
}
