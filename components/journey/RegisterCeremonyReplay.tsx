'use client';

/**
 * RegisterCeremonyReplay — a non-mutating, read-only replay of the Register
 * stage's seven-step wallet-signing ceremony for an ALREADY-REGISTERED
 * agent (Pre-recording Horizen polish, part C, 2026-08-10).
 *
 * An already-registered agent MUST NOT be registered again. This component
 * exists so a recording can visually walk through the completed admission
 * ceremony without touching RegisterAgentPanel's live mutation path at all
 * — it renders ONLY the `registerCeremony` projection the state route
 * already computed, consumed via `resolveSurfaceProps` exactly like
 * `ratifySubPredicates`.
 *
 * Two authority tiers, never conflated:
 *   - `authority: 'evidence'`  — a real receipt exists (mandateSigned,
 *     invocationApproved, transactionBroadcast, horizenConfirmed,
 *     registryBindingRecorded). Expandable into its receipt.
 *   - `authority: 'inferred'`  — no receipt type exists for this step
 *     (principalWalletReady, mandatePrepared); established only because a
 *     LATER, receipted step in the same chain could not exist otherwise.
 *     Never rendered as if it had its own evidence — CLAUDE.md's
 *     no-fabrication rule applies to UI affordances, not just data.
 *
 * Built generically — any already-registered agent can have its admission
 * ceremony reconstructed this way; there is no agent-specific logic here
 * (inv.engineering.036/037: one authoritative rendering, reused).
 *
 * Renders nothing while Register has not yet canonically completed — the
 * live ceremony stays entirely owned by RegisterAgentPanel until then.
 */

import React, { useCallback, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Loader2, ShieldCheck } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { ActivityReceiptCard, type ActivityReceiptData } from '@/components/metame/cards/ActivityReceiptCard';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

export interface RegisterCeremonySubPredicate {
  predicate: string;
  established: boolean;
  authority: string;
  effectiveAt: string | null;
  evidenceRefs: string[];
  receiptRefs: string[];
  dvnStatus: string | null;
}

interface RegisterCeremonyReplayProps {
  agentSlug: string;
  registerStageEstablished?: boolean;
  registerCeremony?: Record<string, RegisterCeremonySubPredicate> | null;
}

const CEREMONY_STEPS: Array<{ key: string; label: string }> = [
  { key: 'principalWalletReady', label: 'Principal wallet ready' },
  { key: 'mandatePrepared', label: 'Mandate prepared' },
  { key: 'mandateSigned', label: 'Mandate signed' },
  { key: 'invocationApproved', label: 'Agent key invocation approved' },
  { key: 'transactionBroadcast', label: 'Transaction broadcast' },
  { key: 'horizenConfirmed', label: 'Horizen confirmed' },
  { key: 'registryBindingRecorded', label: 'Registry binding recorded' },
];

function CeremonyStepRow({ step, predicate }: { step: { key: string; label: string }; predicate: RegisterCeremonySubPredicate | undefined }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [personaLabel, setPersonaLabel] = useState<string | null>(null);

  const established = predicate?.established === true;
  const isEvidence = predicate?.authority === 'evidence';
  const isInferred = predicate?.authority === 'inferred';
  const receiptIds = predicate?.receiptRefs ?? [];
  const canExpand = isEvidence && receiptIds.length > 0;

  const load = useCallback(async () => {
    if (receiptIds.length === 0) return;
    setLoading(true);
    try {
      const res = await personaFetch(`/api/assistant/receipts?ids=${receiptIds.join(',')}&limit=${receiptIds.length}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'journey/register-ceremony-receipts');
        setReceipts(Array.isArray(json.receipts) ? json.receipts : []);
        setPersonaLabel(json.personaDisplayLabel ?? null);
      }
    } catch {
      // Soft-fail — the step still renders its established/proven posture honestly.
    } finally {
      setLoading(false);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptIds.join(',')]);

  const toggle = useCallback(() => {
    if (!canExpand) return;
    setOpen((o) => !o);
    if (!loaded) void load();
  }, [canExpand, loaded, load]);

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/30">
      <button
        type="button"
        onClick={toggle}
        disabled={!canExpand}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
          canExpand ? 'cursor-pointer transition-colors hover:bg-slate-900/40' : 'cursor-default'
        }`}
      >
        {canExpand ? open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : (
          <span className="w-3.5 shrink-0" />
        )}
        {established ? (
          isInferred ? (
            <CircleDashed className="h-3.5 w-3.5 shrink-0 text-emerald-500/60" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          )
        ) : (
          <CircleDashed className="h-3.5 w-3.5 shrink-0 text-slate-600" />
        )}
        <span className={established ? 'text-slate-200' : 'text-slate-500'}>{step.label}</span>
        {isInferred && established && (
          <span className="ml-auto shrink-0 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-400/70">
            Implied — no receipt
          </span>
        )}
        {isEvidence && established && (
          <span className="ml-auto shrink-0 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-400/70">
            Proven
          </span>
        )}
      </button>
      {open && canExpand && (
        <div className="space-y-2 border-t border-slate-800/60 p-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading evidence…
            </div>
          ) : receipts.length > 0 ? (
            receipts.map((r) => <ActivityReceiptCard key={r.id} data={r} personaDisplayLabel={personaLabel} theme="dark" />)
          ) : (
            <p className="text-xs text-slate-600">This step's receipt id is recorded but could not be loaded here.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function RegisterCeremonyReplay({ registerStageEstablished, registerCeremony }: RegisterCeremonyReplayProps) {
  if (!registerStageEstablished || !registerCeremony) return null;

  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" /> Established / Replay — historical admission ceremony
      </p>
      <p className="text-xs text-slate-500">
        This agent is already registered. What follows is a read-only reconstruction of the ceremony that
        registered it, from canonical evidence — not a control, and it cannot be re-run here.
      </p>
      <div className="space-y-1.5">
        {CEREMONY_STEPS.map((step) => (
          <CeremonyStepRow key={step.key} step={step} predicate={registerCeremony[step.key]} />
        ))}
      </div>
    </div>
  );
}

export default RegisterCeremonyReplay;
