
import type { City, Civilization, Notification, Planet, PlanetRegion, Technology, TimelineSnapshot, User, UserContribution, WorldEvent } from "@kawkab/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PlanetResponse {
  planet: Planet;
  snapshot: TimelineSnapshot;
  civilizations: Civilization[];
  cities: City[];
  technologies: Technology[];
  counts: Record<string, number>;
}

async function request<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  if (init?.token) headers.set("Authorization", `Bearer ${init.token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchPlanet(id = "demo"): Promise<PlanetResponse> {
  return request<PlanetResponse>(`/planets/${id}`);
}

export async function fetchRegions(id = "demo"): Promise<{ regions: PlanetRegion[] }> {
  return request<{ regions: PlanetRegion[] }>(`/planets/${id}/regions`);
}

export async function fetchEvents(id = "demo"): Promise<{ events: WorldEvent[] }> {
  return request<{ events: WorldEvent[] }>(`/planets/${id}/events`);
}

export async function fetchTimeline(id = "demo"): Promise<{ snapshots: TimelineSnapshot[]; current: TimelineSnapshot }> {
  return request<{ snapshots: TimelineSnapshot[]; current: TimelineSnapshot }>(`/planets/${id}/timeline`);
}

export async function fetchCausalGraph(id = "demo"): Promise<{ nodes: Array<{ id: string; type: string; tick: number; title: string }>; edges: Array<{ fromEventId: string; toEventId: string; reason: string }> }> {
  return request(`/planets/${id}/causal-graph`);
}

export async function fetchNotifications(token: string): Promise<{ notifications: Notification[] }> {
  return request("/notifications", { token });
}

export async function login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function register(email: string, password: string, displayName: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  return request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) });
}

export async function createContribution(token: string, body: { planetId: string; category: string; prompt: string; locale: "ar" | "en"; targetRegionId?: string }) {
  return request<{ contribution: UserContribution }>("/contributions", { method: "POST", token, body: JSON.stringify(body) });
}

export async function previewContribution(token: string, id: string) {
  return request<any>(`/contributions/${id}/preview`, { token });
}

export async function confirmContribution(token: string, id: string) {
  return request<any>(`/contributions/${id}/confirm`, { method: "POST", token });
}

export async function fetchCompare(contributionId: string) {
  return request<any>(`/planets/demo/compare?contributionId=${encodeURIComponent(contributionId)}`);
}

export async function runScenarios(years = 25, runs = 8) {
  return request<any>("/simulation/scenarios", { method: "POST", body: JSON.stringify({ years, runs }) });
}
