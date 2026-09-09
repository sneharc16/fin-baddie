// ─────────────────────────────────────────────────────────────────────────────
// Paper Table Export
//
// Generates LaTeX and Markdown tables for:
// - Main experiment results (Table 1)
// - Ablation results (Table 2)
// - Statistical significance (Table 3)
// - Scale metrics (Table 4)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BaselineRunResult,
  AblationRunResult,
  ComparisonResult,
  ScaleMetrics,
  AggregateMetrics,
} from "./types";
import { ensureOutputDir } from "./benchmark/export";
import { writeFileSync } from "node:fs";
import { OUTPUT_DIR } from "./config";

function fmt(val: number, decimals = 3): string {
  return val.toFixed(decimals);
}

function fmtCI(ci: [number, number] | null): string {
  if (!ci) return "—";
  return `[${fmt(ci[0])}, ${fmt(ci[1])}]`;
}

// ── Table 1: Main Results ───────────────────────────────────────────────────

function generateMainResultsTable(
  deltaResult: BaselineRunResult,
  baselineResults: BaselineRunResult[],
): string {
  const rows: string[] = [];

  // Header
  rows.push(
    "\\begin{table}[htbp]",
    "\\centering",
    "\\caption{Main experiment results. Delta V3 vs. baselines on the controlled benchmark (300 episodes, 40 scenarios).}",
    "\\label{tab:main-results}",
    "\\small",
    "\\begin{tabular}{l c c c c c c c c}",
    "\\toprule",
    "System & NDCG@5 & Prec@5 & Recall@5 & MRR & Macro-F1 & W-F1 & RSR & CR \\\\",
    "\\midrule",
  );

  // Delta V3 (the system)
  const dm = deltaResult.metrics;
  rows.push(
    `\\textbf{Delta V3} & ${fmt(dm.ndcgAt5.value)} & ${fmt(dm.precisionAt5.value)} & ${fmt(dm.recallAt5.value)} & ${fmt(dm.mrr.value)} & ${fmt(dm.macroF1.value)} & ${fmt(dm.weightedF1.value)} & ${fmt(dm.repeatSurfaceRate.value)} & ${fmt(dm.contextualRecall.value)} \\\\`,
  );

  // Baselines
  for (const br of baselineResults) {
    const m = br.metrics;
    rows.push(
      `${br.baselineId} & ${fmt(m.ndcgAt5.value)} & ${fmt(m.precisionAt5.value)} & ${fmt(m.recallAt5.value)} & ${fmt(m.mrr.value)} & ${fmt(m.macroF1.value)} & ${fmt(m.weightedF1.value)} & ${fmt(m.repeatSurfaceRate.value)} & ${fmt(m.contextualRecall.value)} \\\\`,
    );
  }

  rows.push(
    "\\bottomrule",
    "\\end{tabular}",
    "\\end{table}",
  );

  return rows.join("\n");
}

// ── Table 2: Ablation Results ───────────────────────────────────────────────

function generateAblationTable(
  deltaResult: BaselineRunResult,
  ablationResults: AblationRunResult[],
): string {
  const rows: string[] = [];

  rows.push(
    "\\begin{table}[htbp]",
    "\\centering",
    "\\caption{Ablation study. Each row removes or modifies one component of Delta V3.}",
    "\\label{tab:ablation}",
    "\\small",
    "\\begin{tabular}{l c c c c c c}",
    "\\toprule",
    "Variant & NDCG@5 & Prec@5 & Recall@5 & MRR & Macro-F1 & W-F1 \\\\",
    "\\midrule",
  );

  // Full Delta V3
  const dm = deltaResult.metrics;
  rows.push(
    `\\textbf{Delta V3 (full)} & ${fmt(dm.ndcgAt5.value)} & ${fmt(dm.precisionAt5.value)} & ${fmt(dm.recallAt5.value)} & ${fmt(dm.mrr.value)} & ${fmt(dm.macroF1.value)} & ${fmt(dm.weightedF1.value)} \\\\`,
  );

  // Ablations
  for (const ar of ablationResults) {
    const m = ar.metrics;
    rows.push(
      `${ar.variantName} & ${fmt(m.ndcgAt5.value)} & ${fmt(m.precisionAt5.value)} & ${fmt(m.recallAt5.value)} & ${fmt(m.mrr.value)} & ${fmt(m.macroF1.value)} & ${fmt(m.weightedF1.value)} \\\\`,
    );
  }

  rows.push(
    "\\bottomrule",
    "\\end{tabular}",
    "\\end{table}",
  );

  return rows.join("\n");
}

// ── Table 3: Statistical Tests ──────────────────────────────────────────────

function generateStatisticalTable(
  comparisons: ComparisonResult[],
): string {
  const rows: string[] = [];

  rows.push(
    "\\begin{table}[htbp]",
    "\\centering",
    "\\caption{Statistical significance (Wilcoxon signed-rank, Holm-corrected $\\alpha=0.05$).}",
    "\\label{tab:statistical}",
    "\\small",
    "\\begin{tabular}{l l c c c}",
    "\\toprule",
    "Comparison & Metric & $W$ & $p$ & Significant \\\\",
    "\\midrule",
  );

  for (const comp of comparisons) {
    for (const test of comp.tests) {
      rows.push(
        `${comp.baselineA} vs ${comp.baselineB} & ${test.testName} & ${fmt(test.statistic, 2)} & ${fmt(test.pValue, 4)} & ${test.significantAfterHolm ? "Yes$^*$" : "No"} \\\\`,
      );
    }
  }

  rows.push(
    "\\bottomrule",
    "\\end{tabular}",
    "\\end{table}",
  );

  return rows.join("\n");
}

// ── Table 4: Scale Metrics ──────────────────────────────────────────────────

function generateScaleTable(scale: ScaleMetrics): string {
  const rows: string[] = [];

  rows.push(
    "\\begin{table}[htbp]",
    "\\centering",
    "\\caption{Scale benchmark: latency and throughput characteristics.}",
    "\\label{tab:scale}",
    "\\small",
    "\\begin{tabular}{l c}",
    "\\toprule",
    "Metric & Value \\\\",
    "\\midrule",
    `p50 Latency & ${fmt(scale.p50LatencyUs, 1)} $\\mu$s \\\\`,
    `p95 Latency & ${fmt(scale.p95LatencyUs, 1)} $\\mu$s \\\\`,
    `p99 Latency & ${fmt(scale.p99LatencyUs, 1)} $\\mu$s \\\\`,
    `Throughput & ${fmt(scale.throughputEpsPerSec, 0)} eps/s \\\\`,
    `Graph Nodes (p50) & ${scale.graphNodesVisitedP50} \\\\`,
    `Graph Nodes (p95) & ${scale.graphNodesVisitedP95} \\\\`,
    `Episodes & ${scale.totalEpisodes} \\\\`,
    `Wall Time & ${fmt(scale.wallTimeMs / 1000, 1)} s \\\\`,
    "\\bottomrule",
    "\\end{tabular}",
    "\\end{table}",
  );

  return rows.join("\n");
}

// ── Markdown versions ───────────────────────────────────────────────────────

function generateMarkdownTable(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines.join("\n");
}

// ── Export All ───────────────────────────────────────────────────────────────

export interface PaperTableInput {
  deltaResult: BaselineRunResult;
  baselineResults: BaselineRunResult[];
  ablationResults: AblationRunResult[];
  comparisons: ComparisonResult[];
  scaleMetrics: ScaleMetrics;
}

export function exportPaperTables(input: PaperTableInput): void {
  ensureOutputDir();

  const latex = [
    "% Auto-generated by Groww Delta V3 Research Framework",
    `% Generated: ${new Date().toISOString()}`,
    "",
    "% Table 1: Main Results",
    generateMainResultsTable(input.deltaResult, input.baselineResults),
    "",
    "% Table 2: Ablation Results",
    generateAblationTable(input.deltaResult, input.ablationResults),
    "",
    "% Table 3: Statistical Tests",
    generateStatisticalTable(input.comparisons),
    "",
    "% Table 4: Scale Metrics",
    generateScaleTable(input.scaleMetrics),
  ].join("\n");

  writeFileSync(`${OUTPUT_DIR}/paper-tables.tex`, latex);

  // Lane distribution from gold labels
  const laneDist = input.deltaResult.metrics.laneDistribution;
  const laneDistStr = `Gold Lane Distribution: RELEVANT=${laneDist.RELEVANT ?? 0}, SIGNIFICANT=${laneDist.SIGNIFICANT ?? 0}, QUIET=${laneDist.QUIET ?? 0} (n=${(laneDist.RELEVANT ?? 0) + (laneDist.SIGNIFICANT ?? 0) + (laneDist.QUIET ?? 0)})`;

  // Markdown version
  const dm = input.deltaResult.metrics;
  const mainHeaders = ["System", "NDCG@5", "Prec@5", "Recall@5", "MRR", "Macro-F1", "W-F1"];
  const mainRows: string[][] = [
    ["**Delta V3**", fmt(dm.ndcgAt5.value), fmt(dm.precisionAt5.value), fmt(dm.recallAt5.value), fmt(dm.mrr.value), fmt(dm.macroF1.value), fmt(dm.weightedF1.value)],
  ];
  for (const br of input.baselineResults) {
    const m = br.metrics;
    mainRows.push([br.baselineId, fmt(m.ndcgAt5.value), fmt(m.precisionAt5.value), fmt(m.recallAt5.value), fmt(m.mrr.value), fmt(m.macroF1.value), fmt(m.weightedF1.value)]);
  }

  const md = [
    "# Paper Tables",
    "",
    laneDistStr,
    "",
    "## Table 1: Main Results",
    "",
    generateMarkdownTable(mainHeaders, mainRows),
    "",
    "## Table 2: Ablation Results",
    "",
    generateMarkdownTable(
      ["Variant", "NDCG@5", "Prec@5", "Recall@5", "MRR", "Macro-F1", "W-F1"],
      [
        ["**Delta V3 (full)**", fmt(dm.ndcgAt5.value), fmt(dm.precisionAt5.value), fmt(dm.recallAt5.value), fmt(dm.mrr.value), fmt(dm.macroF1.value), fmt(dm.weightedF1.value)],
        ...input.ablationResults.map((ar) => {
          const m = ar.metrics;
          return [ar.variantName, fmt(m.ndcgAt5.value), fmt(m.precisionAt5.value), fmt(m.recallAt5.value), fmt(m.mrr.value), fmt(m.macroF1.value), fmt(m.weightedF1.value)];
        }),
      ],
    ),
    "",
    "## Table 4: Scale Metrics",
    "",
    generateMarkdownTable(
      ["Metric", "Value"],
      [
        ["p50 Latency", `${fmt(input.scaleMetrics.p50LatencyUs, 1)} μs`],
        ["p95 Latency", `${fmt(input.scaleMetrics.p95LatencyUs, 1)} μs`],
        ["Throughput", `${fmt(input.scaleMetrics.throughputEpsPerSec, 0)} eps/s`],
        ["Graph Nodes (p50)", String(input.scaleMetrics.graphNodesVisitedP50)],
        ["Graph Nodes (p95)", String(input.scaleMetrics.graphNodesVisitedP95)],
      ],
    ),
  ].join("\n");

  writeFileSync(`${OUTPUT_DIR}/paper-tables.md`, md);
}
