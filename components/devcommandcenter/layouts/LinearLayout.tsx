"use client";

/**
 * LinearLayout — read-only Linear issues viewport (CFS-020 CDE).
 *
 * Served by /api/dev-command-center/linear (Linear GraphQL, LINEAR_API_KEY
 * server-side). There is NO existing Linear integration and NO key in the
 * codebase: when the key is absent the API returns `{ configured: false,
 * missingEnv: 'LINEAR_API_KEY' }` and this layout renders the honest setup
 * notice — it never invents issues. personaFetch only.
 */

import React, { useCallback, useEffect, useState } from "react";
import { KanbanSquare, RefreshCw, Loader2 } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { personaFetch } from "@/utils/personaSpine";

interface LinearIssue {
  identifier: string;
  title: string;
  state: string;
  stateCategory: string;
  assignee: string | null;
  updatedAt: string;
}

const FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "started", label: "In progress" },
  { id: "unstarted", label: "Todo" },
  { id: "completed", label: "Done" },
];

function stateColor(category: string): string {
  switch (category) {
    case "started": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "completed": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "unstarted": return "bg-slate-800 text-slate-300 border-slate-700";
    default: return "bg-slate-800 text-slate-400 border-slate-700";
  }
}

export function LinearLayout({
  onBack,
  onToolUsed,
}: {
  onBack: () => void;
  onToolUsed?: (op: string) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async (stateCategory: string) => {
    setLoading(true);
    setError(null);
    onToolUsed?.("issues");
    try {
      const qs = stateCategory ? `?stateCategory=${encodeURIComponent(stateCategory)}` : "";
      const res = await personaFetch(`/api/dev-command-center/linear${qs}`, { cache: "no-store" });
      if (res.status === 403) { setError("forbidden — Linear viewport requires an admin persona"); return; }
      const json = await res.json().catch(() => null);
      if (json?.configured === false) { setConfigured(false); setMissingEnv(json.missingEnv ?? "LINEAR_API_KEY"); return; }
      if (!res.ok || !json?.ok) { setError(json?.error ?? `unexpected response (HTTP ${res.status})`); return; }
      setConfigured(true);
      setIssues(json.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onToolUsed]);

  useEffect(() => { void load(filter); }, [load, filter]);

  const body = (
    <div className="space-y-3">
      {configured === false && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-100">
          <div className="font-semibold mb-1">Linear not configured</div>
          <div>
            Add <code>{missingEnv}</code> to the Amplify environment to activate — read-only issue access is sufficient.
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">{error}</div>
      )}

      {configured && (
        <>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-[11px] px-2 py-0.5 rounded border ${
                  filter === f.id
                    ? "bg-slate-700 text-white border-slate-500"
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {issues.length === 0 ? (
            <div className="text-[12px] text-slate-500 py-4 text-center">no issues match this filter</div>
          ) : (
            <div className="space-y-1">
              {issues.map((i) => (
                <div key={i.identifier} className="flex items-start gap-2 rounded-lg border border-slate-700/40 bg-slate-900/40 p-2">
                  <span className="text-[10.5px] font-mono text-slate-500 shrink-0 mt-0.5">{i.identifier}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-slate-200 truncate">{i.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span className={`rounded px-1 py-0.5 border ${stateColor(i.stateCategory)}`}>{i.state}</span>
                      {i.assignee && <span>{i.assignee}</span>}
                      <span>{i.updatedAt.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {configured === null && !error && (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> loading issues…
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-linear"
      disTemplateId="dev-linear-layout-v1"
      headerIcon={<KanbanSquare className="w-4 h-4" />}
      headerEyebrow="CDE tool · read-only"
      headerTitle="Linear"
      headerActions={
        <button
          onClick={() => void load(filter)}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      }
      onDismiss={onBack}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
