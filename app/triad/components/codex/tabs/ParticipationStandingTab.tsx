"use client";

/**
 * ParticipationStandingTab — Participation → Standing (v1, 2026-07-18;
 * Ingestion Factory pairing 2026-08-01).
 *
 * Operator correction 2026-08-01: NOT a 4-way split of Standing into
 * Standing/Reach/Receipts/Ingestion tabs. The Ingestion Factory renders
 * FULL WIDTH and UNTOUCHED — exactly as it appears in the iQube Registry
 * elsewhere (its own 3 internal tabs: Ingest New Asset / Pipeline Status /
 * Ingested Assets, plus its own Ingest Asset button) — with Standing as ONE
 * additional tab beside it, not a fork of IngestionFactoryPanel and not a
 * further split of Standing's own content. The underlying logic: assets are
 * ingested into the registry, and standing accrues from that — registry and
 * standing belong in the same place, one tab each, not standing spread
 * across three.
 *
 * Reuses the SAME `IngestionFactoryPanel` component `IQubeRegistryIntakeTab`
 * mounts (composition, not a fork — inv.engineering.036/037); the panel is
 * self-contained and reads its own canonical APIs, so no new props or
 * gating were added here. The ideal home for this pairing is arguably
 * inside IngestionFactoryPanel itself (a real 4th internal tab) — deferred
 * per operator direction; this journey-level pairing is the interim.
 *
 * Composes existing organs — /api/wallet/tasks (standing + reputation lanes,
 * spine Bearer) and /api/assistant/receipts (the persona's receipted
 * contribution history) — no new server surface.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Factory, Loader2, ReceiptText, ShieldCheck } from 'lucide-react';
// Persona-aware transport. `/api/assistant/*` and `/api/wallet/*` resolve the
// caller through the spine, and this tab is about to become PARTICIPANT-FACING
// in the Venture Lab — where a fallback persona would show one participant
// another's standing and receipts. `authedFetchHeaders` attaches the Bearer but
// carries no persona selection (CLAUDE.md, 2026-07-20 incident).
import { personaFetch } from '@/utils/personaSpine';
import { ActivityReceiptCard, type ActivityReceiptData } from '@/components/metame/cards/ActivityReceiptCard';
import { IngestionFactoryPanel } from '@/components/registry/IngestionFactoryPanel';

type StandingView = 'registry' | 'standing';

interface StandingLanes {
  personal: number;
  delegated: number;
  stewardship: number;
  capability: number;
  overall: number;
  bucket: number;
}

interface Reach {
  overall: number;
  lifetimeCvs: number;
  totalTasksCompleted: number;
}

const LANES: Array<{ key: keyof StandingLanes; label: string; color: string; tip: string }> = [
  { key: 'personal', label: 'Personal', color: 'bg-cyan-400', tip: 'Accrues from your own completed, receipted work' },
  { key: 'delegated', label: 'Delegated', color: 'bg-violet-400', tip: 'Accrues from work your bounded delegates complete under your authority' },
  { key: 'stewardship', label: 'Stewardship', color: 'bg-emerald-400', tip: 'Accrues from sponsoring and stewarding other participants' },
  { key: 'capability', label: 'Capability', color: 'bg-amber-400', tip: 'Accrues from validated capabilities exercised on the platform' },
];

export interface ParticipationStandingTabProps {
  /**
   * Pin this surface to ONE view and hide the tab strip (operator direction,
   * 2026-08-02). The Ingestion Factory and Standing were paired here as two
   * tabs; the Horizen journey now separates them into two stages — Deploy
   * renders the Factory alone, the new Standing stage renders Standing alone,
   * standalone as it was before the pairing. Unset keeps the two-tab surface
   * for every other mount, so nothing else changes.
   */
  only?: StandingView;
  /**
   * Which section of the Ingestion Factory to open on. Passed straight through
   * to `IngestionFactoryPanel`; only meaningful on the registry view.
   */
  registrySection?: "ingest" | "pipeline" | "assets";
}

export function ParticipationStandingTab({ only, registrySection }: ParticipationStandingTabProps = {}) {
  // Default 'registry': the operator lands on the Ingestion Factory, full
  // width, exactly as elsewhere — ingest first, monitor standing after.
  //
  // `only` is NOT the initial value of this state — it OVERRIDES it on every
  // render (see `view` below). Seeding `useState(only ?? 'registry')` looks
  // equivalent and is not: a mount that is REUSED with a different `only`
  // keeps the state from its first mount and silently renders the wrong
  // surface. That is exactly what happened when the Journey's Deploy and
  // Standing stages each mounted this component in the same tree position —
  // whichever the operator opened first won, and the other stage rendered its
  // content (operator report, 2026-08-02, second occurrence).
  const [pickedView, setPickedView] = useState<StandingView>('registry');
  // A pinned mount has no choice to remember; an unpinned one owns its own.
  const view: StandingView = only ?? pickedView;
  const setView = setPickedView;
  const [standing, setStanding] = useState<StandingLanes | null>(null);
  const [reach, setReach] = useState<Reach | null>(null);
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [personaDisplayLabel, setPersonaDisplayLabel] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, receiptsRes] = await Promise.allSettled([
        personaFetch('/api/wallet/tasks', { cache: 'no-store' }),
        personaFetch('/api/assistant/receipts?limit=25', { cache: 'no-store' }),
      ]);
      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const data = await tasksRes.value.json();
        if (data?.standing) setStanding(data.standing as StandingLanes);
        if (data?.reputation) {
          setReach({
            overall: Number(data.reputation.overall) || 0,
            lifetimeCvs: Number(data.reputation.lifetimeCvs) || 0,
            totalTasksCompleted: Number(data.reputation.totalTasksCompleted) || 0,
          });
        }
      }
      if (receiptsRes.status === 'fulfilled' && receiptsRes.value.ok) {
        const data = await receiptsRes.value.json();
        setReceipts((data?.receipts ?? []) as ActivityReceiptData[]);
        setPersonaDisplayLabel(data?.personaDisplayLabel ?? null);
      } else if (tasksRes.status !== 'fulfilled' || !tasksRes.value.ok) {
        setError('Sign in with a persona to see your standing.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Standing load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pinned to one view -> no switcher: a tab strip with a single reachable
  // destination is chrome that cannot act (MS-9).
  const tabStrip = only ? null : (
    <div className="flex items-center gap-0.5 px-1 pt-1">
      <button
        type="button"
        onClick={() => setView('registry')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
          view === 'registry'
            ? 'bg-violet-500/[0.12] text-violet-300 ring-1 ring-violet-500/25'
            : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
        }`}
      >
        <Factory className="h-3.5 w-3.5" />
        Ingestion Factory
      </button>
      <button
        type="button"
        onClick={() => setView('standing')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
          view === 'standing'
            ? 'bg-violet-500/[0.12] text-violet-300 ring-1 ring-violet-500/25'
            : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
        }`}
      >
        <Award className="h-3.5 w-3.5" />
        Standing
      </button>
    </div>
  );

  if (view === 'registry') {
    return (
      <div className="w-full">
        {tabStrip}
        <IngestionFactoryPanel initialSection={registrySection} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full">
        {tabStrip}
        <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading standing…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {tabStrip}
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Standing</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Your relationship with the Institute, as the record shows it: standing lanes,
            reach, and your receipted contribution history.
          </p>
        </div>
        {error && <p className="text-xs text-amber-300">{error}</p>}

        {/* Standing lanes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
              <Award className="h-4 w-4 text-violet-300" /> Standing
            </h3>
            {standing && (
              <span className="text-xs text-slate-400">
                overall <span className="text-slate-100 font-semibold">{standing.overall.toFixed(1)}</span>
                <span className="ml-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                  band {standing.bucket}
                </span>
              </span>
            )}
          </div>
          {standing ? (
            <div className="space-y-2">
              {LANES.map(({ key, label, color, tip }) => {
                const value = Number(standing[key]) || 0;
                return (
                  <div key={key} className="flex items-center gap-3" title={tip}>
                    <span className="w-24 text-[11px] text-slate-400">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value * 10)}%` }} />
                    </div>
                    <span className="w-8 text-right text-[11px] text-slate-300">{value.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No standing record yet — standing accrues from receipted contributions.</p>
          )}
        </div>

        {/* Reach */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Reach</h3>
          {reach ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold text-slate-100">{reach.overall.toFixed(1)}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Reputation</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-100">{reach.lifetimeCvs}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Lifetime CVs</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-100">{reach.totalTasksCompleted}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Tasks completed</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No reputation record yet.</p>
          )}
        </div>

        {/* Contribution history — receipted record */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <ReceiptText className="h-4 w-4 text-emerald-300" /> Contribution history
          </h3>
          {receipts.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No receipts yet — contributions appear here as they are receipted.</p>
          ) : (
            <div className="space-y-1">
              {receipts.map((r) => {
                const expanded = expandedReceiptId === r.id;
                return (
                  <div key={r.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedReceiptId(expanded ? null : r.id)}
                      className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-left transition-colors hover:bg-white/10"
                    >
                      <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">
                        {r.actionType}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-300" title={r.summary}>{r.summary}</span>
                      {r.dvnReceiptId ? (
                        <span className="flex items-center gap-1 text-emerald-400 shrink-0" title={`DVN-anchored · ${r.dvnReceiptId}`}>
                          <ShieldCheck className="h-3 w-3" /> anchored
                        </span>
                      ) : (
                        <span className="text-slate-500 shrink-0">{r.receiptStatus}</span>
                      )}
                      <span className="text-slate-500 shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </button>
                    {expanded && (
                      <div className="mt-1">
                        <ActivityReceiptCard data={r} personaDisplayLabel={personaDisplayLabel} theme="dark" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ParticipationStandingTab;
