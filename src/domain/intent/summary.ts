import type { WatchIntentDto } from "@/server/dto/types";
import { formatINRFromPaise } from "@/lib/format/market";

type Payload = Record<string, unknown>;

export function summarizeIntent(intent: Pick<WatchIntentDto, "type" | "originalText" | "structuredPayload">): string {
  if (intent.originalText?.trim()) return intent.originalText.replace(/^Watching\s+/i, "");
  const payload = intent.structuredPayload as Payload;
  switch (intent.type) {
    case "PRICE_LEVEL":
      return `${String(payload.mode ?? "Near").toLowerCase()} ${formatINRFromPaise(Number(payload.targetPricePaise))}`;
    case "EARNINGS":
      return `${payload.quarterLabel ? `${String(payload.quarterLabel)} ` : ""}${Array.isArray(payload.focus) ? payload.focus.join(", ").toLowerCase() : "results"}`;
    case "TECHNICAL":
      return `${String(payload.setup ?? "Technical").replaceAll("_", " ").toLowerCase()}${payload.referenceLevelPaise ? ` near ${formatINRFromPaise(Number(payload.referenceLevelPaise))}` : ""}`;
    case "DIVIDEND":
      return `Dividend ${String(payload.focus ?? "updates").replaceAll("_", " ").toLowerCase()}`;
    case "DRIVER":
      return String(payload.description ?? payload.driverKey ?? "Company driver");
    case "COMPANY_EVENT":
      return String(payload.note ?? payload.eventKind ?? "Company event");
    case "LONG_TERM":
    case "GENERAL":
      return String(payload.note ?? "Saved watch reason");
  }
}
