import type { WorldEvent } from "@planet/shared-types";

const ENGINE_URL = process.env["ENGINE_URL"] ?? "http://localhost:4100";
const API_URL = process.env["API_URL"] ?? "http://localhost:4000";
const INTERNAL_TOKEN = process.env["INTERNAL_TOKEN"] ?? "dev-internal-token";
const POLL_MS = Number(process.env["NOTIFY_POLL_MS"] ?? 5000);

/**
 * Notification worker: watches the engine's event stream and turns
 * contribution-linked events into user notifications:
 *   "your plant spread to a new continent", "a war started because of your
 *   element", "your creature went extinct"…
 * Stateless cursor (last seen seq per world) keeps it crash-safe.
 */
export function isNotifiable(event: WorldEvent): boolean {
  return Boolean(event.contributionId) && event.type !== "CONTRIBUTION_APPLIED" && event.importance >= 0.25;
}

export function notificationText(event: WorldEvent, locale: "ar" | "en" = "ar"): { title: string; body: string } {
  const name = String((event.payload as Record<string, unknown>)["name"] ?? "");
  const ar: Record<string, string> = {
    PLANT_SPREAD: `انتشر «${name}» إلى منطقة جديدة`,
    SPECIES_EXTINCT: `انقرض العنصر الذي أضفته («${name}»)`,
    SPECIES_MUTATED: `تطور «${name}» إلى نوع فرعي جديد`,
    WAR_STARTED: "اندلعت حرب مرتبطة بعنصرك",
    TRADE_ROUTE_CREATED: "نشأ طريق تجاري بسبب مساهمتك",
    TECHNOLOGY_DISCOVERED: `استخدمت حضارة تقنتك («${name}»)`,
    RESOURCE_DISCOVERED: `اكتُشف موردك («${name}»)`,
    DISEASE_OUTBREAK: `تفشى المرض الذي أضفته («${name}»)`,
  };
  const en: Record<string, string> = {
    PLANT_SPREAD: `"${name}" spread to a new region`,
    SPECIES_EXTINCT: `Your element ("${name}") went extinct`,
    SPECIES_MUTATED: `"${name}" evolved into a subspecies`,
    WAR_STARTED: "A war linked to your element started",
    TRADE_ROUTE_CREATED: "A trade route formed thanks to your contribution",
    TECHNOLOGY_DISCOVERED: `A civilization adopted your tech ("${name}")`,
    RESOURCE_DISCOVERED: `Your resource ("${name}") was discovered`,
    DISEASE_OUTBREAK: `Your disease ("${name}") spread`,
  };
  const dict = locale === "ar" ? ar : en;
  const title = dict[event.type] ?? (locale === "ar" ? "تطور جديد لمساهمتك" : "Your contribution evolved");
  return { title, body: JSON.stringify({ year: event.year, type: event.type }) };
}

async function poll(worldId: string, lastSeq: number): Promise<number> {
  try {
    const res = await fetch(`${ENGINE_URL}/worlds/${worldId}/events?limit=100`);
    if (!res.ok) return lastSeq;
    const data = (await res.json()) as { events: WorldEvent[] };
    const fresh = data.events
      .filter((e) => e.seq > lastSeq && isNotifiable(e))
      .sort((a, b) => a.seq - b.seq);
    for (const event of fresh) {
      const text = notificationText(event);
      await fetch(`${API_URL}/internal/notify-impact`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-token": INTERNAL_TOKEN },
        body: JSON.stringify({
          planetId: worldId,
          contributionId: event.contributionId,
          eventSeq: event.seq,
          type: `impact.${event.type.toLowerCase()}`,
          title: text.title,
          body: text.body,
        }),
      }).catch(() => {});
    }
    const maxSeq = data.events.reduce((m, e) => Math.max(m, e.seq), lastSeq);
    return maxSeq;
  } catch {
    return lastSeq;
  }
}

async function main(): Promise<void> {
  const worldIds = (process.env["NOTIFY_WORLDS"] ?? "demo-world").split(",");
  const cursors = new Map<string, number>(worldIds.map((w) => [w, 0]));
  console.log(`notification-worker watching: ${worldIds.join(", ")}`);
  for (;;) {
    for (const worldId of worldIds) {
      cursors.set(worldId, await poll(worldId, cursors.get(worldId) ?? 0));
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isMain) void main();
