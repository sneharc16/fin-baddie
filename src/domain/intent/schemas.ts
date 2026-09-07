import { z } from "zod";
import { PROVENANCE_SOURCES } from "@/lib/constants";

export const priceLevelPayloadSchema = z.object({
  targetPricePaise: z.number().int().positive(),
  mode: z.enum(["NEAR", "ABOVE", "BELOW"]),
  proximityBps: z.number().int().min(1).max(10_000).default(100),
}).strict();

export const earningsPayloadSchema = z.object({
  focus: z.array(z.enum(["REVENUE", "PROFIT", "MARGINS", "ASSET_QUALITY", "ALL_KEY_CHANGES"])).min(1),
  quarterLabel: z.string().trim().min(1).max(30).optional(),
}).strict();

export const technicalPayloadSchema = z.object({
  setup: z.enum(["BREAKOUT", "SUPPORT", "MOVING_AVERAGE", "GENERAL"]),
  referenceLevelPaise: z.number().int().positive().optional(),
}).strict();

export const dividendPayloadSchema = z.object({
  focus: z.enum(["ANNOUNCEMENT", "EX_DATE", "YIELD", "GENERAL"]),
}).strict();

export const driverPayloadSchema = z.object({
  driverKey: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(300),
}).strict();

export const longTermPayloadSchema = z.object({ note: z.string().trim().max(300).optional() }).strict();
export const generalPayloadSchema = z.object({ note: z.string().trim().max(300).optional() }).strict();
export const companyEventPayloadSchema = z.object({
  eventKind: z.string().trim().min(1).max(80),
  note: z.string().trim().max(300).optional(),
}).strict();

const commonShape = {
  originalText: z.string().trim().max(300).nullable().optional(),
  provenanceSource: z.enum(PROVENANCE_SOURCES).default("MANUAL"),
  provenanceReference: z.string().trim().max(200).nullable().optional(),
  horizon: z.string().trim().max(80).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
};

export const watchIntentInputSchema = z.discriminatedUnion("type", [
  z.object({ ...commonShape, type: z.literal("PRICE_LEVEL"), structuredPayload: priceLevelPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("EARNINGS"), structuredPayload: earningsPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("DIVIDEND"), structuredPayload: dividendPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("TECHNICAL"), structuredPayload: technicalPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("COMPANY_EVENT"), structuredPayload: companyEventPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("DRIVER"), structuredPayload: driverPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("LONG_TERM"), structuredPayload: longTermPayloadSchema }).strict(),
  z.object({ ...commonShape, type: z.literal("GENERAL"), structuredPayload: generalPayloadSchema }).strict(),
]);

export const createWatchIntentSchema = z.object({
  instrumentId: z.string().trim().min(1),
  intent: watchIntentInputSchema,
}).strict();

export const updateWatchIntentSchema = watchIntentInputSchema;

const payloadSchemas = {
  PRICE_LEVEL: priceLevelPayloadSchema,
  EARNINGS: earningsPayloadSchema,
  DIVIDEND: dividendPayloadSchema,
  TECHNICAL: technicalPayloadSchema,
  COMPANY_EVENT: companyEventPayloadSchema,
  DRIVER: driverPayloadSchema,
  LONG_TERM: longTermPayloadSchema,
  GENERAL: generalPayloadSchema,
} as const;

export function validateIntentPayload(type: keyof typeof payloadSchemas, payload: unknown): unknown {
  return payloadSchemas[type].parse(payload);
}

export type WatchIntentInput = z.infer<typeof watchIntentInputSchema>;
