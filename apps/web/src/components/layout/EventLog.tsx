import type { WorldEvent } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";

const fallbackEvents: WorldEvent[] = [
  {
    id: "fallback-1",
    title: "ظهور غابة مضيئة",
    description: "نظام بيئي جديد ينمو قرب الحزام الاستوائي.",
    time: "منذ دقيقتين",
    importance: "medium",
    category: "nature",
    latitude: 4.2,
    longitude: 31.8,
  },
  {
    id: "fallback-2",
    title: "إشارة حضارية أولى",
    description: "وميض منتظم رُصد على الساحل الشمالي.",
    time: "منذ 12 دقيقة",
    importance: "high",
    category: "civilization",
    latitude: 42,
    longitude: -18,
  },
  {
    id: "fallback-3",
    title: "هجرة عبر السهول",
    description: "قطيع مجهول يغيّر مساره نحو المياه.",
    time: "منذ 28 دقيقة",
    importance: "low",
    category: "migration",
    latitude: -19,
    longitude: 76,
  },
];

const fallbackEventsEn: WorldEvent[] = [
  { ...fallbackEvents[0]!, title: "A luminous forest emerges", description: "A new ecosystem is growing near the equatorial belt.", time: "2 minutes ago" },
  { ...fallbackEvents[1]!, title: "First civilized signal", description: "A repeating flash was detected on the northern coast.", time: "12 minutes ago" },
  { ...fallbackEvents[2]!, title: "Migration across the plains", description: "An unknown herd changes course toward water.", time: "28 minutes ago" },
];

const categoryGlyph: Record<string, string> = {
  nature: "⌁",
  civilization: "⌂",
  technology: "◇",
  migration: "↝",
  war: "⚔",
  hazard: "△",
};

export function EventLog({
  events,
  dictionary,
  connected,
}: {
  events: WorldEvent[];
  dictionary: Dictionary;
  connected: boolean;
}) {
  const localizedFallback = dictionary.brand === "كوكب يولد أمامك" ? fallbackEvents : fallbackEventsEn;
  const displayed = events.length ? events : localizedFallback;

  return (
    <aside className="glass-panel event-log">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{dictionary.live}</span>
          <h2>{dictionary.eventLog}</h2>
        </div>
        <span className={`connection-dot ${connected ? "connected" : ""}`} title={dictionary.fallback} />
      </div>
      <div className="event-list">
        {displayed.map((event, index) => (
          <article className={`event-card importance-${event.importance}`} key={event.id}>
            <div className={`event-thumb category-${event.category}`}>
              <span>{categoryGlyph[event.category] ?? "·"}</span>
              <i style={{ animationDelay: `${index * 0.3}s` }} />
            </div>
            <div className="event-copy">
              <div className="event-title-row">
                <h3>{event.title}</h3>
                <span className="importance">{dictionary.importance[event.importance]}</span>
              </div>
              <p>{event.description}</p>
              <time>{event.time ?? event.createdAt ?? dictionary.now}</time>
            </div>
          </article>
        ))}
      </div>
      {!connected && <p className="fallback-note">{dictionary.fallback}</p>}
    </aside>
  );
}
