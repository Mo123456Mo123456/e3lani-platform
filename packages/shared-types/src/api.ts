/** API-wide DTOs: auth, users, notifications, admin, pagination. */

export const ROLES = [
  "visitor",
  "user",
  "explorer",
  "life_maker",
  "civ_builder",
  "historian",
  "moderator",
  "sim_manager",
  "admin",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  visitor: 0,
  user: 1,
  explorer: 2,
  life_maker: 3,
  civ_builder: 4,
  historian: 5,
  moderator: 6,
  sim_manager: 7,
  admin: 8,
  super_admin: 9,
};

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  locale: string;
  avatarUrl: string | null;
  contributionCount: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface AuthResponse {
  user: UserDto;
  tokens: AuthTokens;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NotificationDto {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface AdminMetrics {
  users: number;
  contributions: number;
  contributionsByCategory: Record<string, number>;
  events: number;
  planets: number;
  aiRequests: number;
  aiCostUsd: number;
  aiAvgLatencyMs: number;
  moderationBlocked: number;
  activeWsConnections: number;
}

export interface AiRequestDto {
  id: string;
  provider: string;
  kind: string;
  sandbox: boolean;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  status: string;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface ModerationItemDto {
  id: string;
  userId: string;
  userEmail: string;
  text: string;
  status: string;
  reasons: string[];
  createdAt: string;
}

/** WebSocket payloads (namespace /ws). */
export interface WsServerEvents {
  "event:new": { planetId: string; event: import("./events").WorldEvent };
  "planet:tick": { planetId: string; tick: number; hash: string };
  "civ:update": { planetId: string; civId: string; fields: Record<string, unknown> };
  "notification:new": { notification: NotificationDto };
  "contribution:status": { contributionId: string; status: string; detail?: Record<string, unknown> };
  "sim:state": { planetId: string; status: "running" | "paused"; tick: number };
}

export interface AnalyticsEventInput {
  name: string;
  props?: Record<string, string | number | boolean>;
  at?: string;
}
