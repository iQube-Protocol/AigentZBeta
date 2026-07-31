'use client';

/**
 * IQubeRegistryVocabularyTab — action vocabulary review surface.
 *
 * Stage 8+ (PRD v1.1 §A.6). Surfaces the current state of
 * services/iqube/legibility/actionMap.ts so operators can audit the
 * AccessAction ↔ IQubeAgentAction mapping coverage before approving
 * vocabulary additions in a PR.
 *
 * Read-only — vocabulary changes land via PR + CI gate (the
 * tests/iqube-legibility-actionmap.test.ts suite blocks merges without
 * updated mapping rows).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Code2,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Zap,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface VocabularyResponse {
  counts: Record<string, number>;
  health: {
    complete: boolean;
    missing_internal_keys: string[];
    orphan_surface_verbs: string[];
  };
  internal_to_surface: Array<{ internal: string; surface: string }>;
  surface_to_internal: Array<{ surface: string; internal: string }>;
  passive_verbs: string[];
  mutating_verbs: string[];
  known_access_actions: string[];
  known_surface_verbs: string[];
}

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function IQubeRegistryVocabularyTab() {
  const [data, setData] = useState<VocabularyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/admin/registry/action-vocabulary', { cache: 'no-store' });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message || 'Network error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Code2 className="w-5 h-5 text-violet-400" />
            Action Vocabulary
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            AccessAction ↔ IQubeAgentAction mapping coverage. Reviews land via PR; the CI gate at{' '}
            <code className="text-violet-300">tests/iqube-legibility-actionmap.test.ts</code> blocks merges without
            updated rows.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {data && (
        <>
          {/* Health summary */}
          <div
            className={cls(
              'flex items-start gap-3 p-4 rounded-md border',
              data.health.complete
                ? 'bg-emerald-900/20 border-emerald-700/40'
                : 'bg-amber-900/20 border-amber-700/40',
            )}
          >
            {data.health.complete ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-medium text-slate-100">
                {data.health.complete
                  ? 'Vocabulary coverage complete'
                  : 'Coverage gaps detected'}
              </div>
              <div className="text-xs text-slate-400">
                {data.counts.access_actions} AccessActions · {data.counts.surface_verbs} surface verbs ·{' '}
                {data.counts.passive_verbs} passive · {data.counts.mutating_verbs} mutating
              </div>
              {!data.health.complete && (
                <div className="text-xs text-amber-300 mt-1">
                  {data.health.missing_internal_keys.length > 0 && (
                    <div>
                      Missing internal keys: <code>{data.health.missing_internal_keys.join(', ')}</code>
                    </div>
                  )}
                  {data.health.orphan_surface_verbs.length > 0 && (
                    <div>
                      Orphan surface verbs (neither passive nor mapped):{' '}
                      <code>{data.health.orphan_surface_verbs.join(', ')}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Two-column maps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Internal → Surface */}
            <section className="border border-slate-700/50 rounded-lg overflow-hidden">
              <header className="bg-slate-800/40 px-3 py-2 text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5" />
                AccessAction → IQubeAgentAction
              </header>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-800">
                  {data.internal_to_surface.map(({ internal, surface }) => (
                    <tr key={internal} className="hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 font-mono text-slate-200 w-1/2">{internal}</td>
                      <td className="px-3 py-1.5 font-mono">
                        {surface === 'internal_only' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 text-[10px]">
                            <Lock className="w-2.5 h-2.5" />
                            internal_only
                          </span>
                        ) : (
                          <span className="text-violet-300">{surface}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Surface → Internal */}
            <section className="border border-slate-700/50 rounded-lg overflow-hidden">
              <header className="bg-slate-800/40 px-3 py-2 text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5" />
                IQubeAgentAction → AccessAction
              </header>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-800">
                  {data.surface_to_internal.map(({ surface, internal }) => (
                    <tr key={surface} className="hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 font-mono text-slate-200 w-1/2">{surface}</td>
                      <td className="px-3 py-1.5 font-mono text-violet-300">{internal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {/* Verb sets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="border border-slate-700/50 rounded-lg p-3 space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Passive Surface Verbs
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.passive_verbs.map((v) => (
                  <span
                    key={v}
                    className="text-xs px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 font-mono border border-slate-700"
                  >
                    {v}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                No internal AccessAction mapping — either descriptive (discover, read_meta, cite) or routed to
                non-access subsystems (propose_update → suggestion queue; fork → ingestion factory).
              </p>
            </section>

            <section className="border border-slate-700/50 rounded-lg p-3 space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Mutating Surface Verbs
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.mutating_verbs.map((v) => (
                  <span
                    key={v}
                    className="text-xs px-2 py-0.5 rounded bg-amber-900/30 text-amber-300 font-mono border border-amber-700/40"
                  >
                    {v}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Drives card <code>requires_authentication</code> + <code>requires_dvn_receipt</code> flags via
                cardBuilder. Adding a new mutating verb requires updating this set + the inverse map.
              </p>
            </section>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
            Vocabulary review gate per PRD v1.1 §A.6. Any addition to either enum requires a PR that updates{' '}
            <code>services/iqube/legibility/actionMap.ts</code> and passes the completeness tests at{' '}
            <code>tests/iqube-legibility-actionmap.test.ts</code>. No write surface here — this tab is the
            audit/inspect view.
          </div>
        </>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading vocabulary…
        </div>
      )}
    </div>
  );
}
