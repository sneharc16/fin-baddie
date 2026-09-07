"use client";

import Link from "next/link";
import { ArrowRight, CheckCheck, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CatchUpDto } from "@/server/dto/types";
import { apiFetch } from "@/lib/api/client";
import { formatISTTime } from "@/lib/format/market";
import { Button } from "@/components/ui/button";
import { DemoBadge, ErrorState, LoadingState } from "@/components/ui/status";
import { AttentionCard } from "./attention-card";

export function CatchUpScreen() {
  const [data, setData] = useState<CatchUpDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await apiFetch<CatchUpDto>("/api/catch-up")); setError(null); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not load Catch Up."); }
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function acknowledge(body: { instrumentIds: string[]; throughSequence: number } | { scope: "ALL"; throughSequence: number }, key: string) {
    setBusy(key); setMessage(null);
    try {
      await apiFetch("/api/catch-up/acknowledge", { method: "POST", body: JSON.stringify(body) });
      await load();
      setMessage(key === "ALL" ? "You're caught up." : "Marked as seen.");
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not mark this update as seen."); }
    finally { setBusy(null); }
  }

  async function advanceDemo() {
    setBusy("ADVANCE"); setMessage(null);
    try { await apiFetch("/api/demo/advance", { method: "POST" }); await load(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not advance the demo market."); }
    finally { setBusy(null); }
  }

  async function reviewAction(action: "resolve" | "keep" | "renew", logicalIntentId: string) {
    setBusy(logicalIntentId); setMessage(null);
    try {
      if (action === "renew") await apiFetch(`/api/watch-intents/${logicalIntentId}/resolve`, { method: "POST" });
      await apiFetch(`/api/watch-intents/${logicalIntentId}/${action}`, {
        method: "POST",
        ...(action === "renew" ? { body: JSON.stringify({}) } : {}),
      });
      await load();
      setMessage(action === "resolve" ? "Watch reason resolved." : action === "renew" ? "Now watching the next cycle." : "Kept this watch reason active.");
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not update this watch reason."); }
    finally { setBusy(null); }
  }

  if (!data && !error) return <LoadingState label="Comparing with your last known market state…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!data) return null;
  const attentionCount = data.counts.relevant + data.counts.significant;
  const ordinaryMovement = data.quiet.some((item) => item.novelty > 0);
  const sinceLabel = data.cursorSummary.commonLastSeenTime
    ? `Since ${formatISTTime(data.cursorSummary.commonLastSeenTime)}`
    : "Updates since you last saw each stock";

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">The Living Watchlist</p><h1>Catch Up</h1><p>{sinceLabel}</p></div><DemoBadge /></div>
      {attentionCount === 0 ? (
        <section className="baseline-card card" data-testid="caught-up-state">
          <div className="baseline-icon"><Clock3 size={22} /></div>
          <div>
            <h2>You&apos;re caught up</h2>
            <p>{data.asOfSequence === 0 ? "Groww Delta has your current market state." : ordinaryMovement ? "Prices moved, but nothing crossed your attention threshold." : "Nothing new has crossed your attention threshold."}</p>
            <p className="muted">{data.asOfSequence === 0 ? "Nothing has changed since your baseline." : `Current simulated market time: ${formatISTTime(data.asOfTime)} IST`}</p>
            <div className="action-row">
              <Button onClick={() => void advanceDemo()} disabled={busy !== null}><ArrowRight size={16} /> Advance demo market</Button>
              <Link href="/demo" className="button button-secondary">Open demo controls</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="catchup-summary card">
          <div><p>{sinceLabel}</p><h2>{data.counts.relevant ? `${data.counts.relevant} ${data.counts.relevant === 1 ? "change matches" : "changes match"} what you're watching` : `${data.counts.significant} other significant ${data.counts.significant === 1 ? "change" : "changes"}`}</h2></div>
          <Button disabled={busy !== null} onClick={() => void acknowledge({ scope: "ALL", throughSequence: data.asOfSequence }, "ALL")}><CheckCheck size={17} /> Mark all caught up</Button>
        </section>
      )}
      {message ? <p className="notice catchup-notice" role="status">{message}</p> : null}
      {data.relevant.length ? (
        <section className="attention-section" aria-labelledby="relevant-heading">
          <div className="lane-heading"><p className="eyebrow">Relevant to why you&apos;re watching</p><h2 id="relevant-heading">Saved watch reasons matched</h2></div>
          <div className="attention-grid">{data.relevant.map((item) => <AttentionCard key={item.instrument.id} item={item} busy={busy !== null} onMarkSeen={(id) => void acknowledge({ instrumentIds: [id], throughSequence: data.asOfSequence }, id)} />)}</div>
        </section>
      ) : null}
      {data.significant.length ? (
        <section className="attention-section" aria-labelledby="significant-heading">
          <div className="lane-heading"><p className="eyebrow significant-eyebrow">Other significant changes</p><h2 id="significant-heading">Worth knowing, without a matched reason</h2></div>
          <div className="attention-grid">{data.significant.map((item) => <AttentionCard key={item.instrument.id} item={item} busy={busy !== null} onMarkSeen={(id) => void acknowledge({ instrumentIds: [id], throughSequence: data.asOfSequence }, id)} />)}</div>
        </section>
      ) : null}
      {data.reviewReasons.length ? (
        <section className="review-section card section-card" aria-labelledby="review-reasons-heading">
          <div className="section-title"><div><p className="eyebrow">Review old watch reasons</p><h2 id="review-reasons-heading">{data.reviewReasons.length} watch {data.reviewReasons.length === 1 ? "reason may" : "reasons may"} need review</h2><p>This is a low-priority cleanup suggestion.</p></div></div>
          <div className="review-list">{data.reviewReasons.map((reason) => <article key={reason.logicalIntentId}>
            <div><strong>{reason.originalText ?? reason.type.replaceAll("_", " ")}</strong><span>{reason.reason}</span></div>
            <div className="action-row">
              {(reason.type === "EARNINGS" || reason.type === "DIVIDEND") ? <Button disabled={busy !== null} onClick={() => void reviewAction("renew", reason.logicalIntentId)}>{reason.type === "EARNINGS" ? "Watch next results" : "Watch next dividend"}</Button> : null}
              <Link className="button button-secondary" href={`/stock/${reason.instrumentId.split(":").at(-1)}`}>Change reason</Link>
              <Button variant="secondary" disabled={busy !== null} onClick={() => void reviewAction("resolve", reason.logicalIntentId)}>Resolve</Button>
              <Button variant="ghost" disabled={busy !== null} onClick={() => void reviewAction("keep", reason.logicalIntentId)}>Keep watching</Button>
            </div>
          </article>)}</div>
        </section>
      ) : null}
      {data.quiet.length ? (
        <details className="quiet-section card">
          <summary><span><strong>{data.quiet.length} quiet {data.quiet.length === 1 ? "stock" : "stocks"}</strong><small>Nothing crossed the attention threshold.</small></span><span>View</span></summary>
          <div className="quiet-symbols">{data.quiet.map((item) => <span key={item.instrument.id}>{item.instrument.symbol}</span>)}</div>
          <Link href="/watchlist" className="text-button">View full watchlist</Link>
        </details>
      ) : null}
    </>
  );
}
