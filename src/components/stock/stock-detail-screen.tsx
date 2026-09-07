"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AttentionItemDto, CatchUpDto, DemoStateDto, WatchIntentDto, WatchLifecycleDto, WatchlistDto, WatchlistItemDto } from "@/server/dto/types";
import { apiFetch } from "@/lib/api/client";
import { formatCompactNumber, formatINRFromPaise, formatISTTime } from "@/lib/format/market";
import { DemoBadge, ErrorState, LoadingState } from "@/components/ui/status";
import { Price } from "@/components/market/price";
import { IntentEditor } from "@/components/intent/intent-editor";
import { IntentList } from "@/components/intent/intent-list";
import { Button } from "@/components/ui/button";
import { RelatedDrivers } from "@/components/intent/related-drivers";
import { WatchLifecycle } from "@/components/intent/watch-lifecycle";

export function StockDetailScreen({ symbol }: { symbol: string }) {
  const [item, setItem] = useState<WatchlistItemDto | null>(null);
  const [intents, setIntents] = useState<WatchIntentDto[]>([]);
  const [demo, setDemo] = useState<DemoStateDto | null>(null);
  const [attention, setAttention] = useState<AttentionItemDto | null>(null);
  const [lifecycle, setLifecycle] = useState<WatchLifecycleDto>({ lifecycle: [], timeline: [] });
  const [editing, setEditing] = useState<WatchIntentDto | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [watchlist, demoState, catchUp] = await Promise.all([apiFetch<WatchlistDto>("/api/watchlist"), apiFetch<DemoStateDto>("/api/demo/state"), apiFetch<CatchUpDto>("/api/catch-up")]);
      const found = watchlist.items.find((row) => row.instrument.symbol === symbol.toUpperCase());
      if (!found) throw new Error("This instrument is not in the active watchlist.");
      setItem(found);
      setDemo(demoState);
      setAttention([...catchUp.relevant, ...catchUp.significant, ...catchUp.quiet].find((candidate) => candidate.instrument.id === found.instrument.id) ?? null);
      const history = await apiFetch<{ intents: WatchIntentDto[] }>(`/api/watch-intents?instrumentId=${encodeURIComponent(found.instrument.id)}`);
      try {
        setLifecycle(await apiFetch<WatchLifecycleDto>(`/api/watch-lifecycle?instrumentId=${encodeURIComponent(found.instrument.id)}`));
      } catch {
        setLifecycle({ lifecycle: [], timeline: [] });
      }
      setIntents(history.intents);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load this instrument.");
    }
  }, [symbol]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function saveIntent(input: Parameters<React.ComponentProps<typeof IntentEditor>["onSave"]>[0]) {
    if (!item) return;
    const current = editing ?? null;
    await apiFetch(current ? `/api/watch-intents/${current.logicalIntentId}` : "/api/watch-intents", {
      method: current ? "PATCH" : "POST",
      body: JSON.stringify(current ? input : { instrumentId: item.instrument.id, intent: input }),
    });
    await load();
    setToast(current ? "Watch reason updated" : "Watch reason added");
  }

  async function archiveIntent(intent: WatchIntentDto) {
    await apiFetch(`/api/watch-intents/${intent.logicalIntentId}/archive`, { method: "POST" });
    await load();
    setToast("Watch reason archived");
  }

  async function markSeen() {
    if (!item || !attention) return;
    await apiFetch("/api/catch-up/acknowledge", { method: "POST", body: JSON.stringify({ instrumentIds: [item.instrument.id], throughSequence: attention.toSequence }) });
    await load();
    setToast("Marked as seen");
  }

  async function lifecycleAction(action: "resolve" | "keep" | "renew", logicalIntentId: string) {
    if (action === "renew" && intents.some((intent) => intent.logicalIntentId === logicalIntentId && intent.status === "ACTIVE")) {
      await apiFetch(`/api/watch-intents/${logicalIntentId}/resolve`, { method: "POST" });
    }
    await apiFetch(`/api/watch-intents/${logicalIntentId}/${action}`, {
      method: "POST",
      ...(action === "renew" ? { body: JSON.stringify({}) } : {}),
    });
    await load();
    setToast(action === "resolve" ? "Watch reason resolved" : action === "renew" ? "Watching the next cycle" : "Kept this watch reason active");
  }

  if (!item && !error) return <LoadingState label="Loading simulated market data…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!item) return null;
  const snapshot = item.snapshot;
  const active = intents.filter((intent) => intent.status === "ACTIVE");
  const hasAttention = attention !== null && attention.lane !== "QUIET";

  return (
    <>
      <Link href="/watchlist" className="back-link"><ArrowLeft size={16} /> Back to watchlist</Link>
      <div className="stock-hero">
        <div><div className="symbol-line"><h1>{item.instrument.symbol}</h1><span>{item.instrument.exchange}</span></div><p>{item.instrument.name}</p><DemoBadge /></div>
        {snapshot ? <Price pricePaise={snapshot.pricePaise} changePercent={snapshot.dayChangePercent} large /> : null}
      </div>
      <div className="two-column">
        <div className="stack">
          <section className={`card section-card since-card ${hasAttention ? "since-card-new" : ""}`} data-testid="stock-since-section">
            <div className="section-title"><div><p className="eyebrow">Since you last looked</p><h2>{hasAttention ? attention.display.headline : "Nothing new since you last acknowledged this stock."}</h2></div>{hasAttention ? <span className="new-pill">NEW</span> : <span className="watch-status watch-status-quiet">CAUGHT UP</span>}</div>
            {hasAttention ? (
              <>
                <p>{attention.display.whySeeing}</p>
                {attention.display.watchReason ? <p><strong>You&apos;re watching:</strong> {attention.display.watchReason}</p> : null}
                {attention.display.connectionPath.length ? <div className="connection-path" aria-label="Why this update was shown">{attention.display.connectionPath.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div> : null}
                {attention.display.additionalSignals.map((signal) => <p className="additional-signal" key={signal}>{signal}</p>)}
                <p className="price-transition">{formatINRFromPaise(attention.baselinePricePaise)} → {formatINRFromPaise(attention.currentPricePaise)}</p>
                <Button variant="secondary" onClick={() => void markSeen()}><Check size={15} /> Mark seen</Button>
              </>
            ) : <p className="muted">Viewing this page does not mark future changes as seen.</p>}
          </section>
          <section className="card section-card">
            <div className="section-title"><div><p className="eyebrow">Why you&apos;re watching</p><h2>Watch reasons</h2></div></div>
            <IntentList active={active} all={intents} onEdit={(intent) => setEditing(intent)} onAdd={() => setEditing(null)} onArchive={(intent) => void archiveIntent(intent)} />
          </section>
          <RelatedDrivers intents={active} onChanged={load} />
          <WatchLifecycle lifecycle={lifecycle.lifecycle} timeline={lifecycle.timeline} intents={intents} onAction={lifecycleAction} onChange={(intent) => setEditing(intent)} />
          <section className="card section-card">
            <div className="section-title"><div><p className="eyebrow">Current simulated market</p><h2>Market snapshot</h2></div><DemoBadge /></div>
            {snapshot ? (
              <dl className="metric-grid">
                <div><dt>Open</dt><dd>{formatINRFromPaise(snapshot.openPaise)}</dd></div>
                <div><dt>High</dt><dd>{formatINRFromPaise(snapshot.highPaise)}</dd></div>
                <div><dt>Low</dt><dd>{formatINRFromPaise(snapshot.lowPaise)}</dd></div>
                <div><dt>Volume</dt><dd>{formatCompactNumber(snapshot.cumulativeVolume)}</dd></div>
              </dl>
            ) : <p className="muted">No snapshot is available.</p>}
          </section>
        </div>
        <aside className="card section-card data-source-card">
          <div className="section-title"><h2>Data source</h2></div>
          <dl className="detail-list">
            <div><dt>Provider</dt><dd>ReplayMarketProvider</dd></div>
            <div><dt>Scenario</dt><dd>{demo?.scenario.id ?? "groww-delta-default"}</dd></div>
            <div><dt>Current market time</dt><dd>{demo ? `${formatISTTime(demo.currentTime)} IST` : "—"}</dd></div>
            <div><dt>Quality</dt><dd>{snapshot?.quality ?? "—"}</dd></div>
          </dl>
          <p className="source-note">These prices are deterministic demo values. They are not live NSE quotes.</p>
          <Link href="/demo" className="button button-secondary">Open demo controls</Link>
        </aside>
      </div>
      {editing !== undefined ? <IntentEditor open instrumentName={item.instrument.name} intent={editing} onClose={() => setEditing(undefined)} onSave={saveIntent} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
