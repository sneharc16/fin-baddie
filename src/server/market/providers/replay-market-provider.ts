import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import type { DemoStateRecord } from "@/domain/market/types";
import type { DemoSessionRepository, MarketEventRepository, MarketSnapshotRepository } from "@/server/repositories/contracts";
import { defaultReplayScenario } from "../../../../data/replay/default-scenario";
import type { DemoMarketController, DemoMarketState } from "./demo-market-controller";
import type { MarketDataProvider } from "./market-data-provider";

export class ReplayMarketProvider implements MarketDataProvider, DemoMarketController {
  constructor(
    private readonly sessions: DemoSessionRepository,
    private readonly snapshots: MarketSnapshotRepository,
    private readonly events: MarketEventRepository,
  ) {}

  private async sequence(): Promise<number> {
    const state = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!state) throw new Error("The default demo session has not been seeded.");
    return state.currentSequence;
  }

  private demoState(position: DemoStateRecord): DemoMarketState {
    return {
      position,
      scenario: {
        id: defaultReplayScenario.id,
        name: defaultReplayScenario.name,
        totalSteps: defaultReplayScenario.steps.length - 1,
        timezone: defaultReplayScenario.timezone,
      },
      atFinalStep: position.currentStep >= defaultReplayScenario.steps.length - 1,
    };
  }

  async getDemoState() {
    const position = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    return position ? this.demoState(position) : null;
  }

  async advanceDemo() {
    const position = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!position) return null;
    if (position.currentStep >= defaultReplayScenario.steps.length - 1) {
      return { ...this.demoState(position), advanced: false, message: "The demo market is already at the final step." };
    }
    const next = defaultReplayScenario.steps[position.currentStep + 1];
    const updated = await this.sessions.setPosition(DEFAULT_DEMO_SESSION_ID, next.step, next.sequence, new Date(next.eventTime));
    return { ...this.demoState(updated), advanced: true };
  }

  async resetDemo() {
    const initial = defaultReplayScenario.steps[0];
    const updated = await this.sessions.setPosition(DEFAULT_DEMO_SESSION_ID, initial.step, initial.sequence, new Date(initial.eventTime));
    return this.demoState(updated);
  }

  async getCurrentSnapshot(instrumentId: string) {
    return this.snapshots.findCurrent(instrumentId, await this.sequence());
  }

  async getCurrentSnapshots(instrumentIds: string[]) {
    return this.snapshots.findCurrentMany(instrumentIds, await this.sequence());
  }

  async getSnapshots(instrumentId: string) {
    return this.snapshots.listThroughSequence(instrumentId, await this.sequence());
  }

  getSnapshotAtOrBefore(instrumentId: string, sequence: number) {
    return this.snapshots.findCurrent(instrumentId, sequence);
  }

  getSnapshotsAtOrBefore(instrumentIds: string[], sequence: number) {
    return this.snapshots.findCurrentMany(instrumentIds, sequence);
  }

  async getSnapshotsBetween(instrumentIds: string[], fromExclusive: number, toInclusive: number) {
    return (await this.snapshots.listForInstrumentsThrough(instrumentIds, toInclusive))
      .filter((snapshot) => snapshot.sequence > fromExclusive);
  }

  getSnapshotsForAnalysis(instrumentIds: string[], throughSequence: number) {
    return this.snapshots.listForInstrumentsThrough(instrumentIds, throughSequence);
  }

  async getEventsSince(sequence: number) {
    return this.events.listBetweenSequences(sequence, await this.sequence());
  }

  getEventsBetween(fromExclusive: number, toInclusive: number) {
    return this.events.listBetweenSequences(fromExclusive, toInclusive);
  }

  getCurrentSequence() {
    return this.sequence();
  }
}
