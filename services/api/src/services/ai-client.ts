const AI_URL = process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:4101";

export async function parseIdea(body: {
  category: string;
  idea: string;
  locale: "ar" | "en";
}) {
  const res = await fetch(`${AI_URL}/v1/parse-idea`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AI orchestrator error: ${res.status}`);
  }
  return res.json() as Promise<{
    structured: import("@planet/shared-types").StructuredContribution;
    provider: string;
    sandbox: boolean;
  }>;
}

export async function narrate(body: {
  locale: "ar" | "en";
  contributionName: string;
  effects: Array<{ domain: string; metric: string; delta: number }>;
  eventTitles: string[];
}) {
  const res = await fetch(`${AI_URL}/v1/narrate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI narrate error: ${res.status}`);
  return res.json() as Promise<{
    narrative: string;
    narrativeEn: string;
    provider: string;
    sandbox: boolean;
  }>;
}
