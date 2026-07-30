import type {
  ContributionAnalysis,
  ContributionCategory,
  ContributionPreview,
  WorldState,
} from "@planet/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ContributionInput = {
  category: ContributionCategory;
  text: string;
  locale: "ar" | "en";
  regionId?: string;
  simulationRuns?: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? body.detail ?? `HTTP_${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getWorld(): Promise<WorldState> {
  return request("/world");
}

export function analyzeContribution(
  input: ContributionInput,
): Promise<ContributionAnalysis> {
  return request("/contributions/analyze", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function previewContribution(
  input: Required<ContributionInput>,
): Promise<ContributionPreview> {
  return request("/contributions/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function confirmContribution(
  input: Required<ContributionInput> & { previewToken: string },
  accessToken: string,
): Promise<{
  contribution: WorldState["contributions"][number];
  events: WorldState["latestEvents"];
  planet: WorldState["planet"];
}> {
  return request("/contributions/confirm", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
}

export function register(input: {
  email: string;
  password: string;
  displayName: string;
  locale: "ar" | "en";
}): Promise<{ accessToken: string; user: { id: string; email: string } }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export { API_URL };
