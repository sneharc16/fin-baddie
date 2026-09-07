import { z } from "zod";

export const renewIntentSchema = z.object({ quarterLabel: z.string().trim().min(1).max(20).optional() }).strict();
