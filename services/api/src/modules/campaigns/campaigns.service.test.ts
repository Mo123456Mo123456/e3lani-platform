import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertCampaignCanActivate,
  assertCampaignCanPause,
  assertCampaignCanResume,
} from './campaigns.service';

describe('campaign transition rules', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');

  it('allows pausing only active campaigns', () => {
    expect(() => assertCampaignCanPause({ status: 'ACTIVE' })).not.toThrow();
    expect(() => assertCampaignCanPause({ status: 'DRAFT' })).toThrow(BadRequestException);
  });

  it('allows resuming only currently scheduled paused campaigns', () => {
    expect(() =>
      assertCampaignCanResume(
        {
          status: 'PAUSED',
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          endsAt: new Date('2026-02-01T00:00:00.000Z'),
        },
        now,
      ),
    ).not.toThrow();

    expect(() =>
      assertCampaignCanResume(
        {
          status: 'PAUSED',
          startsAt: new Date('2026-01-20T00:00:00.000Z'),
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('requires activatable status, live schedule, budget, and ads', () => {
    expect(() =>
      assertCampaignCanActivate(
        {
          status: 'DRAFT',
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          budgetTotal: 100,
          adCount: 1,
        },
        now,
      ),
    ).not.toThrow();

    expect(() =>
      assertCampaignCanActivate({ status: 'PAUSED', budgetTotal: 100, adCount: 1 }, now),
    ).toThrow(BadRequestException);
    expect(() =>
      assertCampaignCanActivate({ status: 'DRAFT', budgetTotal: 0, adCount: 1 }, now),
    ).toThrow(BadRequestException);
    expect(() =>
      assertCampaignCanActivate({ status: 'PENDING_REVIEW', budgetTotal: 100, adCount: 0 }, now),
    ).toThrow(BadRequestException);
  });
});
