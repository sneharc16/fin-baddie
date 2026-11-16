# Paper Tables

Gold Lane Distribution: RELEVANT=97, SIGNIFICANT=30, QUIET=173 (n=300)

## Table 1: Main Results

| System | NDCG@5 | Prec@5 | Recall@5 | MRR | Macro-F1 | W-F1 |
| --- | --- | --- | --- | --- | --- | --- |
| **Delta V3** | 0.627 | 0.525 | 0.635 | 0.640 | 0.267 | 0.264 |
| B0-price-movement | 0.620 | 0.530 | 0.646 | 0.614 | 0.061 | 0.018 |
| B1-significance | 0.620 | 0.530 | 0.646 | 0.614 | 0.092 | 0.069 |
| B2-intent-only | 0.543 | 0.479 | 0.575 | 0.535 | 0.485 | 0.666 |
| B3-intent-significance | 0.651 | 0.535 | 0.651 | 0.661 | 0.303 | 0.285 |
| B4-gbdt-ranker | 0.401 | 0.133 | 0.402 | 0.166 | 0.304 | 0.458 |

## Table 2: Ablation Results

| Variant | NDCG@5 | Prec@5 | Recall@5 | MRR | Macro-F1 | W-F1 |
| --- | --- | --- | --- | --- | --- | --- |
| **Delta V3 (full)** | 0.627 | 0.525 | 0.635 | 0.640 | 0.267 | 0.264 |
| −Cursor | 0.626 | 0.523 | 0.632 | 0.642 | 0.267 | 0.264 |
| −Graph | 0.620 | 0.519 | 0.627 | 0.637 | 0.303 | 0.285 |
| −Significance | 0.583 | 0.501 | 0.603 | 0.584 | 0.458 | 0.632 |
| −Urgency | 0.627 | 0.525 | 0.635 | 0.640 | 0.267 | 0.264 |
| −Confidence | 0.635 | 0.529 | 0.640 | 0.642 | 0.267 | 0.264 |
| Equal Weights | 0.627 | 0.525 | 0.635 | 0.640 | 0.267 | 0.264 |

## Table 4: Scale Metrics

| Metric | Value |
| --- | --- |
| p50 Latency | 3.8 μs |
| p95 Latency | 9.8 μs |
| Throughput | 23611 eps/s |
| Graph Nodes (p50) | 0 |
| Graph Nodes (p95) | 4 |