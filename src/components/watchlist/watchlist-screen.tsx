"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatchUpDto, InstrumentDto, IntentLifecycleDto, WatchIntentDto, WatchlistDto, WatchlistItemDto } from "@/server/dto/types";
import type { AttentionLane } from "@/domain/attention/types";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { DemoBadge, ErrorState, LoadingState } from "@/components/ui/status";
import { IntentEditor } from "@/components/intent/intent-editor";
import { AddStockDialog } from "./add-stock-dialog";
import { WatchlistRow } from "./watchlist-row";

export function WatchlistScreen() {
  const [data, setData] = useState<WatchlistDto | null>(null);
  const [instruments, setInstruments] = useState<InstrumentDto[]>([]);
  const [attention, setAttention] = useState<Map<string, AttentionLane>>(new Map());
  const [lifecycle, setLifecycle] = useState<Map<string, IntentLifecycleDto[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: WatchlistItemDto; intent: WatchIntentDto | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [watchlist, universe, catchUp] = await Promise.all([
        apiFetch<WatchlistDto>("/api/watchlist"),
        apiFetch<{ instruments: InstrumentDto[] }>("/api/instruments"),
        apiFetch<CatchUpDto>("/api/catch-up"),
      ]);
      setData(watchlist);
      setInstruments(universe.instruments);
      setAttention(new Map([...catchUp.relevant, ...catchUp.significant, ...catchUp.quiet].map((item) => [item.instrument.id, item.lane])));
      const grouped = new Map<string, IntentLifecycleDto[]>();
      for (const state of catchUp.intentLifecycle) grouped.set(state.instrumentId, [...(grouped.get(state.instrumentId) ?? []), state]);
      setLifecycle(grouped);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load the watchlist.");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const available = useMemo(() => {
    const active = new Set(data?.items.map((item) => item.instrument.id));
    return instruments.filter((instrument) => !active.has(instrument.id));
  }, [data, instruments]);

  async function addStock(instrument: InstrumentDto) {
    setBusyId(instrument.id);
    try {
      await apiFetch("/api/watchlist/items", { method: "POST", body: JSON.stringify({ instrumentId: instrument.id }) });
      await load();
      setAddOpen(false);
      setToast("Added to watchlist");
      setEditing({
        item: { id: "", addedAt: "", provenanceSource: "MANUAL", provenanceReference: null, instrument, snapshot: null, activeIntents: [] },
        intent: null,
      });
    } catch (caught: unknown) {
      setToast(caught instanceof Error ? caught.message : "Could not add the stock.");
    } finally { setBusyId(null); }
  }

  async function removeStock(item: WatchlistItemDto) {
    if (!window.confirm(`Remove ${item.instrument.symbol} from your watchlist? Watch reason history will be preserved.`)) return;
    try {
      await apiFetch(`/api/watchlist/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await load();
      setToast("Removed from watchlist");
    } catch (caught: unknown) { setToast(caught instanceof Error ? caught.message : "Could not remove the stock."); }
  }

  async function saveIntent(input: Parameters<React.ComponentProps<typeof IntentEditor>["onSave"]>[0]) {
    if (!editing) return;
    const url = editing.intent ? `/api/watch-intents/${editing.intent.logicalIntentId}` : "/api/watch-intents";
    const body = editing.intent ? input : { instrumentId: editing.item.instrument.id, intent: input };
    await apiFetch(url, { method: editing.intent ? "PATCH" : "POST", body: JSON.stringify(body) });
    await load();
    setToast(editing.intent ? "Watch reason updated" : "Watch reason added");
  }

  if (!data && !error) return <LoadingState label="Loading your watchlist…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!data) return null;

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">The Living Watchlist</p><h1>{data.watchlist.name}</h1><p>Prices and saved context together, without recommendations or artificial urgency.</p></div>
        <Button onClick={() => setAddOpen(true)}><Plus size={17} /> Add stock</Button>
      </div>
      <div className="watchlist-meta"><span>{data.items.length} stocks</span><DemoBadge /></div>
      <section className="card watchlist-card" aria-label="Watchlist stocks">
        <div className="watchlist-head"><span>Instrument</span><span>Current price</span><span>Why you&apos;re watching</span><span /></div>
        {data.items.length ? data.items.map((item) => (
          <WatchlistRow key={item.id} item={item} attentionLane={attention.get(item.instrument.id) ?? "QUIET"} lifecycle={lifecycle.get(item.instrument.id) ?? []} onEdit={(row, intent) => setEditing({ item: row, intent })} onAddReason={(row) => setEditing({ item: row, intent: null })} onRemove={(row) => void removeStock(row)} />
        )) : <div className="state-message">Your watchlist is empty. Add a demo stock to begin.</div>}
      </section>
      <AddStockDialog open={addOpen} instruments={available} busyId={busyId} onClose={() => setAddOpen(false)} onAdd={(instrument) => void addStock(instrument)} />
      {editing ? <IntentEditor open instrumentName={editing.item.instrument.name} intent={editing.intent} onClose={() => setEditing(null)} onSave={saveIntent} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
