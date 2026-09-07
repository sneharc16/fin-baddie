import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import type { AttentionItemDto } from "@/server/dto/types";
import { formatINRFromPaise, formatISTTime, formatPercentage } from "@/lib/format/market";
import { Button } from "@/components/ui/button";

export function AttentionCard({ item, onMarkSeen, busy }: {
  item: AttentionItemDto;
  onMarkSeen: (instrumentId: string) => void;
  busy: boolean;
}) {
  return (
    <article className={`attention-card attention-${item.lane.toLowerCase()}`} data-testid={`attention-${item.instrument.symbol}`}>
      <div className="attention-topline">
        <span className="attention-kind"><CircleAlert size={14} />{item.display.label}</span>
        <span className="new-pill">NEW</span>
      </div>
      <div className="attention-company">
        <div><h3>{item.instrument.symbol}</h3><p>{item.instrument.name}</p></div>
        <div className="attention-price"><strong>{formatINRFromPaise(item.currentPricePaise)}</strong><span>{formatINRFromPaise(item.baselinePricePaise)} → {formatINRFromPaise(item.currentPricePaise)}</span></div>
      </div>
      <div className="attention-copy">
        <h4>{item.display.headline}</h4>
        <p>{item.display.whySeeing}</p>
        {item.display.watchReason ? <p className="watch-reason-copy"><strong>You&apos;re watching:</strong> {item.display.watchReason}</p> : null}
        {item.display.connectionPath.length ? <div className="connection-explanation"><span>Why this is connected</span><div className="connection-path">{item.display.connectionPath.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div><small>{item.instrument.name} itself: {formatPercentage(item.priceDeltaBps / 100)} since you last checked</small></div> : null}
        {item.display.additionalSignals.map((signal) => <p className="additional-signal" key={signal}>{signal}</p>)}
      </div>
      <div className="attention-footer">
        <span>New since {formatISTTime(item.fromTime)}</span>
        <div className="action-row">
          <Link href={`/stock/${item.instrument.symbol}`} className="button button-ghost">View details <ArrowRight size={15} /></Link>
          <Button variant="secondary" disabled={busy} onClick={() => onMarkSeen(item.instrument.id)}><Check size={15} /> Mark seen</Button>
        </div>
      </div>
    </article>
  );
}
