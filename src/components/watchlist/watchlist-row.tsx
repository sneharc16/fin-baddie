import Link from "next/link";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { IntentLifecycleDto, WatchIntentDto, WatchlistItemDto } from "@/server/dto/types";
import { PROVENANCE_LABELS } from "@/lib/constants";
import { summarizeIntent } from "@/domain/intent/summary";
import { Price } from "@/components/market/price";
import type { AttentionLane } from "@/domain/attention/types";

export function WatchlistRow({ item, attentionLane, lifecycle, onEdit, onAddReason, onRemove }: {
  item: WatchlistItemDto;
  attentionLane: AttentionLane;
  lifecycle: IntentLifecycleDto[];
  onEdit: (item: WatchlistItemDto, intent: WatchIntentDto) => void;
  onAddReason: (item: WatchlistItemDto) => void;
  onRemove: (item: WatchlistItemDto) => void;
}) {
  const reviewState = lifecycle.some((state) => state.state === "STALE_CANDIDATE")
    ? "REVIEW REASON"
    : lifecycle.some((state) => state.state === "RESOLUTION_ELIGIBLE")
      ? "UPDATE SEEN"
      : attentionLane === "QUIET" ? "CAUGHT UP" : "NEW";
  return (
    <article className="watchlist-row" data-testid={`watchlist-${item.instrument.symbol}`}>
      <Link href={`/stock/${item.instrument.symbol}`} className="instrument-cell" aria-label={`Open ${item.instrument.name}`}>
        <span className="instrument-status-line"><strong>{item.instrument.symbol}</strong><span className={`watch-status watch-status-${reviewState === "NEW" ? attentionLane.toLowerCase() : "quiet"}`}>{reviewState}</span></span>
        <span>{item.instrument.name}</span>
      </Link>
      <div className="market-cell">
        {item.snapshot ? <Price pricePaise={item.snapshot.pricePaise} changePercent={item.snapshot.dayChangePercent} /> : <span className="muted">No replay price</span>}
      </div>
      <div className="reason-cell">
        {item.activeIntents.length ? item.activeIntents.map((intent) => (
          <div className="reason-line" key={intent.id}>
            <span className="intent-dot" aria-hidden="true" />
            <div><strong>{summarizeIntent(intent)}</strong><span>{PROVENANCE_LABELS[intent.provenanceSource]}</span></div>
            <button type="button" className="icon-button" onClick={() => onEdit(item, intent)} aria-label={`Edit reason for ${item.instrument.symbol}`}><Pencil size={15} /></button>
          </div>
        )) : <span className="no-reason">No active watch reason</span>}
        <button type="button" className="inline-action" onClick={() => onAddReason(item)}><Plus size={14} /> {item.activeIntents.length ? "Add reason" : "Add reason"}</button>
      </div>
      <div className="row-actions">
        <Link href={`/stock/${item.instrument.symbol}`} className="icon-button" aria-label={`View ${item.instrument.symbol} details`}><ChevronRight size={19} /></Link>
        <button type="button" className="icon-button danger-icon" onClick={() => onRemove(item)} aria-label={`Remove ${item.instrument.symbol} from watchlist`}><Trash2 size={17} /></button>
      </div>
    </article>
  );
}
