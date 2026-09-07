"use client";

import { CheckCircle2, RefreshCw } from "lucide-react";
import type { IntentLifecycleDto, WatchIntentDto, WatchTimelineEntryDto } from "@/server/dto/types";
import { formatISTDateTime, formatISTTime } from "@/lib/format/market";
import { Button } from "@/components/ui/button";

export function WatchLifecycle({ lifecycle, timeline, intents, onAction, onChange }: {
  lifecycle: IntentLifecycleDto[];
  timeline: WatchTimelineEntryDto[];
  intents: WatchIntentDto[];
  onAction: (action: "resolve" | "keep" | "renew", logicalIntentId: string) => Promise<void>;
  onChange: (intent: WatchIntentDto) => void;
}) {
  const review = lifecycle.find((item) => item.state === "RESOLUTION_ELIGIBLE" || item.state === "STALE_CANDIDATE");
  const resolved = lifecycle.find((item) => item.state === "RESOLVED" && (item.type === "EARNINGS" || item.type === "DIVIDEND"));
  const reviewIntent = review ? intents.find((intent) => intent.logicalIntentId === review.logicalIntentId && intent.status === "ACTIVE") : null;
  return (
    <>
      {review ? <section className="card section-card lifecycle-card" data-testid="lifecycle-review">
        <div className="section-title"><div><p className="eyebrow">Watch status</p><h2>{review.state === "STALE_CANDIDATE" ? "Review this watch reason" : "Your watch question has an update"}</h2></div><span className="watch-status watch-status-significant">REVIEW</span></div>
        <p>{review.reason}</p>
        <div className="action-row">
          {(review.type === "EARNINGS" || review.type === "DIVIDEND") ? <Button onClick={() => void onAction("renew", review.logicalIntentId)}><RefreshCw size={15} /> {review.type === "EARNINGS" ? "Watch next results" : "Watch next dividend event"}</Button> : null}
          {reviewIntent ? <Button variant="secondary" onClick={() => onChange(reviewIntent)}>Change reason</Button> : null}
          <Button variant="secondary" onClick={() => void onAction("resolve", review.logicalIntentId)}><CheckCircle2 size={15} /> Mark resolved</Button>
          <Button variant="ghost" onClick={() => void onAction("keep", review.logicalIntentId)}>Keep watching</Button>
        </div>
      </section> : null}
      {resolved ? <section className="card section-card lifecycle-card" data-testid="resolved-watch-reason">
        <div className="section-title"><div><p className="eyebrow">Watch status</p><h2>Watch reason resolved</h2></div><span className="watch-status">RESOLVED</span></div>
        <p>This stock remains in your watchlist. You can start the next cycle without losing its history.</p>
        <Button variant="secondary" onClick={() => void onAction("renew", resolved.logicalIntentId)}><RefreshCw size={15} /> {resolved.type === "EARNINGS" ? "Watch next results" : "Watch next dividend event"}</Button>
      </section> : null}
      <section className="card section-card" data-testid="watch-history">
        <div className="section-title"><div><p className="eyebrow">Watch history</p><h2>Reason timeline</h2></div></div>
        {timeline.length ? <ol className="watch-timeline">{timeline.map((entry) => <li key={entry.id}>
          <time dateTime={entry.occurredAt}>{entry.sequence === null ? formatISTDateTime(entry.occurredAt) : formatISTTime(entry.occurredAt)}</time>
          <div><strong>{entry.title}</strong>{entry.detail ? <span>{entry.detail}</span> : null}</div>
        </li>)}</ol> : <p className="muted">No watch history is available yet.</p>}
      </section>
    </>
  );
}
