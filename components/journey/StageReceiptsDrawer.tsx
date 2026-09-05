'use client';

/**
 * StageReceiptsDrawer — Guided Journey Runtime evidence chain (deferred
 * item from PRD-GJR-001's Register/Verify/Claim rows, built 2026-07-31 now
 * that all three stages write real receipts). Collapsed by default so the
 * stage viewport isn't dominated by receipt chrome; fetches on first
 * expand, never eagerly for every stage on every render.
 *
 * Reuses ActivityReceiptCard (components/metame/cards/ActivityReceiptCard.tsx)
 * exactly — the same render contract every other receipt surface in the
 * platform uses, never a second receipt-rendering component.
 *
 * ── CFS-055 coherence pass (2026-08-10) ─────────────────────────────────
 *
 * Prior defect (the coherence matrix's confirmed canary, Passport/Register/
 * Orient/Stand): this drawer used to run its OWN type-only receipt search
 * to decide whether evidence exists — a second, independent observation of
 * the same predicate the state route's canonical POSIT resolution already
 * settled. That produced exactly the contradiction inv.engineering.258
 * ("Receipts Prove; State Resolves") forbids: a stage COMPLETE from a
 * settled/table record with no matching receipt type (Passport, Register's
 * legacy receipts, Orient's precedent path) rendered its drawer as "No
 * receipts recorded for this stage yet" — a flat contradiction of the
 * stepper standing one column over. Stand had the opposite failure: the
 * unscoped, unfiltered search could surface a GOVERNED-CORRECTION-superseded
 * `standing_accrued` receipt as if it were current evidence.
 *
 * Fix: `canonicalEvidencePresent`/`canonicalReceiptRefs` — the SAME
 * evidence keys and receipt ids the state route's POSIT resolution already
 * produced for this stage/predicate — are now the PRIMARY, authoritative
 * source. `canonicalReceiptRefs` are hydrated by exact id (never a fresh
 * type/agent search — see `/api/assistant/receipts?ids=`). An established
 * evidence key with NO backing receipt id (the settled-fact case) renders
 * as "established from canonical record", never as absent. The old
 * type-only search survives ONLY as an explicitly-labeled, collapsed
 * "historical / supplementary" section that can never contradict the
 * primary section's own established/unresolved posture.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Receipt as ReceiptIcon, Loader2, ShieldCheck } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { ActivityReceiptCard, type ActivityReceiptData } from '@/components/metame/cards/ActivityReceiptCard';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface StageReceiptsDrawerProps {
  receiptTypes: readonly string[];
  /**
   * Narrows the query to receipts naming ANY of these agents as a subject
   * (operator directive, 2026-08-08 — the Register cross-agent contamination
   * defect: MoneyPenny's Register stage displayed Aigent Nakamoto's
   * `HORIZEN_AGENT_REGISTERED` receipt, because the drawer's query filtered
   * only by actionType and the ACTING persona, never by the receipt's
   * subject — and the same operator persona had registered both agents).
   *
   * Pass this ONLY when every type in `receiptTypes` is verified
   * subject-tagged (JourneyStageDefinition.receiptsScopedToSubjectAgent) —
   * omitting it preserves the prior, unfiltered behavior for stages not yet
   * audited (e.g. Verify's agreement_formed/agreement_authorized, tagged
   * only with the orchestrator, never a subject agent).
   */
  agentsInvoked?: readonly string[];
  /**
   * The canonical evidence keys this predicate's POSIT resolution already
   * established (`resolution.stages[stageId].evidencePresent`, or a
   * sub-predicate projection's own `evidenceRefs`) — PRIMARY source, never
   * re-decided by this component. May be non-empty even when
   * `canonicalReceiptRefs` is empty (a settled-fact/table-derived predicate
   * with no backing receipt — Passport, Register's legacy path, Orient's
   * precedent path).
   */
  canonicalEvidencePresent?: readonly string[];
  /**
   * The canonical receipt ids backing that evidence
   * (`resolution.stages[stageId].receiptRefs`, or a sub-predicate
   * projection's own `receiptRefs`) — hydrated by EXACT id, never by a
   * fresh type/agent search.
   */
  canonicalReceiptRefs?: readonly string[];
}

function humanizeEvidenceKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function StageReceiptsDrawer({
  receiptTypes,
  agentsInvoked,
  canonicalEvidencePresent,
  canonicalReceiptRefs,
}: StageReceiptsDrawerProps) {
  const [open, setOpen] = useState(false);

  const evidencePresent = canonicalEvidencePresent ?? [];
  const canonicalIds = canonicalReceiptRefs ?? [];
  const hasCanonicalEvidence = evidencePresent.length > 0;

  // ── PRIMARY — hydrate the canonical receiptRefs by exact id ──────────────
  const [canonicalLoading, setCanonicalLoading] = useState(false);
  const [canonicalLoaded, setCanonicalLoaded] = useState(false);
  const [canonicalReceipts, setCanonicalReceipts] = useState<ActivityReceiptData[]>([]);
  const [canonicalPersonaLabel, setCanonicalPersonaLabel] = useState<string | null>(null);

  const loadCanonical = useCallback(async () => {
    if (canonicalIds.length === 0) return;
    setCanonicalLoading(true);
    try {
      const res = await personaFetch(`/api/assistant/receipts?ids=${canonicalIds.join(',')}&limit=${canonicalIds.length}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'journey/receipts-canonical');
        setCanonicalReceipts(Array.isArray(json.receipts) ? json.receipts : []);
        setCanonicalPersonaLabel(json.personaDisplayLabel ?? null);
      }
    } catch {
      // Soft-fail — the primary evidence keys still render honestly below.
    } finally {
      setCanonicalLoading(false);
      setCanonicalLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalIds.join(',')]);

  // ── SECONDARY — the old type-only search, kept as explicitly-labeled,
  // non-authoritative historical/supplementary evidence only. ─────────────
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [personaLabel, setPersonaLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (receiptTypes.length === 0) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ actionType: receiptTypes.join(','), limit: '20' });
      if (agentsInvoked && agentsInvoked.length > 0) params.set('agentsInvoked', agentsInvoked.join(','));
      const res = await personaFetch(`/api/assistant/receipts?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'journey/receipts');
        setReceipts(Array.isArray(json.receipts) ? json.receipts : []);
        setPersonaLabel(json.personaDisplayLabel ?? null);
      }
    } catch {
      // Soft-fail — the drawer still opens, showing the historical section honestly.
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [receiptTypes, agentsInvoked]);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
    if (!loaded) void load();
    if (!canonicalLoaded) void loadCanonical();
  }, [loaded, load, canonicalLoaded, loadCanonical]);

  /*
   * A STALE SCOPE MUST NEVER RENDER AS CURRENT (operator directive,
   * 2026-08-08). This component is not remounted when the journey's
   * selected agent changes (JourneyRunSurface keys it by neither stage nor
   * agent) — only `receiptTypes`/`agentsInvoked`/the canonical props change.
   * Any change to scope invalidates both caches and, if the drawer is open,
   * refetches immediately — never waits for a manual re-toggle.
   */
  const scopeKey = `${receiptTypes.join(',')}|${(agentsInvoked ?? []).join(',')}|${canonicalIds.join(',')}|${evidencePresent.join(',')}`;
  const priorScopeKey = useRef(scopeKey);
  useEffect(() => {
    if (priorScopeKey.current === scopeKey) return;
    priorScopeKey.current = scopeKey;
    setLoaded(false);
    setReceipts([]);
    setCanonicalLoaded(false);
    setCanonicalReceipts([]);
    if (open) {
      void load();
      void loadCanonical();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  if (receiptTypes.length === 0 && !hasCanonicalEvidence) return null;

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-400 transition-colors hover:text-slate-200"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <ReceiptIcon className="h-3.5 w-3.5" />
        Evidence
        {hasCanonicalEvidence ? ` (${evidencePresent.length})` : loaded && receipts.length > 0 ? ` (${receipts.length})` : ''}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-800 p-3">
          {/* PRIMARY — canonical evidence, never re-decided by a search. */}
          {hasCanonicalEvidence ? (
            <div className="space-y-2">
              {canonicalLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading evidence…
                </div>
              ) : canonicalReceipts.length > 0 ? (
                canonicalReceipts.map((r) => (
                  <ActivityReceiptCard key={r.id} data={r} personaDisplayLabel={canonicalPersonaLabel} theme="dark" />
                ))
              ) : (
                <div className="space-y-1 rounded-md border border-emerald-900/40 bg-emerald-950/20 p-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/80">
                    <ShieldCheck className="h-3 w-3" /> Established from canonical record
                  </p>
                  <ul className="space-y-0.5 pl-1 text-xs text-slate-400">
                    {evidencePresent.map((key) => (
                      <li key={key}>{humanizeEvidenceKey(key)}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-500">
                    {canonicalIds.length === 0
                      ? 'No agent-tagged receipt exists for this fact yet — that is an audit gap, never evidence the fact did not happen.'
                      : "This fact's own receipt id is recorded but could not be loaded here."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Not yet established.</p>
          )}

          {/* SECONDARY — historical/supplementary search. Never phrased as a
              completion claim, so it can never contradict the primary block
              above (CFS-055 §7). */}
          {receiptTypes.length > 0 && (
            <div className="space-y-2 border-t border-slate-800/60 pt-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-600">Historical / supplementary receipts</p>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : receipts.length === 0 ? (
                <p className="text-xs text-slate-600">No additional receipts found in this search.</p>
              ) : (
                receipts.map((r) => <ActivityReceiptCard key={r.id} data={r} personaDisplayLabel={personaLabel} theme="dark" />)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StageReceiptsDrawer;
