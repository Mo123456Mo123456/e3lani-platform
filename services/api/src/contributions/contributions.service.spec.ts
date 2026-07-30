import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContributionsService } from "./contributions.service";

describe("ContributionsService", () => {
  const rows: Record<string, any[]> = {
    contributions: [],
    moderation: [],
    events: [],
    links: [],
    notifications: [],
  };

  const planet = { id: "planet_1", currentTick: 7, currentYear: 120 };
  const region = { id: "region_1", lat: 24.2, lon: 46.7 };

  const tx: any = {
    userContribution: {
      update: vi.fn(async ({ where, data }) => {
        const existing = rows.contributions.find((row) => row.id === where.id);
        Object.assign(existing, data);
        return existing;
      }),
    },
    worldEvent: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `event_${rows.events.length + 1}`,
          ...data,
          planetId: data.planet?.connect?.id,
          contributionId: data.contribution?.connect?.id,
        };
        rows.events.push(row);
        return row;
      }),
    },
    causalLink: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `link_${rows.links.length + 1}`, ...data };
        rows.links.push(row);
        return row;
      }),
    },
    notification: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `notification_${rows.notifications.length + 1}`, ...data };
        rows.notifications.push(row);
        return row;
      }),
    },
    user: { update: vi.fn(async () => ({})) },
    profile: { upsert: vi.fn(async () => ({})) },
  };

  const prisma: any = {
    planet: {
      findUnique: vi.fn(async () => planet),
    },
    planetRegion: {
      findFirst: vi.fn(async () => region),
    },
    moderationResult: {
      create: vi.fn(async ({ data }) => {
        rows.moderation.push(data);
        return data;
      }),
    },
    userContribution: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `contribution_${rows.contributions.length + 1}`, ...data };
        rows.contributions.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const existing = rows.contributions.find((row) => row.id === where.id);
        Object.assign(existing, data);
        return existing;
      }),
    },
    aIRequest: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (callback) => callback(tx)),
  };

  const ai: any = {
    moderate: vi.fn(async () => ({ allowed: true, labels: [] })),
    analyzeContribution: vi.fn(),
  };

  const simulation: any = {
    applyContribution: vi.fn(async () => ({
      narrativeAr: "بدأ الطحلب يغير البيئة.",
      forecast: { horizonYears: 10 },
      causalGraph: { edges: [{ from: "contribution", to: "fertility", weight: 0.8 }] },
      events: [
        {
          type: "PLANT_SPREAD",
          title: "Luminous moss spreads",
          titleAr: "انتشار الطحلب المضيء",
          description: "The moss improves soil fertility.",
          descriptionAr: "يحسن الطحلب خصوبة التربة.",
          importance: 0.7,
        },
      ],
    })),
  };

  const redis: any = {
    publishDelta: vi.fn(async () => undefined),
  };

  let service: ContributionsService;

  beforeEach(() => {
    for (const value of Object.values(rows)) {
      value.length = 0;
    }
    vi.clearAllMocks();
    service = new ContributionsService(prisma, ai, simulation, redis);
  });

  it("persists contribution, event, causal link, notification, and publishes delta", async () => {
    const result = await service.create(
      {
        planetId: "planet_1",
        regionId: "region_1",
        element: {
          category: "plant",
          name: "Luminous Moss",
          nameAr: "طحلب مضيء",
          description: "A moss that glows at night and enriches soil.",
          traits: { growthRate: 0.4, waterNeed: 0.2 },
          possibleBiomes: ["rainforest"],
          risks: ["May spread quickly"],
          benefits: ["Improves fertility"],
          balanceScore: 0.82,
          wasBalanced: false,
        },
      },
      {
        id: "user_1",
        email: "explorer@planet-born.local",
        displayName: "Explorer",
        role: "explorer",
        level: 1,
        xp: 0,
        locale: "ar",
      },
    );

    expect(result.contribution.status).toBe("applied");
    expect(rows.contributions).toHaveLength(1);
    expect(rows.moderation).toHaveLength(1);
    expect(rows.events).toHaveLength(1);
    expect(rows.links).toHaveLength(1);
    expect(rows.notifications).toHaveLength(1);
    expect(simulation.applyContribution).toHaveBeenCalledWith(
      expect.objectContaining({ contributionId: "contribution_1" }),
    );
    expect(redis.publishDelta).toHaveBeenCalledWith(
      expect.objectContaining({ type: "contribution", planetId: "planet_1" }),
    );
  });
});
