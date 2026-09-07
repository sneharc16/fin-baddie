import type { DriverTemplate, WatchGraphDraft } from "./types";
import { GraphDomainError, validateGraphDraft } from "./validation";

export const DRIVER_TEMPLATES: DriverTemplate[] = [
  {
    key: "AIRLINE_FUEL_COST",
    label: "Airline fuel-cost context",
    description: "Configured inputs commonly monitored alongside airline fuel costs.",
    applicableInstrumentIds: ["NSE:INDIGO"],
    applicableIntentTypes: ["DRIVER"],
    nodes: [
      { nodeKey: "NSE:INDIGO", type: "INSTRUMENT", label: "IndiGo", alwaysInclude: true },
      { nodeKey: "PROFITABILITY_QUESTION", type: "QUESTION", label: "Fuel-cost conditions ahead of results", alwaysInclude: true },
      { nodeKey: "FUEL_COST", type: "DRIVER", label: "Fuel cost", selectable: true, selectedByDefault: true, description: "A configured operating-cost driver." },
      { nodeKey: "CRUDE", type: "EXTERNAL_DRIVER", label: "Crude", selectable: true, selectedByDefault: true, description: "A commonly monitored input when tracking airline fuel costs." },
      { nodeKey: "USDINR", type: "EXTERNAL_DRIVER", label: "USD/INR", selectable: true, selectedByDefault: false, description: "An optional configured currency input; the replay has no matching event." },
    ],
    edges: [
      { fromKey: "NSE:INDIGO", toKey: "PROFITABILITY_QUESTION", relationship: "WATCHES", weight: 100 },
      { fromKey: "NSE:INDIGO", toKey: "FUEL_COST", relationship: "RELATES_TO", weight: 100 },
      { fromKey: "FUEL_COST", toKey: "CRUDE", relationship: "AFFECTED_BY", weight: 85 },
      { fromKey: "FUEL_COST", toKey: "USDINR", relationship: "CONTEXT_FOR", weight: 70 },
    ],
  },
  {
    key: "BANK_ASSET_QUALITY",
    label: "Bank asset-quality context",
    description: "Configured result context for an asset-quality watch.",
    applicableInstrumentIds: ["NSE:HDFCBANK"],
    applicableIntentTypes: ["EARNINGS"],
    nodes: [
      { nodeKey: "NSE:HDFCBANK", type: "INSTRUMENT", label: "HDFC Bank", alwaysInclude: true },
      { nodeKey: "ASSET_QUALITY", type: "METRIC", label: "Asset quality", selectable: true, selectedByDefault: true, description: "A saved banking metric." },
      { nodeKey: "EARNINGS", type: "EVENT_CATEGORY", label: "Earnings", selectable: true, selectedByDefault: true, description: "A configured reporting event category." },
    ],
    edges: [
      { fromKey: "NSE:HDFCBANK", toKey: "ASSET_QUALITY", relationship: "MEASURED_BY", weight: 100 },
      { fromKey: "ASSET_QUALITY", toKey: "EARNINGS", relationship: "CONTEXT_FOR", weight: 90 },
    ],
  },
  {
    key: "IT_SERVICES_MARGINS",
    label: "IT services margin context",
    description: "Configured result context for an operating-margin watch.",
    applicableInstrumentIds: ["NSE:TCS"],
    applicableIntentTypes: ["EARNINGS"],
    nodes: [
      { nodeKey: "NSE:TCS", type: "INSTRUMENT", label: "TCS", alwaysInclude: true },
      { nodeKey: "OPERATING_MARGIN", type: "METRIC", label: "Operating margin", selectable: true, selectedByDefault: true, description: "A saved margin metric." },
      { nodeKey: "EARNINGS", type: "EVENT_CATEGORY", label: "Earnings", selectable: true, selectedByDefault: true, description: "A configured reporting event category." },
    ],
    edges: [
      { fromKey: "NSE:TCS", toKey: "OPERATING_MARGIN", relationship: "MEASURED_BY", weight: 100 },
      { fromKey: "OPERATING_MARGIN", toKey: "EARNINGS", relationship: "CONTEXT_FOR", weight: 90 },
    ],
  },
  {
    key: "AUTO_BREAKOUT",
    label: "Breakout context",
    description: "Configured confirmation context for a technical watch.",
    applicableInstrumentIds: ["NSE:TATAMOTORS"],
    applicableIntentTypes: ["TECHNICAL"],
    nodes: [
      { nodeKey: "NSE:TATAMOTORS", type: "INSTRUMENT", label: "Tata Motors", alwaysInclude: true },
      { nodeKey: "TECHNICAL_BREAKOUT", type: "METRIC", label: "Technical breakout", selectable: true, selectedByDefault: true, description: "A saved technical condition." },
      { nodeKey: "VOLUME", type: "DRIVER", label: "Volume", selectable: true, selectedByDefault: true, description: "A configured supporting market measure." },
    ],
    edges: [
      { fromKey: "NSE:TATAMOTORS", toKey: "TECHNICAL_BREAKOUT", relationship: "WATCHES", weight: 100 },
      { fromKey: "TECHNICAL_BREAKOUT", toKey: "VOLUME", relationship: "MEASURED_BY", weight: 80 },
    ],
  },
];

export function templatesForInstrument(instrumentId: string): DriverTemplate[] {
  return DRIVER_TEMPLATES.filter((template) => template.applicableInstrumentIds.includes(instrumentId));
}

export function templatesForIntent(instrumentId: string, intentType: DriverTemplate["applicableIntentTypes"][number]): DriverTemplate[] {
  return templatesForInstrument(instrumentId).filter((template) => template.applicableIntentTypes.includes(intentType));
}

export function findDriverTemplate(templateKey: string, instrumentId: string): DriverTemplate {
  const template = DRIVER_TEMPLATES.find((candidate) => candidate.key === templateKey && candidate.applicableInstrumentIds.includes(instrumentId));
  if (!template) throw new GraphDomainError("DRIVER_TEMPLATE_NOT_FOUND", "No curated driver template is available for this watch reason.");
  return template;
}

export function graphDraftFromTemplate(template: DriverTemplate, selectedNodeKeys: string[]): WatchGraphDraft {
  const selected = new Set(selectedNodeKeys);
  const included = new Set(template.nodes.filter((node) => node.alwaysInclude || selected.has(node.nodeKey)).map((node) => node.nodeKey));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of template.edges) {
      if (included.has(edge.toKey) && !included.has(edge.fromKey)) {
        included.add(edge.fromKey);
        changed = true;
      }
    }
  }
  const nodes = template.nodes.filter((node) => included.has(node.nodeKey)).map(({ nodeKey, type, label, metadata }) => ({ nodeKey, type, label, ...(metadata ? { metadata } : {}) }));
  const edges = template.edges.filter((edge) => included.has(edge.fromKey) && included.has(edge.toKey));
  const draft = { nodes, edges };
  validateGraphDraft(draft, template.applicableInstrumentIds[0]);
  return draft;
}
