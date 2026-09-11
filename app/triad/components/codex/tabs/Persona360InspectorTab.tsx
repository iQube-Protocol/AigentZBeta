"use client";

/**
 * Persona360InspectorTab — global-admin inspector for the persona
 * identity / asset graph. Lookup by display label, email, FIO handle,
 * or persona id; renders the full T1-safe graph via the shared
 * PersonaAssetGraphView component.
 *
 * Sits under metame-codex/admin/persona-360. Global-admin only
 * (gated server-side by /api/admin/persona-graph).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, User as UserIcon } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  PersonaAssetGraphView,
  type PersonaAssetGraphPayload,
} from "@/components/metame/admin/PersonaAssetGraphView";

interface SearchHit {
  personaId: string;
  displayLabel: string | null;
  fioHandle: string | null;
  email: string | null;
}

export function Persona360InspectorTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [graph, setGraph] = useState<PersonaAssetGraphPayload | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await personaFetch(
        `/api/admin/persona-graph/search?q=${encodeURIComponent(term.trim())}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Search failed.');
        setResults([]);
        return;
      }
      setResults((json.results ?? []) as SearchHit[]);
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce typing — avoid one query per keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const loadGraph = useCallback(async (hit: SearchHit) => {
    setSelected(hit);
    setGraph(null);
    setGraphLoading(true);
    setError(null);
    try {
      const res = await personaFetch(
        `/api/admin/persona-graph?personaId=${encodeURIComponent(hit.personaId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Failed to load graph.');
        return;
      }
      setGraph(json.graph as PersonaAssetGraphPayload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-violet-400" />
          Persona 360
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Look up any persona by display label, email, FIO handle, or persona id. The graph below
          composes existing spine resolvers — never forks them — so the values you see are the same
          ones the runtime gates resolve from.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="w-4 h-4 absolute top-2.5 left-2.5 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by label / email / FIO handle / persona id…"
          className="w-full pl-8 pr-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      {searching && (
        <div className="text-xs text-slate-500">Searching…</div>
      )}

      {!searching && results.length > 0 && (
        <ul className="space-y-1.5 max-w-xl">
          {results.map((hit) => (
            <li key={hit.personaId}>
              <button
                type="button"
                onClick={() => void loadGraph(hit)}
                className={`w-full text-left rounded-md border px-3 py-2 transition ${
                  selected?.personaId === hit.personaId
                    ? 'bg-violet-500/15 border-violet-500/60'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="text-sm text-slate-100">
                  {hit.displayLabel || hit.email || hit.fioHandle || hit.personaId}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {[hit.email, hit.fioHandle, hit.personaId.slice(0, 8) + '…']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm px-3 py-2 max-w-xl">
          {error}
        </div>
      )}

      {selected && (
        <div className="border-t border-slate-700/40 pt-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-slate-100">
              {selected.displayLabel || selected.email || selected.fioHandle || selected.personaId}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadGraph(selected)}
              disabled={graphLoading}
              className="text-slate-300"
            >
              Refresh
            </Button>
          </div>
          {graphLoading && (
            <div className="text-sm text-slate-500 py-8 text-center">Loading graph…</div>
          )}
          {!graphLoading && graph && (
            <PersonaAssetGraphView graph={graph} layout="cards" />
          )}
        </div>
      )}
    </div>
  );
}

export default Persona360InspectorTab;
