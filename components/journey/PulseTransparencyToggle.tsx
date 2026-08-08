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
import { PulseEnrollmentTracePanel } from './PulseEnrollmentTracePanel';

const DISCLOSURE_SCOPE = ['pulse-monitoring', 'pnl-disclosure'] as const;

/**
 * Mirrors verify/status/route.ts's own VerifyStatusState — a transport
 * timeout on either the Authorize call or a status check maps to 'pending'
 * here, NEVER to a denial, and never forces a second Authorize click (al's
 * brief, 2026-08-05: "A Horizen /verify/authorize timeout is a transport
 * condition, not a constitutional state").
 */
/**
 * `not-enrolled` (operator's follow-up, 2026-08-06) is a CONCLUSIVE, retryable
 * negative from Horizen's own authoritative reread ("Not enrolled in Pulse
 * monitoring. Next step: Enroll…") — distinct from `pending` (no conclusive
 * answer yet) and `denied` (a generic local/partner refusal). Trapping this
 * behind "Verification pending" left the operator with only a status-check
 * button that could never change the outcome, since nothing re-attempts
 * enrollment from there.
 */
/**
 * `owner-source-conflict` (Al's escalation, 2026-08-06) is NOT retryable and
 * never framed as our signature/wallet being wrong — it names a disagreement
 * between two of HORIZEN'S OWN services about who owns the token. A live
 * investigation proved this for Nakamoto's token 8798: their REST endpoint
 * and their `get_onboarding_status` tool reported different owners for the
 * same token, and the REST value was the one corroborated by the on-chain
 * mint event and a direct `ownerOf()` read. No local action — re-signing,
 * choosing a different wallet, retrying — can resolve a disagreement between
 * two of the partner's own services.
 */
type VerifyStatusState = 'not-started' | 'pending' | 'complete' | 'denied' | 'expired' | 'not-enrolled' | 'owner-source-conflict';
interface VerifyStatusInfo {
  state: VerifyStatusState;
  refusalCode?: string;
  refusalDetail?: string;
  note?: string;
  /**
   * WHICH authorization row this status describes. Al's change 4 (2026-08-06):
   * the surface must identify the attempt it is projecting, so a status read
   * for an OLDER row can never be rendered as the outcome of the attempt the
   * operator just created.
   */
  authorizationId?: string;
  /**
   * THE CONSTITUTIONAL ACT SUCCEEDING IS NOT THE SAME FACT AS ITS PROJECTION
   * LANDING (Aigent Nakamoto, 2026-08-07). `state: 'complete'` means Horizen
   * confirmed the authorization — it says nothing about whether that
   * confirmation was ever written onto the Agent Card. When these are
   * present alongside `state: 'complete'`, the projection failed and must be
   * shown as its own incomplete step, never silently folded into either
   * "authorized" (horizen.pulse?.enabled will correctly read false) or
   * "not yet authorized" (the default un-authorized card, which is a lie —
   * Horizen already confirmed this).
   */
  enrichmentRefusalCode?: string;
  enrichmentError?: string;
  /**
   * STRUCTURED, PARTNER-DECLARED FACTS — never re-derived from prose here
   * either ("Close Pulse now" directive, 2026-08-08). Populated on a reread
   * that actually reached `get_onboarding_status` (verify/status/route.ts's
   * `result.ok` branch); absent/null on paths that short-circuited before
   * reaching the partner (e.g. an already-CONFIRMED row with nothing to
   * reconcile). Rendered directly in the enrolled card below — never gated
   * behind a second interpretation of what these booleans mean.
   */
  structuredStatus?: {
    pulseEnrolled?: boolean;
    pulseCommitmentRecorded?: boolean;
    verifiablePnlRegistered?: boolean;
    endpointWarning?: string | null;
  } | null;
}

/** Same cadence as RegisterAgentPanel's own poll while a partner check is outstanding. */
const STATUS_POLL_MS = 30_000;

/**
 * Mirrors AuthorizationAttemptDiagnostics (services/horizen/authorizationClient.ts)
 * — rendered as a small header so stale replay is visible without reading
 * CloudWatch (Al's audit brief, 2026-08-06: "display a small attempt header...
 * that will make stale replay immediately visible").
 */
interface AttemptDiagnostics {
  attemptId: string;
  issuedAt: string;
  messageHash: string;
  preparedAt: string;
  rowAction: 'inserted' | 'reset' | 'unknown';
  /**
   * WHICH of build_pulse_auth_message's candidate strings this attempt signed
   * (Al's brief, 2026-08-06). `structured-message` + a ~198-byte length is
   * the canonical case; the 826-byte instructional envelope was the defect.
   * Shown so the operator can confirm the right payload was signed without
   * reading server logs.
   */
  selection?: {
    source: 'structured-message' | 'named-field' | 'sole-text-block';
    messageByteLength: number;
    outerCandidateByteLength: number | null;
  };
  /** Which row this attempt wrote — compared against the projected status to catch stale projection. */
  authorizationId?: string;
}

/**
 * `enable_pulse_monitoring`'s complete response, preserved and shown on
 * demand (Al's change 5, 2026-08-06). The operator previously saw only
 * `[0] type=text, NOT JSON (1109 chars)` — a summary that hid the one thing
 * that would have said whether the submission succeeded.
 */
interface PartnerResponseInfo {
  semanticStatus: 'confirmed' | 'pending' | 'rejected' | 'unknown';
  submissionRef?: string;
  partnerMessage?: string;
  textBlocks?: string[];
}

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
  /**
   * Shows the "Run correlated trace" diagnostic panel (PulseEnrollmentTracePanel).
   * Defaults to false (operator directive, 2026-08-08): "once constitutional
   * state is receipt-driven, [the trace] belongs under Evidence/Admin/
   * diagnostics rather than in the primary constitutional ceremony." It did
   * its job exposing the classifier defects this session fixed — the
   * ordinary Ratify/Verify surface no longer needs it to function, so it is
   * no longer shown there by default. Never removed: an admin viewer can
   * still reach it, same adminOnly-prop convention this codebase already
   * uses elsewhere (PilotJourneyTab.tsx threads its own `isAdmin` through
   * as this flag).
   */
  showDiagnostics?: boolean;
}

export function PulseTransparencyToggle({ agentSlug, agentDisplayName, showDiagnostics = false }: PulseTransparencyToggleProps) {
  const [loading, setLoading] = useState(true);
  const [horizen, setHorizen] = useState<AgentCardHorizen | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VerifyStatusInfo | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<AttemptDiagnostics | null>(null);
  const [partnerResponse, setPartnerResponse] = useState<PartnerResponseInfo | null>(null);
  const [showPartnerResponse, setShowPartnerResponse] = useState(false);
  /**
   * The authorizationId the most recent "Create fresh authorization" actually
   * wrote. Compared against whatever the status read projects (Al's change 4's
   * explicit guard) so a verdict belonging to a DIFFERENT row can never be
   * rendered as this attempt's outcome. A ref, not state: it is an identity to
   * compare against, and it must not itself trigger a re-render.
   */
  const expectedAuthorizationIdRef = useRef<string | null>(null);

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
        setStatus({
          state: json.state as VerifyStatusState,
          refusalCode: json.refusalCode,
          refusalDetail: json.refusalDetail,
          note: json.note,
          authorizationId: typeof json.authorizationId === 'string' ? json.authorizationId : undefined,
          enrichmentRefusalCode: typeof json.enrichmentRefusalCode === 'string' ? json.enrichmentRefusalCode : undefined,
          enrichmentError: typeof json.enrichmentError === 'string' ? json.enrichmentError : undefined,
          structuredStatus:
            json.structuredStatus && typeof json.structuredStatus === 'object' ? json.structuredStatus : null,
        });
        // The refresh reconciled a locally-refused row against the partner and
        // confirmed it — the Agent Card projection changed, so re-read it
        // rather than leaving the surface showing pre-confirmation state.
        if (json.state === 'complete') await refresh();
      }
    } catch {
      // A thrown error here (readJsonOrExplain's own timeout framing, or a
      // network failure) says nothing new — the last known status stands.
    } finally {
      setCheckingStatus(false);
    }
  }, [agentSlug, refresh]);

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
    /*
     * CLEAR THE PREVIOUS ATTEMPT'S PRESENTATION FIRST (Al's change 4,
     * 2026-08-06: "clear the previous rejection presentation"). The operator
     * pressed "Create fresh authorization" and then kept reading the OLD
     * rejected attempt's 826-byte transcript — so the fix was invisible and
     * the screen argued against the work. A stale verdict must never survive
     * the start of a new ceremony.
     */
    setStatus(null);
    setLastAttempt(null);
    setPartnerResponse(null);
    setShowPartnerResponse(false);
    expectedAuthorizationIdRef.current = null;
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
      // Captured REGARDLESS of ok/refusal — a refusal that reached the
      // prepare stage still carries an attemptId/issuedAt/messageHash worth
      // showing (Al's audit brief, 2026-08-06).
      const attempt = json?.diagnostics && typeof json.diagnostics.attemptId === 'string' ? (json.diagnostics as AttemptDiagnostics) : null;
      if (attempt) setLastAttempt(attempt);
      // The partner's own response, preserved whether the ceremony succeeded
      // or refused — this is the evidence the old summary threw away.
      if (json?.partnerResponse && typeof json.partnerResponse.semanticStatus === 'string') {
        setPartnerResponse(json.partnerResponse as PartnerResponseInfo);
      }
      /*
       * STALE-PROJECTION GUARD (Al's change 4). The attempt just created names
       * its authorizationId; so does every status read. Recorded here and
       * compared at render, so a card narrating a different row than the one
       * this click wrote is surfaced rather than swallowed.
       */
      expectedAuthorizationIdRef.current =
        (typeof json?.authorizationId === 'string' ? json.authorizationId : attempt?.authorizationId) ?? null;
      if (!res.ok || !json.ok) {
        /*
         * FRESH_AUTHORIZATION_NOT_CREATED is a LOCAL GUARD catching replay,
         * not a partner rejection — say so honestly rather than reusing the
         * generic "Authorization request failed" wording, which would read
         * as another Horizen denial when nothing was even sent to Horizen's
         * state-changing call this time.
         */
        if (json?.refusalCode === 'FRESH_AUTHORIZATION_NOT_CREATED') {
          throw new Error(
            'Horizen returned the same message and issuedAt as the last attempt — this click did not produce a ' +
              'genuinely fresh ceremony, so nothing was submitted. See the Attempt header below; try again shortly.',
          );
        }
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

  /*
   * ── ATTEMPT PROVENANCE + THE PARTNER'S OWN WORDS ────────────────────────
   *
   * One footer, rendered by every outcome card (Al's changes 4 and 5,
   * 2026-08-06). It answers, without a log dive: which attempt is this, which
   * bytes did it sign, which row did it write, is the card even talking about
   * that row — and what did Horizen actually say?
   */
  const projectionMismatch =
    expectedAuthorizationIdRef.current !== null &&
    status?.authorizationId !== undefined &&
    status.authorizationId !== expectedAuthorizationIdRef.current;

  const attemptFooter =
    lastAttempt || partnerResponse || projectionMismatch ? (
      <div className="mt-2 space-y-1.5 border-t border-slate-700/40 pt-2 text-[10px] text-slate-400">
        {projectionMismatch && (
          <p className="rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-amber-200">
            Projection mismatch: this card is showing authorization{' '}
            <span className="font-mono">{status?.authorizationId}</span>, but the attempt just created was{' '}
            <span className="font-mono">{expectedAuthorizationIdRef.current}</span>. Treat the verdict above as
            belonging to the older attempt, not this one.
          </p>
        )}
        {lastAttempt && (
          <p>
            Attempt: {lastAttempt.attemptId.slice(0, 8)} · Prepared: {lastAttempt.preparedAt} · Message:{' '}
            {lastAttempt.messageHash.slice(0, 12)} · Row: {lastAttempt.rowAction}
            {lastAttempt.selection && (
              <>
                {' '}
                · Signed: {lastAttempt.selection.source} ({lastAttempt.selection.messageByteLength}B
                {lastAttempt.selection.outerCandidateByteLength !== null
                  ? `, envelope ${lastAttempt.selection.outerCandidateByteLength}B not signed`
                  : ''}
                )
              </>
            )}
          </p>
        )}
        {partnerResponse && (
          <div>
            <button
              onClick={() => setShowPartnerResponse((v) => !v)}
              className="text-slate-300 underline decoration-dotted underline-offset-2 hover:text-slate-100"
            >
              {showPartnerResponse ? 'Hide' : 'Show'} partner response ({partnerResponse.semanticStatus}
              {partnerResponse.submissionRef ? `, ref ${partnerResponse.submissionRef}` : ', no reference'})
            </button>
            {showPartnerResponse && (
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-300">
                {partnerResponse.partnerMessage ?? partnerResponse.textBlocks?.join('\n') ?? '(no text returned)'}
              </pre>
            )}
          </div>
        )}
      </div>
    ) : null;

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

  /*
   * The correlated enrollment trace is a DIAGNOSTIC surface, additive below
   * every branch from here down (every branch that has a real tokenId to
   * trace against) — never a replacement for Authorize/"Check status again"
   * above it. See PulseEnrollmentTracePanel.tsx's own header. Demoted out of
   * the ordinary ceremony view (operator directive, 2026-08-08) — rendered
   * only when `showDiagnostics` is set, never by default.
   */
  const tracePanel = showDiagnostics ? <PulseEnrollmentTracePanel agentSlug={agentSlug} /> : null;

  /*
   * PULSE AND P&L ARE TWO DISTINCT EVIDENCE BLOCKS, NEVER ONE "SOLVED ITEM"
   * (operator directive, 2026-08-06: "Pulse and P&L should not be described
   * as one solved item... unless Horizen's contract genuinely activates both
   * in the same operation, one must not be inferred from the other").
   *
   * `horizen.pnl?.disclosureAuthorized` is written by
   * agentCardEnrichment.ts UNCONDITIONALLY whenever Pulse's OWN authoritative
   * reread confirms — there has never been an independent partner reread for
   * P&L specifically (no separate tool, no separate status check). Rendering
   * that as a second green checkmark beside Pulse's would assert a
   * confirmation this integration does not actually have evidence for. This
   * block still names the fact plainly rather than hiding it, and gates on
   * Pulse's OWN evidence alone — never AND'd with P&L's inferred flag, which
   * is exactly the conflation that used to collapse two questions into one.
   */
  if (horizen.pulse?.enabled) {
    const structured = status?.structuredStatus;
    const hasEndpointWarning = structured ? 'endpointWarning' in structured : false;
    return (
      <>
        <div className="flex items-start gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Pulse monitoring authorized</p>
            <p className="mt-1 text-emerald-200/80">
              Horizen has confirmed activation. This establishes Standing eligibility only — it does not
              accrue Standing and does not enlarge {agentDisplayName}&apos;s constitutional authority.
            </p>
            {/*
              THE STRUCTURED PROJECTION, VERBATIM ("Close Pulse now" directive,
              2026-08-08) — only rendered when a reread actually supplied it;
              never fabricated for a card reached via the Agent Card's own
              pulse.enabled alone.
            */}
            {structured?.pulseCommitmentRecorded !== undefined && (
              <p className="mt-2 text-emerald-200/80">
                Identity commitment: {structured.pulseCommitmentRecorded ? 'Recorded' : 'Not recorded'}
              </p>
            )}
            {hasEndpointWarning && (
              <p className="mt-1 text-emerald-200/80">
                Endpoint: {structured!.endpointWarning === null ? 'Healthy — no warning reported' : `Warning — ${structured!.endpointWarning}`}
              </p>
            )}
            {/*
              AUTHORIZED ≠ HEALTHY (operator brief, 2026-08-06, after Horizen
              confirmed enrollment succeeded but every health probe was 404ing).
              Enrollment is a one-time authorization act; health monitoring is
              an ongoing, separate signal this component has no live read on —
              so this states what enrollment does and does not establish,
              rather than implying continuous monitoring is already succeeding.
            */}
            <p className="mt-2 border-t border-emerald-900/40 pt-2 text-emerald-200/60">
              Enrollment does not by itself mean health checks are passing. SLA receipts begin only once
              Horizen's own probes reach {agentDisplayName}&apos;s registered health endpoint and receive HTTP
              2xx — check the Agent Bench / Pulse leaderboard for current uptime.
            </p>
          </div>
        </div>
        {/* P&L's OWN evidence block — never merged into Pulse's card above. */}
        <div className="mt-2 flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <div>
            <p className="font-medium text-slate-200">
              {structured?.verifiablePnlRegistered !== undefined ? (
                <>Verifiable P&amp;L — {structured.verifiablePnlRegistered ? 'registered' : 'not registered'}</>
              ) : (
                <>P&amp;L disclosure — {horizen.pnl?.disclosureAuthorized ? 'recorded, not independently confirmed' : 'not yet authorized'}</>
              )}
            </p>
            <p className="mt-1 text-slate-400">
              {structured?.verifiablePnlRegistered !== undefined
                ? `Read directly from Horizen's own authoritative onboarding status — independent of Pulse's enrollment ` +
                  `evidence, never inferred from it.`
                : horizen.pnl?.disclosureAuthorized
                  ? `Recorded as authorized via the SAME enable_pulse_monitoring call that confirmed Pulse — there is no ` +
                    `separate Horizen tool or authoritative reread for P&L disclosure specifically. Treat this as ` +
                    `provisional evidence, not an independent partner confirmation, until Horizen's contract is confirmed ` +
                    `to genuinely activate both together.`
                  : `Not authorized yet — no evidence exists for P&L disclosure independent of Pulse.`}
            </p>
            {(horizen.pnl?.proofRefs?.length ?? 0) > 0 && (
              <p className="mt-1 text-slate-500">{horizen.pnl!.proofRefs.length} proof reference(s) on file.</p>
            )}
          </div>
        </div>
        {tracePanel}
      </>
    );
  }

  /*
   * AUTHORIZATION CONFIRMED, PROJECTION INCOMPLETE — the constitutional act
   * succeeded; its Agent Card projection did not, and the two must never be
   * conflated (Aigent Nakamoto, 2026-08-07). Checked BEFORE 'pending' below:
   * `state: 'complete'` with an `enrichmentRefusalCode` present is neither a
   * transport condition nor an unauthorized state — it is Horizen's own
   * confirmed "yes", still waiting on the (retryable) local write that
   * projects it onto this agent's served Agent Card. `horizen.pulse?.enabled`
   * already correctly read false above, so falling through here would
   * otherwise land on the default "not yet authorized" card — which would
   * misrepresent an act Horizen already confirmed as never having happened.
   */
  if (status?.state === 'complete' && status.enrichmentRefusalCode) {
    return (
      <>
      <div className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Pulse enrolled · local enrichment pending</p>
            <p className="mt-1 text-amber-200/80">
              Horizen has confirmed enrollment. Only this agent&apos;s served Agent Card projection is still
              catching up.
            </p>
            <p className="mt-2 text-amber-200/60">
              Reason: <span className="font-mono">{status.enrichmentRefusalCode}</span>
              {status.enrichmentError ? ` — ${status.enrichmentError}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => void checkStatus()}
          disabled={checkingStatus}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
        >
          {checkingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          {checkingStatus ? 'Retrying enrichment…' : 'Retry enrichment'}
        </button>
        {attemptFooter}
      </div>
      {tracePanel}
      </>
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
      <>
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
        {attemptFooter}
      </div>
      {tracePanel}
      </>
    );
  }

  /*
   * NOT ENROLLED — a CONCLUSIVE, retryable negative from Horizen's own
   * authoritative reread (operator's follow-up, 2026-08-06). Distinct from
   * both `pending` (no answer yet — never rendered with this copy) and
   * `denied` (a generic refusal): Horizen said, in words, "not enrolled...
   * Next step: Enroll", and every local check (signature, ownership, message
   * selection) already passed. The retry affordance is available
   * IMMEDIATELY — there is nothing ambiguous left to wait out.
   */
  /*
   * OWNER-SOURCE CONFLICT — Horizen's OWN two services disagree about who
   * owns this token (Al's escalation, 2026-08-06). NOT retryable, and
   * deliberately offers NO "Create fresh authorization" button: a live
   * investigation proved no local action (re-signing, choosing a different
   * wallet, retrying) can resolve a disagreement between two of the
   * partner's own services. Both addresses are shown in full, since naming
   * only one would misrepresent this as resolvable from our side.
   */
  if (status?.state === 'owner-source-conflict') {
    return (
      <>
      <div className="rounded-md border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Pulse enrollment cannot proceed</p>
            <p className="mt-1 text-rose-200/80">
              Horizen&apos;s own services disagree about who owns this token — this is not a signature, wallet, or
              ownership issue on our side, and it cannot be resolved by creating another authorization. The registry
              owner and signing wallet must be reconciled by Horizen before retrying.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void checkStatus()}
            disabled={checkingStatus}
            className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
          >
            {checkingStatus ? 'Checking…' : 'Check status again'}
          </button>
        </div>
        {status.refusalDetail && (
          <div className="mt-2 border-t border-rose-900/40 pt-2">
            <button
              onClick={() => setShowPartnerResponse((v) => !v)}
              className="text-rose-200/70 underline decoration-dotted underline-offset-2 hover:text-rose-100"
            >
              {showPartnerResponse ? 'Hide' : 'Show'} the conflicting values
            </button>
            {showPartnerResponse && (
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-300">
                {status.refusalDetail}
              </pre>
            )}
          </div>
        )}
        {attemptFooter}
      </div>
      {tracePanel}
      </>
    );
  }

  if (status?.state === 'not-enrolled') {
    return (
      <>
      <div className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Pulse is not enrolled</p>
            <p className="mt-1 text-amber-200/80">
              Horizen&apos;s current authoritative state reports that this agent is not enrolled in Pulse monitoring.
              The previous submission did not establish enrollment. This is not a signature or ownership failure.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void authorize()}
            disabled={authorizing}
            className="rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
          >
            {authorizing ? 'Authorizing…' : 'Create fresh authorization'}
          </button>
          <button
            onClick={() => void checkStatus()}
            disabled={checkingStatus}
            className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
          >
            {checkingStatus ? 'Checking…' : 'Check status again'}
          </button>
        </div>
        {error && <p className="mt-2 text-rose-300">{error}</p>}
        {status.refusalDetail && (
          <div className="mt-2 border-t border-amber-900/40 pt-2">
            <button
              onClick={() => setShowPartnerResponse((v) => !v)}
              className="text-amber-200/70 underline decoration-dotted underline-offset-2 hover:text-amber-100"
            >
              {showPartnerResponse ? 'Hide' : 'Show'} partner response
            </button>
            {showPartnerResponse && (
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-300">
                {status.refusalDetail}
              </pre>
            )}
          </div>
        )}
        {attemptFooter}
      </div>
      {tracePanel}
      </>
    );
  }

  /*
   * DENIED / EXPIRED — a real verdict exists (Horizen explicitly rejected,
   * a local integrity check refused, or the request's own window lapsed
   * before reaching Horizen).
   *
   * AL'S BRIEF (2026-08-06): "Separate these operations explicitly. Refresh
   * status may reread the existing request. Retry authorization must always:
   * mark the previous attempt expired, generate a fresh nonce, call
   * build_pulse_auth_message again, sign the newly returned message, and
   * create a new authorization-attempt record." Two buttons, not one.
   */
  if (status?.state === 'denied' || status?.state === 'expired') {
    const isExpired = status.state === 'expired';
    return (
      <>
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void authorize()}
            disabled={authorizing}
            className="rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
          >
            {authorizing ? 'Authorizing…' : 'Create fresh authorization'}
          </button>
          <button
            onClick={() => void checkStatus()}
            disabled={checkingStatus}
            className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
          >
            {checkingStatus ? 'Checking…' : 'Refresh partner status'}
          </button>
        </div>
        {error && <p className="mt-2 text-rose-300">{error}</p>}
        {attemptFooter}
      </div>
      {tracePanel}
      </>
    );
  }

  return (
    <>
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
      {attemptFooter}
    </div>
    {tracePanel}
    </>
  );
}

export default PulseTransparencyToggle;
