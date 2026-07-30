import type {
  AuthSession,
  CommitResult,
  ContributionAnalysis,
  ContributionInput,
  GroundingContext,
  ModerationDecision,
  PlanetSummary,
  Role,
  TimelineSnapshot,
  UserIdentity,
  WorldEvent,
  WorldRegion,
} from "../domain/contracts.js";

export type PageOptions = { limit: number; cursor?: string | undefined };
export type Page<T> = { items: T[]; nextCursor?: string | undefined };

export type CreateAccountInput = {
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
};

export type UserWithPassword = UserIdentity & { passwordHash: string };

export type CommitContributionInput = {
  userId: string;
  input: ContributionInput;
  analysis: ContributionAnalysis;
  idempotencyKey: string;
};

export type AiAssessmentRecord = {
  userId: string;
  planetId: string;
  proposal: string;
  provider: string;
  model: string;
  moderation: ModerationDecision;
  analysis?: ContributionAnalysis | undefined;
  latencyMs: number;
  error?: string | undefined;
};

export interface WorldRepository {
  readonly kind: "postgresql" | "memory-sandbox";
  health(): Promise<{ ok: boolean; latencyMs: number }>;
  close(): Promise<void>;

  createAccount(input: CreateAccountInput): Promise<UserIdentity>;
  findUserByEmail(email: string): Promise<UserWithPassword | undefined>;
  findUserById(id: string): Promise<UserIdentity | undefined>;
  createSession(userId: string, expiresAt: Date): Promise<AuthSession>;
  sessionIsActive(sessionId: string, userId: string): Promise<boolean>;
  revokeSession(sessionId: string): Promise<void>;

  getDefaultPlanetId(): Promise<string>;
  getWorldSummary(planetId: string): Promise<PlanetSummary | undefined>;
  listRegions(planetId: string, page: PageOptions): Promise<Page<WorldRegion>>;
  listEvents(planetId: string, page: PageOptions): Promise<Page<WorldEvent>>;
  listTimeline(planetId: string, page: PageOptions): Promise<Page<TimelineSnapshot>>;
  getGroundingContext(planetId: string): Promise<GroundingContext>;

  recordAiAssessment(record: AiAssessmentRecord): Promise<void>;
  commitContribution(input: CommitContributionInput): Promise<CommitResult>;
  setTickPaused(planetId: string, paused: boolean, actorId: string): Promise<void>;
  rollbackToSnapshot(planetId: string, tick: number, actorId: string): Promise<TimelineSnapshot>;
  seedDemoWorld(): Promise<PlanetSummary>;
}
