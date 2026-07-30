import type { ContributionCategory, UserRole } from "./enums.js";

export interface AuthTokens {
  accessToken: string;
  /** refresh token is ALSO set as an httpOnly cookie; body copy is for non-browser clients */
  refreshToken: string;
  accessTokenExpiresInSec: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  locale?: "ar" | "en";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContributionCreateRequest {
  planetId: string;
  category: ContributionCategory;
  text: string;
  /** optional explicit origin; otherwise engine suggests */
  origin?: { lat: number; lon: number };
}

export interface ContributionConfirmRequest {
  contributionId: string;
  originIndex: number;
}

export interface UserDashboard {
  user: SessionUser;
  stats: {
    contributions: number;
    totalEffects: number;
    affectedCivilizations: number;
    longestImpactYears: number;
    impactLevel: number;
  };
  recentEvents: import("./events.js").WorldEvent[];
  contributions: Array<{
    id: string;
    name: string;
    category: ContributionCategory;
    status: string;
    impactScore: number;
    eventCount: number;
    lastEventTitle: string | null;
    createdAt: string;
  }>;
  achievements: Array<{ key: string; unlockedAt: string }>;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface AdminSimulationStatus {
  planetId: string;
  running: boolean;
  tick: number;
  simYear: number;
  ticksPerSecond: number;
  lastTickDurationMs: number;
  snapshots: number;
  queuedJobs: number;
}

export interface AiUsageRow {
  provider: string;
  model: string;
  operation: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  sandbox: boolean;
  createdAt: string;
}

export interface HealthReport {
  status: "ok" | "degraded" | "down";
  uptimeSec: number;
  checks: Record<string, { status: "up" | "down"; latencyMs?: number }>;
}
