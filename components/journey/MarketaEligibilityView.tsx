'use client';

/**
 * MarketaEligibilityView — GJR-MKT-001 Phase 5, the Claim stage's real
 * surface. Confirmed genuinely absent 2026-07-31 (journeySurfaceRegistry.ts);
 * replaces that 'component-new' placeholder. Wraps
 * services/passport/externalAgentAdmission.ts's real domain (never the
 * marketing-lane MarketaActivationEngineTab).
 *
 * One button, one consequence: proving wallet control and Marketa's FINAL
 * eligibility assessment happen together, server-side
 * (POST /api/journey/moneypenny-horizen/claim/prove-control) —
 * "Control Before Recommendation" is structural here, not a UI ordering
 * convention. Never renders a decision as authority: RECOMMENDED means
 * eligible to proceed toward a Polity Delegate Passport, nothing more.
 *
 * Spine-gated route — MUST use personaFetch, never raw fetch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

type Decision = 'DRAFT_ELIGIBLE' | 'DRAFT_BLOCKED' | 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'REFUSED' | 'QUARANTINED';

interface AssessmentView {
  assessmentId: string;
  decision: Decision;
  rationale: string;
  satisfiedRules: string[];
  missingRules: string[];
  failedRules: string[];
}

const DECISION_STYLE: Record<Decision, { border: string; bg: string; text: string; Icon: typeof CheckCircle2 }> = {
  RECOMMENDED: { border: 'border-emerald-900/60', bg: 'bg-emerald-950/20', text: 'text-emerald-200', Icon: CheckCircle2 },
  DRAFT_ELIGIBLE: { border: 'border-emerald-900/60', bg: 'bg-emerald-950/20', text: 'text-emerald-200', Icon: CheckCircle2 },
  NOT_RECOMMENDED: { border: 'border-amber-900/60', bg: 'bg-amber-950/20', text: 'text-amber-200', Icon: ShieldAlert },
  DRAFT_BLOCKED: { border: 'border-amber-900/60', bg: 'bg-amber-950/20', text: 'text-amber-200', Icon: ShieldAlert },
  REFUSED: { border: 'border-rose-900/60', bg: 'bg-rose-950/20', text: 'text-rose-200', Icon: XCircle },
  QUARANTINED: { border: 'border-rose-900/60', bg: 'bg-rose-950/20', text: 'text-rose-200', Icon: XCircle },
};

interface MarketaEligibilityViewProps {
  personaId?: string;
  /*
   * WHICH AGENT CLAIM IS ABOUT (2026-08-03).
   *
   * This surface previously took no agentSlug at all — its props were
   * declared and never read (`_props`), and both requests to
   * claim/prove-control omitted agentSlug, so the server defaulted to
   * MoneyPenny regardless of which agent Register/Verify had just acted on.
   * Aigent Nakamoto's live registration hit this directly: "Prove wallet
   * control" answered `no registry_assets row for "aigentqube-moneypenny"`
   * while claiming Nakamoto. Required, not defaulted, for the same reason
   * PulseTransparencyToggle's agentSlug is required: a default here would
   * silently restore exactly this.
   */
  agentSlug: string;
}

export function MarketaEligibilityView({ agentSlug }: MarketaEligibilityViewProps) {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
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
        setAssessment(json.assessment ?? null);
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
      if (json.assessment) setAssessment(json.assessment);
      else if (json.assessmentRefusalCode) setError(`Control proven, but the eligibility assessment could not run: ${json.assessmentError ?? json.assessmentRefusalCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete wallet control proof');
    } finally {
      setProving(false);
    }
  }, [agentSlug]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking Marketa admission-assessment state…
      </div>
    );
  }

  if (assessment) {
    const style = DECISION_STYLE[assessment.decision];
    const { Icon } = style;
    return (
      <div className={`rounded-md border ${style.border} ${style.bg} p-3 text-xs ${style.text}`}>
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">{assessment.decision.replace(/_/g, ' ')}</p>
            <p className="mt-1 opacity-80">{assessment.rationale}</p>
            {assessment.decision === 'RECOMMENDED' && (
              <p className="mt-1 opacity-70">
                Eligible to proceed toward a Polity Delegate Passport. This is not itself a Passport, delegation, or
                runtime authority.
              </p>
            )}
          </div>
        </div>
        {assessment.decision !== 'RECOMMENDED' && (
          <button
            onClick={() => void proveControl()}
            disabled={proving}
            className="mt-3 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800/60 disabled:opacity-50"
          >
            {proving ? 'Reassessing…' : 'Reassess'}
          </button>
        )}
        {error && <p className="mt-2 text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">
        Proving wallet control signs a fresh challenge locally — the private key never leaves the wallet custody
        boundary. Marketa then issues a FINAL eligibility recommendation from the confirmed evidence, never before.
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
