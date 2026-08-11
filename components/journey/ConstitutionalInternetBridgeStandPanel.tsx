'use client';

/**
 * ConstitutionalInternetBridgeStandPanel — the Constitutional Internet
 * Bridge's STAND stage UI.
 *
 * Rebuilt 2026-08-11 (integration pass) into the three-part Bridge-scale
 * surface the operator asked for — NOT the full Standing Cartridge embedded
 * wholesale:
 *
 *   1. Your Standing — reuses "the proven Horizen standing summary": the
 *      SAME `/api/wallet/tasks` lanes (Personal/Delegated/Stewardship/
 *      Capability + overall + bucket) ParticipationStandingTab.tsx renders
 *      for Horizen — evidence-derived only (services/crm/
 *      standingAccrualService.ts's event-driven accrual on completeTask;
 *      no Passport/delegation/availability input anywhere in this pipeline
 *      — confirmed before reuse, not assumed).
 *   2. Why — recent receipted contribution history + DVN posture, same
 *      `/api/assistant/receipts` source and `ActivityReceiptCard` detail
 *      view Horizen's own Standing tab uses.
 *   3. Earn Standing — the operator's real work-log input affordances
 *      (Log action / Add document), composed via the SAME
 *      `StandingSignalsPanel` the full Standing Cartridge uses — not
 *      forked — plus "Open Standing →" into the full cartridge for
 *      Guided Wizards (including the always-free Standing Core wizard),
 *      full Work Log, profiles, Reach, and deeper Standing operations.
 *
 * "Open Standing →" stays embedded (the journey-wide embedding invariant —
 * no pop-out navigation inside the Bridge): it swaps this panel's own body
 * for an iframe of the canonical Standing Cartridge, mirroring
 * ConstitutionalInternetBridgeChooseSurface.tsx's identical toggle-to-embed
 * pattern for "Continue reading"/"Meet aigentMe".
 *
 * This intentionally REPLACES the prior CI-only `computeStandingScore`/
 * services/journey/constitutionalInternetBridgeStand.ts pipeline (a
 * DIFFERENT, VSP-veracity-composite Standing calculation with no lanes) —
 * the operator explicitly asked for the Personal/Delegated/Stewardship/
 * Capability lanes, which only the `/api/wallet/tasks` pipeline produces.
 * That older service/route are left in place (still reachable, unused by
 * this panel) rather than deleted in this pass — a separate cleanup, not
 * required to ship this surface.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Award, ClipboardList, ReceiptText, ShieldCheck, X } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import { ActivityReceiptCard, type ActivityReceiptData } from '@/components/metame/cards/ActivityReceiptCard';
import { StandingSignalsPanel } from '@/components/metame/standing/StandingSignalsPanel';

interface StandingLanes {
  personal: number;
  delegated: number;
  stewardship: number;
  capability: number;
  overall: number;
  bucket: number;
}

const LANES: Array<{ key: keyof StandingLanes; label: string; color: string; tip: string }> = [
  { key: 'personal', label: 'Personal', color: 'bg-cyan-400', tip: 'Accrues from your own completed, receipted work' },
  { key: 'delegated', label: 'Delegated', color: 'bg-violet-400', tip: 'Accrues from work your bounded delegates complete under your authority' },
  { key: 'stewardship', label: 'Stewardship', color: 'bg-emerald-400', tip: 'Accrues from sponsoring and stewarding other participants' },
  { key: 'capability', label: 'Capability', color: 'bg-amber-400', tip: 'Accrues from validated capabilities exercised on the platform' },
];

interface ConstitutionalInternetBridgeStandPanelProps {
  personaId?: string;
}

export function ConstitutionalInternetBridgeStandPanel({ personaId }: ConstitutionalInternetBridgeStandPanelProps) {
  const [standing, setStanding] = useState<StandingLanes | null>(null);
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [personaDisplayLabel, setPersonaDisplayLabel] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFull, setOpenFull] = useState(false);

  const load = useCallback(async () => {
    if (!personaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, receiptsRes] = await Promise.allSettled([
        personaFetch('/api/wallet/tasks', { cache: 'no-store', personaIdHint: personaId }),
        personaFetch('/api/assistant/receipts?limit=10', { cache: 'no-store', personaIdHint: personaId }),
      ]);
      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const data = await tasksRes.value.json();
        if (data?.standing) setStanding(data.standing as StandingLanes);
      } else {
        setError('Sign in with a persona to see your standing.');
      }
      if (receiptsRes.status === 'fulfilled' && receiptsRes.value.ok) {
        const data = await receiptsRes.value.json();
        setReceipts((data?.receipts ?? []) as ActivityReceiptData[]);
        setPersonaDisplayLabel(data?.personaDisplayLabel ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Standing load failed');
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (openFull) {
    const src = buildCodexUrl('standing-cartridge', { tab: 'standing', personaId, shell: 'embed', suppressCopilot: true });
    return (
      <div className="relative h-[36rem] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
        <iframe src={src} title="Standing Cartridge" className="h-full w-full border-0" />
        <button
          type="button"
          onClick={() => setOpenFull(false)}
          aria-label="Back to Bridge Standing summary"
          title="Back to Bridge Standing summary"
          className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!personaId) {
    return <p className="text-xs text-slate-400">Claim your Passport to see your constitutional standing.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-amber-300">{error}</p>}

      {/* 1. Your Standing */}
      <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <Award className="h-4 w-4 text-violet-300" /> Your Standing
          </h3>
          {standing && (
            <span className="text-xs text-slate-400">
              overall <span className="font-semibold text-slate-100">{standing.overall.toFixed(1)}</span>
              <span className="ml-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                band {standing.bucket}
              </span>
            </span>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : standing ? (
          <div className="space-y-1.5">
            {LANES.map(({ key, label, color, tip }) => {
              const value = Number(standing[key]) || 0;
              return (
                <div key={key} className="flex items-center gap-3" title={tip}>
                  <span className="w-20 text-[11px] text-slate-400">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value * 10)}%` }} />
                  </div>
                  <span className="w-8 text-right text-[11px] text-slate-300">{value.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs italic text-slate-500">
            No standing record yet — Standing accrues from receipted contributions. Passport makes you eligible to
            earn it; it does not itself move this number.
          </p>
        )}
      </div>

      {/* 2. Why */}
      <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
          <ReceiptText className="h-4 w-4 text-emerald-300" /> Why
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : receipts.length === 0 ? (
          <p className="text-xs italic text-slate-500">No receipts yet — contributions appear here as they are receipted.</p>
        ) : (
          <div className="space-y-1">
            {receipts.map((r) => {
              const expanded = expandedReceiptId === r.id;
              return (
                <div key={r.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedReceiptId(expanded ? null : r.id)}
                    className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-white/10"
                  >
                    <span className="shrink-0 rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                      {r.actionType}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-300" title={r.summary}>{r.summary}</span>
                    {r.dvnReceiptId ? (
                      <span className="flex shrink-0 items-center gap-1 text-emerald-400" title={`DVN-anchored · ${r.dvnReceiptId}`}>
                        <ShieldCheck className="h-3 w-3" /> anchored
                      </span>
                    ) : (
                      <span className="shrink-0 text-slate-500">{r.receiptStatus}</span>
                    )}
                    <span className="shrink-0 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
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

      {/* 3. Earn Standing */}
      <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
          <ClipboardList className="h-4 w-4 text-amber-300" /> Earn Standing
        </h3>
        <StandingSignalsPanel personaId={personaId} />
        <button
          type="button"
          onClick={() => setOpenFull(true)}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-indigo-400/30 hover:text-white"
        >
          Open Standing →
        </button>
      </div>
    </div>
  );
}

export default ConstitutionalInternetBridgeStandPanel;
