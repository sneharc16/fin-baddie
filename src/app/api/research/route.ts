import { NextResponse } from "next/server";
import { generateBenchmark } from "@/research/benchmark/generator";
import { evaluateBenchmark } from "@/research/delta/adapter";
import { BASELINES } from "@/research/baselines";
import { ABLATION_CONFIGS, runAblation } from "@/research/ablations";
import { computeAllMetrics } from "@/research/metrics";
import type { AggregateMetrics } from "@/research/types";
import { SCENARIOS } from "@/research/benchmark/scenarios";

export const dynamic = "force-dynamic";

interface ScenarioInfo {
  key: string;
  category: string;
  instrument: { id: string; symbol: string; name: string };
  steps: number;
}

interface ResearchResult {
  id: string;
  name: string;
  metrics: AggregateMetrics;
  description?: string;
}

interface ResearchResponse {
  scenarios: ScenarioInfo[];
  deltaMetrics: AggregateMetrics | null;
  baselines: ResearchResult[];
  ablations: ResearchResult[];
  laneDistribution: Record<string, number>;
}

export async function GET() {
  try {
    const benchmark = generateBenchmark({ seed: 42 });

    // Delta V3 predictions
    const deltaPredictions = evaluateBenchmark(benchmark.episodes);
    const deltaMetrics = computeAllMetrics(deltaPredictions, benchmark.episodes);

    // Baselines
    const baselines: ResearchResult[] = BASELINES.map((b) => {
      const preds = b.predict(benchmark);
      const metrics = computeAllMetrics(preds, benchmark.episodes);
      return { id: b.id, name: b.name, metrics };
    });

    // Ablations
    const ablations: ResearchResult[] = ABLATION_CONFIGS.map((config) => {
      const result = runAblation(config, benchmark.episodes);
      return {
        id: result.ablationId,
        name: result.variantName,
        metrics: result.metrics,
        description: config.description,
      };
    });

    // Scenario info
    const scenarios: ScenarioInfo[] = SCENARIOS.map((s) => ({
      key: s.key,
      category: s.category,
      instrument: { id: s.instrument.id, symbol: s.instrument.symbol, name: s.instrument.name },
      steps: s.steps,
    }));

    const response: ResearchResponse = {
      scenarios,
      deltaMetrics,
      baselines,
      ablations,
      laneDistribution: deltaMetrics.laneDistribution,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Research computation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
