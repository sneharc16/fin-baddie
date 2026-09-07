import { z } from "zod";

const throughSequence = z.number().int().min(0);

export const acknowledgeSchema = z.union([
  z.object({ instrumentIds: z.array(z.string().trim().min(1)).min(1), throughSequence }).strict(),
  z.object({ scope: z.literal("ALL"), throughSequence }).strict(),
]);

export type AcknowledgeInput = z.infer<typeof acknowledgeSchema>;
