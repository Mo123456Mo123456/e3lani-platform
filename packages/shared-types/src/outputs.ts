import { z } from "zod";

import {
  IdentifierSchema,
  LocalizedTextSchema,
  UnitIntervalSchema,
} from "./common.js";
import { SimulationEventTypeSchema } from "./events.js";
import { WorldStateSchema } from "./world.js";

export const SnapshotSchema = z
  .object({
    id: IdentifierSchema,
    tick: z.number().int().nonnegative(),
    eventIndex: z.number().int().nonnegative(),
    checksum: z.string().regex(/^[a-f0-9]{8}$/),
    state: WorldStateSchema,
  })
  .strict();

export const NotificationSchema = z
  .object({
    id: IdentifierSchema,
    eventId: IdentifierSchema,
    eventType: SimulationEventTypeSchema,
    tick: z.number().int().nonnegative(),
    severity: z.enum(["INFO", "NOTICE", "WARNING", "CRITICAL"]),
    title: LocalizedTextSchema,
    message: LocalizedTextSchema,
    regionId: IdentifierSchema.optional(),
    read: z.boolean(),
  })
  .strict();

export const WorldSummarySchema = z
  .object({
    worldId: IdentifierSchema,
    seed: z.string().min(1).max(256),
    tick: z.number().int().nonnegative(),
    regionCount: z.number().int().nonnegative(),
    habitableRegionCount: z.number().int().nonnegative(),
    totalPopulation: z.number().finite().nonnegative(),
    totalCarryingCapacity: z.number().finite().nonnegative(),
    meanTemperatureC: z.number().finite().min(-100).max(100),
    meanMoisture: UnitIntervalSchema,
    meanPollution: UnitIntervalSchema,
    biodiversity: z.number().finite().nonnegative(),
    civilizationCount: z.number().int().nonnegative(),
    technologyCount: z.number().int().nonnegative(),
  })
  .strict();

export const ScenarioPointSchema = z
  .object({
    tick: z.number().int().nonnegative(),
    totalPopulation: z.number().finite().nonnegative(),
    meanTemperatureC: z.number().finite().min(-100).max(100),
    meanPollution: UnitIntervalSchema,
    habitability: UnitIntervalSchema,
  })
  .strict();

export const FutureScenarioSchema = z
  .object({
    run: z.number().int().nonnegative(),
    score: z.number().finite(),
    summary: WorldSummarySchema,
    trajectory: z.array(ScenarioPointSchema).min(2),
  })
  .strict();

const UncertaintyIntervalSchema = z
  .object({
    low: z.number().finite(),
    high: z.number().finite(),
  })
  .strict()
  .refine((interval) => interval.low <= interval.high, {
    message: "Uncertainty interval must be ordered",
  });

export const FutureProjectionSchema = z
  .object({
    seed: z.string().min(1),
    horizonTicks: z.number().int().positive(),
    runs: z.number().int().min(3),
    likely: FutureScenarioSchema,
    best: FutureScenarioSchema,
    worst: FutureScenarioSchema,
    uncertainty: z
      .object({
        population: UncertaintyIntervalSchema,
        meanTemperatureC: UncertaintyIntervalSchema,
        meanPollution: UncertaintyIntervalSchema,
      })
      .strict(),
    assumptions: z.array(LocalizedTextSchema),
  })
  .strict();

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type WorldSummary = z.infer<typeof WorldSummarySchema>;
export type ScenarioPoint = z.infer<typeof ScenarioPointSchema>;
export type FutureScenario = z.infer<typeof FutureScenarioSchema>;
export type FutureProjection = z.infer<typeof FutureProjectionSchema>;
