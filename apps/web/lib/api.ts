import type { Planet, TimelineSnapshot, WorldEvent } from "@kawkab/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PlanetResponse {
  planet: Planet;
  snapshot: TimelineSnapshot;
}

export async function fetchPlanet(id = "demo"): Promise<PlanetResponse> {
  const response = await fetch(`${API_URL}/planets/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response.json();
}

export async function fetchEvents(id = "demo"): Promise<{ events: WorldEvent[] }> {
  const response = await fetch(`${API_URL}/planets/${id}/events`, { cache: "no-store" });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response.json();
}

export async function createContribution(token: string, body: { planetId: string; category: string; prompt: string; locale: "ar" | "en" }) {
  const response = await fetch(`${API_URL}/contributions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Contribution failed with ${response.status}`);
  return response.json();
}
