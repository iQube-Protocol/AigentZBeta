'use client';

/**
 * MarketaEligibilityView — the Claim stage's surface.
 *
 * ── WHAT THIS SURFACE IS NOW (operator ruling, 2026-08-03) ─────────────────
 *
 *   Claim complete = registration established + wallet control proven
 *
 * It previously rendered Marketa's admission DECISION as Claim's outcome, and
 * offered "Prove wallet control" unconditionally. Both were wrong once the
 * admission spine was reconstituted as
 * Register → Claim → Passport → Delegate → aigentMe, with financial-services
 * enrichment (Marketa, Pulse, P&L) non-blocking and after aigentMe:
 *
 *   1. A Marketa decision is not Claim's outcome and must not gate it. A
 *      missing assessments table therefore surfaced as a Claim failure sitting
 *      directly above an already-recorded control-proof receipt.
 *   2. An act already performed must stop being offered. The button rendered
 *      forever because this surface had no way to observe the existing proof —
 *      it asked the server for an assessment, never for control state.
 *
 * So this surface now observes exactly one fact — is control proven for THIS
 * agent — and offers the act only while it is genuinely outstanding.
 *
 * The name is kept for now because journeySurfaceRegistry.ts and the stage
 * definition both reference it; renaming is a separate, mechanical change.
 *
 * Spine-gated route — MUST use personaFetch, never raw fetch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface ControlState {
  controlProven: boolean;
  controlProofFresh: boolean;
  provenAt: string | null;
  signerWallet: string | null;
}

interface MarketaEligibilityViewProps {
  personaId?: string;
  /*
   * WHICH AGENT CLAIM IS ABOUT (2026-08-03).
   *
   * Required, never defaulted: both requests previously omitted agentSlug, so
   * the server resolved MoneyPenny regardless of which agent Register had just
   * acted on — Aigent Nakamoto's Claim answered `no registry_assets row for
   * "aigentqube-moneypenny"`. A default here would silently restore that.
   */
  agentSlug: string;
}

export function MarketaEligibilityView({ agentSlug }: MarketaEligibilityViewProps) {
  const [loading, setLoading] = useState(true);
  const [control, setControl] = useState<ControlState | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch(
        `/api/journey/moneypenny-horizen/claim/prove-control?agentSlug=${encodeURIComponent(agentSlug)}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'claim/prove-control');
        setControl({
          controlProven: Boolean(json.controlProven),
          controlProofFresh: Boolean(json.controlProofFresh),
          provenAt: json.provenAt ?? null,
          signerWallet: json.signerWallet ?? null,
        });
      }
    } catch {
      // Soft-fail — the surface still renders with its loading state cleared.
    } finally {
      setLoading(false);
    }
  }, [agentSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const proveControl = useCallback(async () => {
    setProving(true);
    setError(null);
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/claim/prove-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
      });
      const json = await readJsonOrExplain(res, 'claim/prove-control');
      if (!res.ok || !json.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      // Re-read rather than trusting the POST's own echo: the observer is the
      // authority on whether the proof is now recorded.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete wallet control proof');
    } finally {
      setProving(false);
    }
  }, [agentSlug, refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking wallet-control state…
      </div>
    );
  }

  /*
   * A CONTROL PROOF THAT EXISTS ENDS THIS STAGE'S ACT. No button — the
   * operator has nothing left to do here, and offering it again would invite
   * a second signature for a proof already held (the five duplicate
   * `agent_control_proven` receipts this exact surface produced).
   */
  if (control?.controlProven) {
    return (
      <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Wallet control proven</p>
            <p className="mt-1 opacity-80">
              The controller wallet signed a challenge without revealing its private key. Control does not yet equal
              authority — the Passport establishes the human source from whom authority may originate.
            </p>
            {control.provenAt && (
              <p className="mt-1 opacity-60">Proven {new Date(control.provenAt).toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">
        Proving wallet control signs a fresh challenge locally — the private key never leaves the wallet custody
        boundary. This is the whole of Claim: registration is established, and the controller wallet proves it holds
        the key.
      </p>
      <button
        onClick={() => void proveControl()}
        disabled={proving}
        className="mt-3 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
      >
        {proving ? 'Proving control…' : 'Prove wallet control'}
      </button>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default MarketaEligibilityView;
