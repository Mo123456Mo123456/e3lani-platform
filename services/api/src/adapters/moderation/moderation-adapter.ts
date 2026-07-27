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
export class ProductionModerationPlaceholderAdapter implements ModerationAdapter {
  async autoModerate(_adRevision: ModerationRevisionInput): Promise<AutoModerationResult> {
    const provider = process.env.MODERATION_PROVIDER;
    const missing = ['MODERATION_PROVIDER', 'MODERATION_API_KEY'].filter(
      (key) => !process.env[key]?.trim(),
    );
    throw new ModerationProviderNotConfiguredError(missing, provider);
  }
}

export function moderationMode(env: NodeJS.ProcessEnv = process.env): 'sandbox' | 'production' {
  const mode = (env.MODERATION_MODE ?? env.APP_ENV ?? env.NODE_ENV ?? 'sandbox').toLowerCase();
  return mode === 'production' ? 'production' : 'sandbox';
}
