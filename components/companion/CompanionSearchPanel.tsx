/**
 * CompanionSearchPanel — Universal Search UI (Companion popup, third surface).
 *
 * PRD-MMC-IMPL-002 Increment 1 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Surface-agnostic, mirroring `ObserverGrantPanel`'s own contract: takes only
 * `personaIdHint`, uses `personaFetch` (never a raw `fetch` — CLAUDE.md
 * PARAMOUNT client-spine-fetch rule) against the new
 * `GET /api/companion/search?q=` façade, and renders results as clickable
 * rows that deep-link out via `buildCodexUrl()` (CLAUDE.md's canonical
 * inter-cartridge nav helper — never a bespoke URL). Styling is the
 * canonical slate house style only (`border-slate-800` / `bg-slate-900/40`,
 * no white hairlines).
 */

"use client";

import { useCallback, useState } from "react";

import { personaFetch } from "@/utils/personaSpine";
import { buildCodexUrl } from "@/utils/codex-nav";
import type { CompanionSearchResult } from "@/types/companionSearch";

const SEARCH_ENDPOINT = "/api/companion/search";

const SOURCE_LABEL: Record<CompanionSearchResult["source"], string> = {
  research: "Research",
  "registry-iqube": "Registry · iQube",
  "registry-asset": "Registry · Asset",
  "registry-library": "Registry · Library",
  capability: "Capability",
};

export interface CompanionSearchPanelProps {
  /** T1 persona hint threaded onto the `personaFetch` call and the outbound
   *  `buildCodexUrl()` deep links. Never rendered as text in this component. */
  personaIdHint: string;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

export function CompanionSearchPanel({ personaIdHint }: CompanionSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CompanionSearchResult[]>([]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setStatus("idle");
        setError(null);
        return;
      }
      setStatus("loading");
      setError(null);
      try {
        const res = await personaFetch(
          `${SEARCH_ENDPOINT}?q=${encodeURIComponent(trimmed)}`,
          { personaIdHint, cache: "no-store" },
        );
        if (!res.ok) {
          setError(await readErrorMessage(res, `Search failed (${res.status}).`));
          setStatus("error");
          return;
        }
        const body = (await res.json()) as { results: CompanionSearchResult[] };
        setResults(body.results ?? []);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [personaIdHint],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="text-sm font-semibold text-slate-200">Search</div>
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query);
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search research, registry, capabilities…"
            className="min-w-0 flex-1 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-50"
          >
            {status === "loading" ? "…" : "Search"}
          </button>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error ? (
          <div className="mb-2 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        ) : null}

        {status === "idle" ? (
          <div className="text-xs text-slate-500">
            Search across research, the registry, and the capability graph.
          </div>
        ) : null}

        {status === "ready" && results.length === 0 ? (
          <div className="text-xs text-slate-500">No results for &ldquo;{query}&rdquo;.</div>
        ) : null}

        {results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((result, i) => (
              <li key={`${result.source}-${result.ref}-${i}`}>
                <a
                  href={buildCodexUrl(result.target.slug, {
                    tab: result.target.tab,
                    personaId: personaIdHint,
                  })}
                  className="block rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 transition-colors hover:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-xs text-slate-200">{result.title}</div>
                    <span className="shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {SOURCE_LABEL[result.source]}
                    </span>
                  </div>
                  {result.subtitle ? (
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">{result.subtitle}</div>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default CompanionSearchPanel;
