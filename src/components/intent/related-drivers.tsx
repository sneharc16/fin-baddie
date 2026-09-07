"use client";

import { Link2, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { DriverSuggestionDto, WatchGraphDto, WatchIntentDto } from "@/server/dto/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface GraphResponse { current: WatchGraphDto | null; history: WatchGraphDto[] }

export function RelatedDrivers({ intents, onChanged }: { intents: WatchIntentDto[]; onChanged: () => Promise<void> }) {
  const [graphs, setGraphs] = useState<Record<string, GraphResponse>>({});
  const [suggestions, setSuggestions] = useState<Record<string, DriverSuggestionDto[]>>({});
  const [editing, setEditing] = useState<WatchIntentDto | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const entries: Array<readonly [string, GraphResponse, DriverSuggestionDto[]]> = [];
      for (const intent of intents) {
        const graph = await apiFetch<GraphResponse>(`/api/watch-intents/${intent.logicalIntentId}/graph`);
        const suggested = await apiFetch<{ suggestions: DriverSuggestionDto[] }>(`/api/watch-intents/${intent.logicalIntentId}/driver-suggestions`);
        entries.push([intent.logicalIntentId, graph, suggested.suggestions] as const);
      }
      setGraphs(Object.fromEntries(entries.map(([id, graph]) => [id, graph])));
      setSuggestions(Object.fromEntries(entries.map(([id, , value]) => [id, value])));
    } catch {
      setGraphs({});
      setSuggestions({});
    }
  }, [intents]);

  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  function openEditor(intent: WatchIntentDto) {
    const current = graphs[intent.logicalIntentId]?.current;
    const suggestion = suggestions[intent.logicalIntentId]?.[0];
    setSelected(current?.relatedDrivers.map((node) => node.key) ?? suggestion?.nodes.filter((node) => node.selectedByDefault).map((node) => node.key) ?? []);
    setEditing(intent);
  }

  async function save() {
    if (!editing) return;
    const suggestion = suggestions[editing.logicalIntentId]?.[0];
    const current = graphs[editing.logicalIntentId]?.current;
    if (!suggestion) return;
    setBusy(true);
    try {
      await apiFetch(`/api/watch-intents/${editing.logicalIntentId}/graph`, {
        method: current ? "PATCH" : "POST",
        body: JSON.stringify({ templateKey: suggestion.templateKey, selectedNodeKeys: selected }),
      });
      await load();
      await onChanged();
      setEditing(null);
    } finally { setBusy(false); }
  }

  const configurable = intents.filter((intent) => (suggestions[intent.logicalIntentId]?.length ?? 0) > 0);
  if (!configurable.length) return null;

  return (
    <section className="card section-card" data-testid="related-drivers-section">
      <div className="section-title"><div><p className="eyebrow">Related things you&apos;re tracking</p><h2>Configured relationships</h2></div></div>
      <div className="related-list">
        {configurable.map((intent) => {
          const graph = graphs[intent.logicalIntentId]?.current;
          return <article key={intent.logicalIntentId} className="related-row">
            <div>
              <p>{intent.originalText ?? intent.type.replaceAll("_", " ")}</p>
              {graph ? <div className="driver-chips">{graph.relatedDrivers.map((node) => <span key={node.key}>{node.label}</span>)}</div> : <span className="muted">Track related drivers too? Suggestions are optional.</span>}
              {graph ? <small>Suggested relationship · You confirmed this relationship.</small> : null}
            </div>
            <Button variant="secondary" onClick={() => openEditor(intent)}><Pencil size={14} /> {graph ? "Edit" : "Choose drivers"}</Button>
            {graphs[intent.logicalIntentId]?.history.length ? <details className="graph-history"><summary>Relationship history</summary><p>{graphs[intent.logicalIntentId].history.map((version) => `v${version.version} ${version.status.toLowerCase()}`).join(" · ")}</p></details> : null}
          </article>;
        })}
      </div>
      {editing ? <Dialog open title="Related things to track" description="Choose from a curated template. These links express relevance, not a prediction." onClose={() => setEditing(null)}>
        <div className="form-stack">
          <p className="muted">{suggestions[editing.logicalIntentId]?.[0]?.description}</p>
          <fieldset className="driver-options"><legend>Suggested related drivers</legend>
            {suggestions[editing.logicalIntentId]?.[0]?.nodes.map((node) => <label key={node.key}>
              <input type="checkbox" checked={selected.includes(node.key)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, node.key])] : current.filter((key) => key !== node.key))} />
              <span><strong>{node.label}</strong><small>{node.description}</small></span>
            </label>)}
          </fieldset>
          <div className="action-row"><Button disabled={busy} onClick={() => void save()}><Link2 size={15} /> Add selected drivers</Button><Button variant="ghost" onClick={() => setEditing(null)}>Not now</Button></div>
        </div>
      </Dialog> : null}
    </section>
  );
}
