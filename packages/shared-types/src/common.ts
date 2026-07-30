import { z } from "zod";

export const IdentifierSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const LocalizedTextSchema = z
  .object({
    ar: z.string().trim().min(1).max(240),
    en: z.string().trim().min(1).max(240),
  })
  .strict();

export const UnitIntervalSchema = z.number().finite().min(0).max(1);
export const SignedUnitIntervalSchema = z.number().finite().min(-1).max(1);

export type Identifier = z.infer<typeof IdentifierSchema>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
