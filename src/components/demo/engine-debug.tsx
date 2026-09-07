import type { CatchUpDto } from "@/server/dto/types";

const number = (value: number | null, digits = 2) => value === null ? "—" : value.toFixed(digits);

export function EngineDebug({ catchUp }: { catchUp: CatchUpDto }) {
  const items = [...catchUp.relevant, ...catchUp.significant, ...catchUp.quiet]
    .sort((a, b) => a.instrument.symbol.localeCompare(b.instrument.symbol));
  return (
    <details className="card engine-debug">
      <summary><span><strong>ENGINE DEBUG</strong><small>Deterministic analysis facts</small></span><span>View</span></summary>
      <div className="debug-table-wrap">
        <table className="debug-table">
          <thead><tr><th>Instrument</th><th>Cursor / current</th><th>Δ bps</th><th>Expected bps</th><th>Surprise</th><th>Volume</th><th>S / R / N / U / C</th><th>Score</th><th>Lane</th><th>Match facts</th><th>Reason codes</th></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.instrument.id} data-testid={`debug-${item.instrument.symbol}`}>
              <th>{item.instrument.symbol}</th>
              <td>{item.fromSequence} / {item.toSequence}</td>
              <td>{number(item.priceDeltaBps, 1)}</td>
              <td>{number(item.expectedWindowMoveBps, 1)}</td>
              <td>{number(item.priceSurprise)}</td>
              <td>{item.volumeRatio === null ? "—" : `${item.volumeRatio.toFixed(2)}×`}</td>
              <td>{item.significance} / {item.relevance} / {item.novelty} / {item.urgency} / {item.confidence}</td>
              <td>{item.score}</td>
              <td>{item.lane}</td>
              <td>{item.matchedIntents.map((match) => match.graphMatch
                ? `${match.matchType}: ${match.graphMatch.eventSubjectKey} → ${match.graphMatch.matchedNodeKey}; ${match.graphMatch.path.map((node) => node.label).join(" → ")}; depth ${match.graphMatch.pathDepth}; weight ${match.graphMatch.relevance}; effective ${match.graphMatch.effectiveSequence}`
                : `${match.matchType}: ${match.reasonCode}`).join(" | ") || "—"}</td>
              <td>{item.reasonCodes.join(", ")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  );
}
