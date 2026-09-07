import type { DemoStateRecord } from "@/domain/market/types";

export interface DemoMarketState {
  position: DemoStateRecord;
  scenario: {
    id: string;
    name: string;
    totalSteps: number;
    timezone: string;
  };
  atFinalStep: boolean;
}

export interface DemoAdvanceResult extends DemoMarketState {
  advanced: boolean;
  message?: string;
}

export interface DemoMarketController {
  getDemoState(): Promise<DemoMarketState | null>;
  advanceDemo(): Promise<DemoAdvanceResult | null>;
  resetDemo(): Promise<DemoMarketState>;
}
