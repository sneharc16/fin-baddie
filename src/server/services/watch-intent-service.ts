import { randomUUID } from "node:crypto";
import type { InstrumentRepository, WatchIntentRepository } from "@/server/repositories/contracts";
import { watchIntentInputSchema, type WatchIntentInput } from "@/domain/intent/schemas";
import type { WatchIntentDraft } from "@/domain/intent/types";
import { AppError } from "@/lib/errors/app-error";
import { toIntentDto } from "@/server/dto/mappers";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";

function toDraft(value: WatchIntentInput): WatchIntentDraft {
  return {
    type: value.type,
    originalText: value.originalText ?? null,
    structuredPayload: value.structuredPayload,
    provenanceSource: value.provenanceSource,
    provenanceReference: value.provenanceReference ?? null,
    horizon: value.horizon ?? null,
    expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
  };
}

export class WatchIntentService {
  constructor(
    private readonly intents: WatchIntentRepository,
    private readonly instruments: InstrumentRepository,
    private readonly market: MarketDataProvider,
  ) {}

  async list(userId: string, instrumentId: string) {
    return (await this.intents.listForInstrument(userId, instrumentId)).map(toIntentDto);
  }

  async create(userId: string, instrumentId: string, untrustedInput: unknown) {
    const input = watchIntentInputSchema.parse(untrustedInput);
    if (!(await this.instruments.findById(instrumentId))) {
      throw new AppError("INSTRUMENT_NOT_FOUND", "The selected instrument does not exist.", 404);
    }
    const logicalIntentId = randomUUID();
    const effectiveFromSequence = await this.market.getCurrentSequence();
    const created = await this.intents.create({
      id: randomUUID(),
      logicalIntentId,
      userId,
      instrumentId,
      version: 1,
      effectiveFromSequence,
      supersedesId: null,
      ...toDraft(input),
    });
    return toIntentDto(created);
  }

  async edit(userId: string, logicalIntentId: string, untrustedInput: unknown) {
    const input = watchIntentInputSchema.parse(untrustedInput);
    const current = await this.intents.findCurrent(userId, logicalIntentId);
    if (!current) throw new AppError("WATCH_INTENT_NOT_FOUND", "No active watch reason was found.", 404);
    const effectiveFromSequence = await this.market.getCurrentSequence();
    const next = await this.intents.supersedeAndCreate(current.id, {
      id: randomUUID(),
      logicalIntentId,
      userId,
      instrumentId: current.instrumentId,
      version: current.version + 1,
      effectiveFromSequence,
      supersedesId: current.id,
      ...toDraft(input),
    });
    return toIntentDto(next);
  }

  async archive(userId: string, logicalIntentId: string) {
    const current = await this.intents.findCurrent(userId, logicalIntentId);
    if (!current) throw new AppError("WATCH_INTENT_NOT_FOUND", "No active watch reason was found.", 404);
    return toIntentDto(await this.intents.archiveCurrent(current.id));
  }
}
