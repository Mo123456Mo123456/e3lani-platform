import { Injectable, Logger } from '@nestjs/common';

export type AutoModerationDecision = 'AUTO_APPROVED' | 'NEEDS_HUMAN' | 'REJECTED';

export type ModerationFinding = {
  code: string;
  severity: 'low' | 'medium' | 'high';
  detail?: string;
};

export type ModerationRevisionInput = {
  id: string;
  title: string;
  description?: string | null;
  categoryId: string;
  countryCode: string;
  cityId: string;
  media?: Array<{
    kind: 'image' | 'video';
    url?: string;
    storageKey?: string;
  }>;
};

export type AutoModerationResult = {
  decision: AutoModerationDecision;
  riskScore: number;
  findings: ModerationFinding[];
};

export interface ModerationAdapter {
  autoModerate(adRevision: ModerationRevisionInput): Promise<AutoModerationResult>;
}

export class ModerationProviderNotConfiguredError extends Error {
  constructor(missing: string[], provider?: string) {
    super(
      `MODERATION_PROVIDER_NOT_CONFIGURED:${provider ?? 'unset'}:${
        missing.length > 0 ? `missing ${missing.join(',')}` : 'placeholder has no live implementation'
      }`,
    );
    this.name = 'ModerationProviderNotConfiguredError';
  }
}

const BLOCKED_TERMS = ['scam', 'fraud', 'fake', 'weapon'];
const REVIEW_TERMS = ['urgent', 'crypto', 'investment', 'loan'];

@Injectable()
export class SandboxModerationAdapter implements ModerationAdapter {
  private readonly log = new Logger(SandboxModerationAdapter.name);

  async autoModerate(adRevision: ModerationRevisionInput): Promise<AutoModerationResult> {
    const title = adRevision.title.trim();
    const text = `${title} ${adRevision.description ?? ''}`.toLowerCase();

    if (!title) {
      return {
        decision: 'REJECTED',
        riskScore: 1,
        findings: [{ code: 'title.empty', severity: 'high', detail: 'Title is required' }],
      };
    }

    const blocked = BLOCKED_TERMS.filter((term) => text.includes(term));
    if (blocked.length > 0) {
      return {
        decision: 'REJECTED',
        riskScore: 0.95,
        findings: blocked.map((term) => ({
          code: 'term.blocked',
          severity: 'high',
          detail: term,
        })),
      };
    }

    const needsReview = REVIEW_TERMS.filter((term) => text.includes(term));
    if (needsReview.length > 0 || title.length > 80) {
      return {
        decision: 'NEEDS_HUMAN',
        riskScore: 0.55,
        findings:
          needsReview.length > 0
            ? needsReview.map((term) => ({
                code: 'term.review',
                severity: 'medium',
                detail: term,
              }))
            : [{ code: 'title.long', severity: 'medium', detail: 'Long title needs review' }],
      };
    }

    this.log.log(`sandbox moderation auto-approved revision=${adRevision.id}`);
    return {
      decision: title.length <= 60 ? 'AUTO_APPROVED' : 'NEEDS_HUMAN',
      riskScore: title.length <= 60 ? 0.1 : 0.35,
      findings: [],
    };
  }
}

@Injectable()
export class HttpModerationAdapter implements ModerationAdapter {
  private readonly log = new Logger(HttpModerationAdapter.name);
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.provider = (env.MODERATION_PROVIDER ?? '').trim().toLowerCase();
    this.apiKey = (env.MODERATION_API_KEY ?? '').trim();
    this.apiUrl = this.resolveApiUrl();
  }

  async autoModerate(adRevision: ModerationRevisionInput): Promise<AutoModerationResult> {
    this.assertConfigured();

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(this.buildRequestBody(adRevision)),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        throw new Error(`MODERATION_PROVIDER_HTTP_${res.status}`);
      }
      return this.mapProviderResult(body);
    } catch (error) {
      this.log.warn(
        `moderation provider failed provider=${this.provider}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        decision: 'NEEDS_HUMAN',
        riskScore: 0.5,
        findings: [
          {
            code: 'provider.error',
            severity: 'medium',
            detail: error instanceof Error ? error.message : 'Moderation provider failed',
          },
        ],
      };
    }
  }

  private resolveApiUrl(): string {
    const explicit = (this.env.MODERATION_API_URL ?? '').trim();
    if (explicit) return explicit;
    if (this.provider === 'openai') return 'https://api.openai.com/v1/moderations';
    return '';
  }

  private assertConfigured() {
    const missing = ['MODERATION_PROVIDER', 'MODERATION_API_KEY'].filter(
      (key) => !this.env[key]?.trim(),
    );
    if (!this.apiUrl) missing.push('MODERATION_API_URL');
    if (missing.length > 0) {
      throw new ModerationProviderNotConfiguredError(missing, this.provider || undefined);
    }
  }

  private buildRequestBody(adRevision: ModerationRevisionInput): unknown {
    const text = [
      `Title: ${adRevision.title}`,
      adRevision.description ? `Description: ${adRevision.description}` : undefined,
      `Category: ${adRevision.categoryId}`,
      `Country: ${adRevision.countryCode}`,
      `City: ${adRevision.cityId}`,
      adRevision.media?.length
        ? `Media: ${adRevision.media
            .map((media) => `${media.kind}:${media.url ?? media.storageKey ?? 'unresolved'}`)
            .join(', ')}`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    if (this.provider === 'openai') {
      const content: unknown[] = [{ type: 'text', text }];
      for (const media of adRevision.media ?? []) {
        if (media.kind === 'image' && media.url) {
          content.push({ type: 'image_url', image_url: { url: media.url } });
        }
      }
      return {
        model: this.env.MODERATION_MODEL ?? 'omni-moderation-latest',
        input: content,
      };
    }

    return {
      provider: this.provider,
      adRevision,
      text,
    };
  }

  private mapProviderResult(body: unknown): AutoModerationResult {
    const normalized = normalizeProviderResult(body);
    const decision = mapProviderDecision(normalized.decision);
    return {
      decision,
      riskScore: normalized.riskScore,
      findings: normalized.findings,
    };
  }
}

export function moderationMode(env: NodeJS.ProcessEnv = process.env): 'sandbox' | 'production' {
  const mode = (env.MODERATION_MODE ?? env.APP_ENV ?? env.NODE_ENV ?? 'sandbox').toLowerCase();
  return mode === 'production' ? 'production' : 'sandbox';
}

export function createModerationAdapter(env: NodeJS.ProcessEnv = process.env): ModerationAdapter {
  if (moderationMode(env) === 'production') return new HttpModerationAdapter(env);
  return new SandboxModerationAdapter();
}

type NormalizedProviderResult = {
  decision: string;
  riskScore: number;
  findings: ModerationFinding[];
};

function normalizeProviderResult(body: unknown): NormalizedProviderResult {
  const record = asRecord(body);
  const openAiResult = Array.isArray(record.results) ? asRecord(record.results[0]) : null;
  const source = openAiResult ?? record;
  const decision =
    stringField(source, 'decision') ??
    stringField(source, 'action') ??
    stringField(source, 'status') ??
    stringField(source, 'result') ??
    (typeof source.flagged === 'boolean' ? (source.flagged ? 'REJECT' : 'APPROVE') : 'REVIEW');

  const categoryScores = asRecord(source.category_scores);
  const scores = [
    numberField(source, 'riskScore'),
    numberField(source, 'risk_score'),
    numberField(source, 'score'),
    ...Object.values(categoryScores).filter((value): value is number => typeof value === 'number'),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const riskScore = scores.length > 0 ? clamp01(Math.max(...scores)) : defaultRiskScore(decision);
  const findings = extractFindings(source, riskScore);

  return { decision, riskScore, findings };
}

function mapProviderDecision(decision: string): AutoModerationDecision {
  const normalized = decision.trim().toUpperCase();
  if (['APPROVE', 'APPROVED', 'ALLOW', 'ALLOWED', 'ACCEPT', 'AUTO_APPROVED'].includes(normalized)) {
    return 'AUTO_APPROVED';
  }
  if (['REJECT', 'REJECTED', 'BLOCK', 'BLOCKED', 'DENY', 'DENIED'].includes(normalized)) {
    return 'REJECTED';
  }
  return 'NEEDS_HUMAN';
}

function extractFindings(source: Record<string, unknown>, riskScore: number): ModerationFinding[] {
  const providerFindings = source.findings;
  if (Array.isArray(providerFindings)) {
    return providerFindings.map((finding) => {
      const record = asRecord(finding);
      return {
        code: stringField(record, 'code') ?? stringField(record, 'category') ?? 'provider.finding',
        severity: severityField(record, 'severity') ?? severityFromRisk(riskScore),
        detail: stringField(record, 'detail') ?? stringField(record, 'message'),
      };
    });
  }

  const categories = asRecord(source.categories);
  return Object.entries(categories)
    .filter(([, flagged]) => flagged === true)
    .map(([category]) => ({
      code: `provider.${category}`,
      severity: severityFromRisk(riskScore),
    }));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function severityField(
  record: Record<string, unknown>,
  key: string,
): ModerationFinding['severity'] | undefined {
  const value = record[key];
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function defaultRiskScore(decision: string): number {
  switch (mapProviderDecision(decision)) {
    case 'AUTO_APPROVED':
      return 0.1;
    case 'REJECTED':
      return 0.95;
    case 'NEEDS_HUMAN':
      return 0.55;
  }
}

function severityFromRisk(riskScore: number): ModerationFinding['severity'] {
  if (riskScore >= 0.8) return 'high';
  if (riskScore >= 0.4) return 'medium';
  return 'low';
}
