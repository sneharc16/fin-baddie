export interface InstrumentRecord {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string | null;
  currency: string;
  isActive: boolean;
}
