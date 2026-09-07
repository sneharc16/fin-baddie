export const DEMO_USER_ID = "demo-user";
export const DEFAULT_WATCHLIST_ID = "demo-watchlist";
export const DEFAULT_DEMO_SESSION_ID = "default-demo-session";
export const DEFAULT_SCENARIO_ID = "groww-delta-default";

export const INTENT_TYPES = [
  "PRICE_LEVEL",
  "EARNINGS",
  "DIVIDEND",
  "TECHNICAL",
  "COMPANY_EVENT",
  "DRIVER",
  "LONG_TERM",
  "GENERAL",
] as const;

export const PROVENANCE_SOURCES = [
  "MANUAL",
  "STOCK_DETAIL",
  "SCREENER_NEAR_BREAKOUT",
  "RESULTS_CALENDAR",
  "DIVIDEND_SCREEN",
  "NEWS_CONTEXT",
  "IMPORTED_DEMO",
] as const;

export const INTENT_TYPE_LABELS: Record<(typeof INTENT_TYPES)[number], string> = {
  PRICE_LEVEL: "Price level",
  EARNINGS: "Results",
  DIVIDEND: "Dividend",
  TECHNICAL: "Technical setup",
  COMPANY_EVENT: "News / event",
  DRIVER: "Driver",
  LONG_TERM: "Long-term idea",
  GENERAL: "Other",
};

export const PROVENANCE_LABELS: Record<(typeof PROVENANCE_SOURCES)[number], string> = {
  MANUAL: "Manual",
  STOCK_DETAIL: "Stock detail",
  SCREENER_NEAR_BREAKOUT: "Near Breakout screener",
  RESULTS_CALENDAR: "Results calendar",
  DIVIDEND_SCREEN: "Dividend screen",
  NEWS_CONTEXT: "News context",
  IMPORTED_DEMO: "Demo scenario",
};
