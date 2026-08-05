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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

const DISCLOSURE_SCOPE = ['pulse-monitoring', 'pnl-disclosure'] as const;

/**
 * Mirrors verify/status/route.ts's own VerifyStatusState — a transport
 * timeout on either the Authorize call or a status check maps to 'pending'
 * here, NEVER to a denial, and never forces a second Authorize click (al's
 * brief, 2026-08-05: "A Horizen /verify/authorize timeout is a transport
 * condition, not a constitutional state").
 */
type VerifyStatusState = 'not-started' | 'pending' | 'complete' | 'denied' | 'expired';
interface VerifyStatusInfo {
  state: VerifyStatusState;
  refusalCode?: string;
  refusalDetail?: string;
  note?: string;
}

/** Same cadence as RegisterAgentPanel's own poll while a partner check is outstanding. */
const STATUS_POLL_MS = 30_000;

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
  const [status, setStatus] = useState<VerifyStatusInfo | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentSlug}/agent-card.json`, { cache: 'no-store' });
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'agent-card');
        setHorizen((json?.metadata?.horizen as AgentCardHorizen) ?? null);
      }
    } catch {
      // Soft-fail — the surface still renders with its loading state cleared.
    } finally {
      setLoading(false);
    }
  }, [agentSlug]);

  /*
   * A TRANSPORT TIMEOUT ON THIS CHECK ITSELF MUST ALSO READ AS 'pending'
   * (al, 2026-08-05) — verify/status/route.ts already answers a 504 with
   * `{ok:false, state:'pending', ...}` rather than a bare error, so reading
   * `json.state` here (when present) even on a non-ok response is what
   * carries that framing through to the UI, rather than only ever trusting
   * `json.ok`.
   */
  const checkStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const res = await personaFetch(`/api/journey/moneypenny-horizen/verify/status?agentSlug=${encodeURIComponent(agentSlug)}`, {
        cache: 'no-store',
      });
      const json = await readJsonOrExplain(res, 'verify/status').catch(() => null);
      if (json && typeof json.state === 'string') {
        setStatus({ state: json.state as VerifyStatusState, refusalCode: json.refusalCode, refusalDetail: json.refusalDetail, note: json.note });
      }
    } catch {
      // A thrown error here (readJsonOrExplain's own timeout framing, or a
      // network failure) says nothing new — the last known status stands.
    } finally {
      setCheckingStatus(false);
    }
  }, [agentSlug]);

  useEffect(() => {
    void refresh();
    void checkStatus();
  }, [refresh, checkStatus]);

  // Poll automatically while Horizen has the request but hasn't confirmed —
  // never while denied/expired/complete/not-started (al: "continue polling
  // automatically... never require the operator to press Authorize again").
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (status?.state === 'pending') {
      pollingRef.current = setInterval(() => void checkStatus(), STATUS_POLL_MS);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [status?.state, checkStatus]);

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
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete authorization');
      /*
       * A TIMEOUT DURING AUTHORIZE IS NOT NOTHING — Horizen's state-changing
       * call may already have landed (state: SUBMITTED) even though this
       * request itself never got an answer back. Immediately checking status
       * is what turns "did not answer in time, try again" into an accurate
       * "pending — Horizen has it" rather than leaving a re-clickable button
       * that would just hit AUTHORIZATION_ALREADY_IN_FLIGHT next time
       * (al, 2026-08-05: "preserve the authorization request").
       */
      await checkStatus();
    } finally {
      setAuthorizing(false);
    }
  }, [agentSlug, refresh, checkStatus]);

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

  /*
   * PENDING: Horizen has the request (or the ceremony is mid-flight); no
   * verdict exists yet. The constitutional state is UNCHANGED — this is
   * never rendered as a failure and never asks the operator to re-authorize
   * (al, 2026-08-05). Auto-polls (STATUS_POLL_MS) while in this state.
   */
  if (status?.state === 'pending') {
    return (
      <div className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Verification pending — Horizen has not yet responded</p>
            <p className="mt-1 text-amber-200/80">
              Constitutional state: unchanged. Last attempt: {error ?? status.note ?? 'the partner has not confirmed activation yet.'}{' '}
              This is a transport condition, not a denial — nothing needs repeating beyond the check.
            </p>
          </div>
        </div>
        <button
          onClick={() => void checkStatus()}
          disabled={checkingStatus}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
        >
          {checkingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          {checkingStatus ? 'Checking…' : 'Check status now'}
        </button>
        <p className="mt-2 text-amber-200/60">Checking automatically every {Math.round(STATUS_POLL_MS / 1000)}s.</p>
      </div>
    );
  }

  /*
   * DENIED / EXPIRED — a real verdict exists (Horizen explicitly rejected,
   * a local integrity check refused, or the request's own window lapsed
   * before reaching Horizen). Only NOW is "Authorize again" the honest
   * label — the store safely resets a non-SUBMITTED row on the next attempt.
   */
  if (status?.state === 'denied' || status?.state === 'expired') {
    const isExpired = status.state === 'expired';
    return (
      <div className="rounded-md border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-200">
        <div className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">{isExpired ? 'Authorization request expired' : 'Authorization was refused'}</p>
            <p className="mt-1 text-rose-200/80">
              {isExpired
                ? 'The request window lapsed before reaching Horizen — this is a local timeout, not a partner denial.'
                : status.refusalDetail ?? 'Horizen (or a local integrity check) did not confirm activation.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => void authorize()}
          disabled={authorizing}
          className="mt-3 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
        >
          {authorizing ? 'Authorizing…' : 'Authorize again'}
        </button>
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
