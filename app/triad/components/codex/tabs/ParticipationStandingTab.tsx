"use client";

/**
 * ParticipationStandingTab — Participation → Standing (v1, 2026-07-18).
 *
 * The participant's constitutional standing, kept deliberately lean per the
 * ratified Participation v1 IA: Standing lanes, reach, receipts, and
 * contribution history. Nothing more.
 *
 * Composes existing organs — /api/wallet/tasks (standing + reputation lanes,
 * spine Bearer) and /api/assistant/receipts (the persona's receipted
 * contribution history) — no new server surface.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Loader2, ReceiptText, ShieldCheck } from 'lucide-react';
import { authedFetchHeaders } from '@/utils/supabaseBrowser';

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

interface ReceiptRow {
  id: string;
  actionType: string;
  summary: string;
  receiptStatus: string;
  dvnReceiptId: string | null;
  createdAt: string;
}

const LANES: Array<{ key: keyof StandingLanes; label: string; color: string; tip: string }> = [
  { key: 'personal', label: 'Personal', color: 'bg-cyan-400', tip: 'Accrues from your own completed, receipted work' },
  { key: 'delegated', label: 'Delegated', color: 'bg-violet-400', tip: 'Accrues from work your bounded delegates complete under your authority' },
  { key: 'stewardship', label: 'Stewardship', color: 'bg-emerald-400', tip: 'Accrues from sponsoring and stewarding other participants' },
  { key: 'capability', label: 'Capability', color: 'bg-amber-400', tip: 'Accrues from validated capabilities exercised on the platform' },
];

export function ParticipationStandingTab() {
  const [standing, setStanding] = useState<StandingLanes | null>(null);
  const [reach, setReach] = useState<Reach | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders({ Accept: 'application/json' });
      const init: RequestInit = { cache: 'no-store', headers: headers ?? undefined };
      const [tasksRes, receiptsRes] = await Promise.allSettled([
        fetch('/api/wallet/tasks', init),
        fetch('/api/assistant/receipts?limit=25', init),
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
        setReceipts((data?.receipts ?? []) as ReceiptRow[]);
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading standing…
      </div>
    );
  }

  return (
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
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipationStandingTab;
