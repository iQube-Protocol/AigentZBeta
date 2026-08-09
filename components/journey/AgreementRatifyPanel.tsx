'use client';

/**
 * AgreementRatifyPanel — the Ratify stage's PRIMARY surface (reconstitution,
 * 2026-08-06).
 *
 * ONE guided action, "Verify & Sign Agreement", sequencing the EXISTING
 * generic Constitutional Agreement lifecycle (services/constitutional/
 * constitutionalAgreement.ts via /api/constitutional/agreement: form ->
 * accept -> authorize) — never a parallel agreement store, never a new
 * signing subsystem. capabilityRef/selectedAgentRef/delegatedAuthority are
 * pre-populated from the Journey context (services/journey/
 * ratificationRefs.ts), which for `moneypenny` resolves to the EXACT
 * agreement her live Financial Services runtime gate already checks
 * (app/api/moneypenny/runtime/route.ts).
 *
 * Precise language, held to deliberately: forming/accepting produce a
 * tamper-evident COMMITMENT (agreementProviders.ts's local provider — a
 * deterministic sha256, not a cryptographic wallet signature); authorizing
 * is an AUTHENTICATED CONSTITUTIONAL ACT performed by the signed-in operator
 * (constitutionalAgreement.ts's owner-commitment check), also not a wallet or
 * blockchain signature. Never claim otherwise.
 *
 * The honest composite status line ("Service authorized · Transparency
 * pending/verified/…") reads the SAME verify/status endpoint
 * PulseTransparencyToggle itself reads (GJR-VFY-001 Phase 2) — never a second,
 * divergent derivation of Pulse/P&L state. `owner-source-conflict` is
 * reported as "conflicted", never silently folded into "pending" — the
 * Transparency section below (PulseTransparencyToggle, unmodified) renders
 * the conflict's full detail; this panel only names that it exists.
 *
 * Spine-gated route (resolves getActivePersona) — personaFetch only, never
 * raw fetch (CLAUDE.md's Identity & Access Spine rule).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import {
  resolveRatificationRefs,
  RATIFY_DELEGATED_AUTHORITY,
  RATIFY_VERIFICATION_REQUIREMENTS,
  RATIFY_GOVERNING_INVARIANTS,
} from '@/services/journey/ratificationRefs';

interface AgreementRow {
  agreementId: string;
  status: string;
}

type TransparencyLabel = 'pending' | 'verified' | 'conflicted' | 'declined' | 'not enrolled';

function transparencyLabelFor(state: string | undefined): TransparencyLabel {
  switch (state) {
    case 'complete':
      return 'verified';
    case 'owner-source-conflict':
      return 'conflicted';
    case 'denied':
      return 'declined';
    case 'not-enrolled':
      return 'not enrolled';
    default:
      // 'not-started' | 'pending' | 'expired' | unknown/unreachable — all
      // honestly "pending": no conclusive answer exists yet, never a claim
      // of completion.
      return 'pending';
  }
}

interface AgreementRatifyPanelProps {
  personaId?: string;
  agentSlug: string;
  agentDisplayName?: string;
}

export function AgreementRatifyPanel({ agentSlug, agentDisplayName }: AgreementRatifyPanelProps) {
  const refs = resolveRatificationRefs(agentSlug);
  const displayName = agentDisplayName ?? agentSlug;

  const [agreement, setAgreement] = useState<AgreementRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [transparency, setTransparency] = useState<TransparencyLabel>('pending');

  const loadAgreement = useCallback(async () => {
    try {
      const res = await personaFetch('/api/constitutional/agreement', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const rows = Array.isArray(data?.agreements) ? (data.agreements as AgreementRow[]) : [];
      setAgreement(rows.find((a) => a.agreementId === refs.agreementId) ?? null);
    } catch {
      /* best-effort — the button's own status line covers the rest */
    }
  }, [refs.agreementId]);

  const loadTransparency = useCallback(async () => {
    try {
      const res = await personaFetch(
        `/api/journey/moneypenny-horizen/verify/status?agentSlug=${encodeURIComponent(agentSlug)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      setTransparency(transparencyLabelFor(data?.state));
    } catch {
      /* best-effort — stays 'pending', the honest default */
    }
  }, [agentSlug]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadAgreement(), loadTransparency()]).finally(() => setLoading(false));
  }, [loadAgreement, loadTransparency]);

  const status = agreement?.status ?? 'not-started';
  const isAuthorized = status === 'authorized' || status === 'executed' || status === 'settled' || status === 'reconstitutable';

  const verifyAndSign = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const call = (body: Record<string, unknown>) =>
        personaFetch('/api/constitutional/agreement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }));

      const formed = await call({
        action: 'form',
        agreementId: refs.agreementId,
        displayLabel: refs.displayLabel,
        capabilityRef: refs.capabilityRef,
        selectedAgentRef: refs.selectedAgentRef,
        delegatedAuthority: RATIFY_DELEGATED_AUTHORITY,
        settlementTerms: null,
        verificationRequirements: RATIFY_VERIFICATION_REQUIREMENTS,
        governingInvariants: RATIFY_GOVERNING_INVARIANTS,
        // This is a Constitutional Financial Services agreement — CFS
        // agreements are RootDID-authority-bound, not persona-authority-
        // bound (operator directive, 2026-08-08): the persona that forms it
        // here need not be the same persona that later authorizes it, only
        // the same RootDID. Every other agreement kind formed through this
        // generic route (Threshold OAuth/service completion, etc.) omits
        // this field and stays 'PERSONA', unchanged.
        authorityBinding: 'ROOT_DID',
      });
      if (!formed.ok) throw new Error(formed.data?.error ?? 'forming the agreement failed');

      const accepted = await call({ action: 'accept', agreementId: refs.agreementId });
      if (!accepted.ok) throw new Error(accepted.data?.error ?? 'accepting the agreement failed');

      const authorized = await call({ action: 'authorize', agreementId: refs.agreementId });
      if (!authorized.ok) throw new Error(authorized.data?.error ?? 'authorizing the agreement failed');

      // Authorization can genuinely succeed (status -> 'authorized') while the
      // DVN-anchorable receipt behind it silently failed to persist — never
      // report a clean "Authorized" in that case, or Ratify staying incomplete
      // (agreementReceiptsAnchored requires BOTH receipt ids) reads as a bug
      // with no explanation.
      const receiptWarnings = [accepted.data?.receiptWarning, authorized.data?.receiptWarning].filter(Boolean) as string[];
      setNote(
        receiptWarnings.length > 0
          ? `Authorized, but ${receiptWarnings.join('; ')} — Ratify will stay incomplete until the receipt exists. Retry, or report this to the operator.`
          : `Authorized — status now '${authorized.data?.agreement?.status ?? 'authorized'}'.`,
      );
      await loadAgreement();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Verify & Sign Agreement failed');
    } finally {
      setBusy(false);
    }
  }, [refs, loadAgreement]);

  const PANEL = 'rounded-md border border-slate-800 bg-slate-900/40 p-3';

  return (
    <div className={`${PANEL} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-100">
          Constitutional Service Agreement <span className="text-slate-500">— {displayName}</span>
        </div>
        {isAuthorized ? (
          <span className="flex shrink-0 items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Ratified
          </span>
        ) : (
          <span className="shrink-0 rounded border border-slate-700 bg-slate-950/40 px-1.5 py-0.5 text-[11px] text-slate-400">
            {loading ? 'Checking…' : status === 'not-started' ? 'Not started' : status}
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Forming and accepting record a tamper-evident <em>commitment</em> — not a cryptographic wallet
        signature. Authorizing is an <em>authenticated constitutional act</em> performed by you as the
        operator, binding <span className="text-slate-400">{refs.capabilityRef}</span> for{' '}
        <span className="text-slate-400">{refs.selectedAgentRef}</span>.
      </p>

      <button
        type="button"
        onClick={() => void verifyAndSign()}
        disabled={busy || isAuthorized}
        className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:cursor-default disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAuthorized ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        {isAuthorized ? 'Agreement authorized' : busy ? 'Signing…' : 'Verify & Sign Agreement'}
      </button>

      {note && <div className="text-[11px] text-slate-400">{note}</div>}

      {isAuthorized && (
        <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
          Service authorized · Transparency {transparency}
          {transparency === 'conflicted' && (
            <span className="text-amber-300"> — see the Transparency section below for detail</span>
          )}
        </div>
      )}
    </div>
  );
}

export default AgreementRatifyPanel;
