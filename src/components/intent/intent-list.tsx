import { History, Pencil, Plus, Archive } from "lucide-react";
import type { WatchIntentDto } from "@/server/dto/types";
import { PROVENANCE_LABELS } from "@/lib/constants";
import { summarizeIntent } from "@/domain/intent/summary";
import { formatISTDateTime } from "@/lib/format/market";
import { Button } from "@/components/ui/button";

export function IntentList({ active, all, onEdit, onAdd, onArchive }: {
  active: WatchIntentDto[];
  all: WatchIntentDto[];
  onEdit: (intent: WatchIntentDto) => void;
  onAdd: () => void;
  onArchive: (intent: WatchIntentDto) => void;
}) {
  return (
    <div className="stack">
      {active.length ? active.map((intent) => (
        <article className="intent-card" key={intent.id}>
          <div>
            <p className="intent-type">{intent.type.replaceAll("_", " ")}</p>
            <h3>{summarizeIntent(intent)}</h3>
            <p className="intent-source">Added from: {PROVENANCE_LABELS[intent.provenanceSource]} · Watching since {formatISTDateTime(intent.createdAt)}</p>
          </div>
          <div className="action-row">
            <Button variant="secondary" onClick={() => onEdit(intent)}><Pencil size={15} /> Edit</Button>
            <Button variant="ghost" onClick={() => onArchive(intent)}><Archive size={15} /> Archive</Button>
          </div>
        </article>
      )) : <div className="empty-reason"><p>No active watch reason</p><span>The stock stays in your watchlist. Add context whenever you need it.</span></div>}
      <Button variant="secondary" onClick={onAdd}><Plus size={16} /> Add another reason</Button>
      {all.length ? (
        <details className="history-panel">
          <summary><History size={16} /> Reason history</summary>
          <div className="history-list">
            {all.map((intent) => (
              <div className="history-row" key={intent.id}>
                <div><strong>Version {intent.version}</strong><span className={`status status-${intent.status.toLowerCase()}`}>{intent.status.toLowerCase()}</span></div>
                <p>{summarizeIntent(intent)}</p>
                <time dateTime={intent.createdAt}>{formatISTDateTime(intent.createdAt)}</time>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
