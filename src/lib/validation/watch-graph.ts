import { z } from "zod";

export const saveWatchGraphSchema = z.object({
  templateKey: z.string().trim().min(1),
  selectedNodeKeys: z.array(z.string().trim().min(1)).max(24),
}).strict();

export type SaveWatchGraphInput = z.infer<typeof saveWatchGraphSchema>;
