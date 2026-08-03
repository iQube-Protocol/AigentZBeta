'use client';

/**
 * PulseTransparencyToggle — GJR-VFY-001 Phase 2, the Verify stage's real
 * surface. Confirmed genuinely absent 2026-07-31 (journeySurfaceRegistry.ts);
 * this replaces that 'component-new' placeholder.
 *
 * Shows the exact disclosure scope before the operator authorizes it (spec
 * §5 "operator reviews exact scope"), then drives
 * POST /api/journey/moneypenny-horizen/verify/authorize — which runs the
 * full prepare->sign->submit->verify pipeline
 * (services/horizen/authorizationClient.ts) server-side. Never fabricates
 * completion: if the SELECTED agent has no Horizen tokenId yet (Register stage
 * incomplete), this renders that honest blocked state instead of a toggle.
 *
 * Spine-gated route (resolves getActivePersona) — MUST use personaFetch,
 * never raw fetch, per CLAUDE.md's Identity & Access Spine rule.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

const DISCLOSURE_SCOPE = ['pulse-monitoring', 'pnl-disclosure'] as const;

interface AgentCardHorizen {
  tokenId: string | null;
  network?: string;
  pulse?: { enabled: boolean; authorizationRef: string };
  pnl?: { disclosureAuthorized: boolean; proofRefs: string[] };
}

interface PulseTransparencyToggleProps {
  personaId?: string;
  /*
   * WHICH AGENT THIS STAGE IS ABOUT (operator, 2026-08-02).
   *
   *   > "It still says awaiting agent MoneyPenny registration … it should be
   *   >  saying awaiting Nakamoto because that is the one that we actually
   *   >  just registered."
   *
   * The props interface existed and was IGNORED (`_props`), while the card
   * fetch and every sentence hardcoded MoneyPenny. So Verify narrated a
   * different agent than Register had just acted on, and read as broken when
   * it was merely talking about someone else. Required, not defaulted: a
   * default would silently restore exactly this.
   */
  agentSlug: string;
  agentDisplayName: string;
}

export function PulseTransparencyToggle({ agentSlug, agentDisplayName }: PulseTransparencyToggleProps) {
  const [loading, setLoading] = useState(true);
  const [horizen, setHorizen] = useState<AgentCardHorizen | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentSlug}/agent-card.json`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setHorizen((json?.metadata?.horizen as AgentCardHorizen) ?? null);
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

  const authorize = useCallback(async () => {
    setAuthorizing(true);
    setError(null);
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/verify/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The route already accepted an agentSlug and defaulted to MoneyPenny;
        // sending it is what makes the default stop mattering.
        body: JSON.stringify({ scope: DISCLOSURE_SCOPE, agentSlug }),
      });
      /*
       * NOT `res.json()` (operator, 2026-08-03): *"Failed to execute 'json' on
       * 'Response': Unexpected end of JSON input"* — the whole reported failure
       * of this button. The route returned an EMPTY body and the raw parser
       * reported a fact about JSON when the fact was about the request: the
       * handler wrote nothing, so it crashed or was killed mid-ceremony. This
       * route runs listTools -> build -> sign -> submit -> reread in ONE
       * request, which is exactly the shape that hits a serverless timeout.
       * The shared reader names that cause instead of hiding it.
       */
      const json = await readJsonOrExplain(res, 'verify/authorize');
      if (!res.ok || !json.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : `Authorization request failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete authorization');
    } finally {
      setAuthorizing(false);
    }
  }, [agentSlug, refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking Horizen registration state…
      </div>
    );
  }

  if (!horizen?.tokenId) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        <div>
          <p className="font-medium text-slate-300">Awaiting Horizen registration</p>
          <p className="mt-1">
            {agentDisplayName} does not have a Horizen tokenId yet. The Register stage must complete before Pulse
            monitoring and P&amp;L disclosure can be authorized.
          </p>
        </div>
      </div>
    );
  }

  if (horizen.pulse?.enabled && horizen.pnl?.disclosureAuthorized) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <p className="font-medium">Pulse monitoring and P&amp;L disclosure authorized</p>
          <p className="mt-1 text-emerald-200/80">
            Horizen has confirmed activation. This establishes Standing eligibility only — it does not
            accrue Standing and does not enlarge {agentDisplayName}&apos;s constitutional authority.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">
        Authorizing enables Horizen to monitor {agentDisplayName}&apos;s Pulse status and disclose P&amp;L
        transparency proofs. This does not create or enlarge her constitutional authority.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DISCLOSURE_SCOPE.map((s) => (
          <span key={s} className="rounded-full border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-400">
            {s}
          </span>
        ))}
      </div>
      <button
        onClick={() => void authorize()}
        disabled={authorizing}
        className="mt-3 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
      >
        {authorizing ? 'Authorizing…' : 'Authorize Pulse monitoring & P&L disclosure'}
      </button>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default PulseTransparencyToggle;
