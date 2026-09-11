'use client';

/**
 * PulseEnrollmentTracePanel — "Close Nakamoto Pulse Enrollment — Final
 * Correlated Trace" (operator directive, 2026-08-06; hardened against
 * serverless timeout per Al's review, same day).
 *
 * A DIAGNOSTIC surface, additive to PulseTransparencyToggle — never a
 * replacement for its Authorize/"Check status again" affordances.
 *
 * TWO CALLS, NEVER ONE LONG ONE (Al's review, verbatim: "Do not make one
 * HTTP request wait through t+0/5/15/30... Use a persisted attempt plus
 * short read-only polling calls... Do not use setTimeout/sleep inside a
 * long-running API request"):
 *   1. "Run correlated trace" → POST .../pulse-trace (start): build -> sign
 *      -> submit -> the immediate t+0 reread, in ONE fast round trip.
 *      Returns right away with the attemptId and t+0 evidence.
 *   2. THIS COMPONENT then schedules its OWN client-side timers (setTimeout
 *      in the browser — never on the server) to call
 *      POST .../pulse-trace/continue with that attemptId at +5/+15/+30s.
 *      Each call performs exactly ONE authoritative reread server-side (no
 *      re-signing, no resubmission) and returns the updated record;
 *      classification is re-rendered after every one. Polling stops once the
 *      record reports `complete`.
 *
 * Renders exactly the UI requirement — classification, the latest submission
 * response verbatim, the latest authoritative status verbatim, and the
 * attempt id — and never collapses any of that into "not enrolled" alone.
 *
 * Spine-gated route — personaFetch only, never raw fetch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, PlayCircle } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

type Classification =
  | 'ENROLLED'
  | 'PARTNER_REJECTED'
  | 'PARTNER_ACCEPTED_NOT_PERSISTED'
  | 'PARTNER_RESPONSE_UNRESOLVED'
  | 'LOCAL_CONTRACT_ERROR';

interface StatusReadRecord {
  atSeconds: 0 | 5 | 15 | 30;
  timestamp: string;
  ok: boolean;
  refusalCode: string | null;
  rawStatusResult: unknown;
  enrollmentState: 'CONFIRMED' | 'NOT_ENROLLED' | 'PENDING_CONVERGENCE' | null;
}

interface CorrelationRecord {
  attemptId: string;
  authorizationId: string | null;
  agentId: string | null;
  chain: string | null;
  classification: Classification;
  classificationReason: string;
  normalizedSubmission: { semanticStatus: string; submissionRef?: string; partnerMessage?: string; textBlocks?: string[] } | null;
  rawSubmitResponse: unknown;
  statusReads: StatusReadRecord[];
  reachedPartnerSubmission: boolean;
  localContractError: string | null;
  complete: boolean;
}

const CLASSIFICATION_STYLE: Record<Classification, string> = {
  ENROLLED: 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200',
  PARTNER_REJECTED: 'border-rose-900/60 bg-rose-950/20 text-rose-200',
  PARTNER_ACCEPTED_NOT_PERSISTED: 'border-amber-900/60 bg-amber-950/20 text-amber-200',
  PARTNER_RESPONSE_UNRESOLVED: 'border-slate-700 bg-slate-900/40 text-slate-300',
  LOCAL_CONTRACT_ERROR: 'border-rose-900/60 bg-rose-950/20 text-rose-200',
};

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  ENROLLED: 'Enrolled',
  PARTNER_REJECTED: 'Partner rejected',
  PARTNER_ACCEPTED_NOT_PERSISTED: 'Accepted, not persisted',
  PARTNER_RESPONSE_UNRESOLVED: 'Response unresolved',
  LOCAL_CONTRACT_ERROR: 'Local contract error',
};

// Relative to when the START call returns — the client owns this cadence,
// never the server (see this file's own header).
const REREAD_DELAYS_MS: Array<5 | 15 | 30> = [5, 15, 30];

function verbatim(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function PulseEnrollmentTracePanel({ agentSlug }: { agentSlug: string }) {
  const [running, setRunning] = useState(false);
  const [record, setRecord] = useState<CorrelationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  /*
   * SHOW WHAT WE ALREADY POSSESS, READ-ONLY, BEFORE ASKING FOR ANYTHING NEW
   * (operator directive, 2026-08-08: "We should get the UI to tell the truth
   * about the Pulse state we already possess"). This panel used to show
   * NOTHING until "Run correlated trace" was clicked — the ONE affordance
   * that performs a live build->sign->submit->reread ceremony. That made the
   * only way to see this agent's own trace history "run a fresh submission
   * ceremony", which is also the exact ceremony the operator has twice
   * directed this session not to repeat, and the one most exposed to the
   * platform's own gateway timeout on a slow partner round trip (the
   * reported 504 — see this file's own header on why NOT re-running it is
   * the fix, not a longer maxDuration). `getLatestPulseCorrelationTraces`
   * (GET, services/horizen/pulseEnrollmentTrace.ts) is pure read — no
   * signing, no submission, no partner call at all — so mounting this way
   * costs nothing and never re-runs anything.
   */
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    (async () => {
      try {
        const res = await personaFetch(
          `/api/journey/moneypenny-horizen/verify/pulse-trace?agentSlug=${encodeURIComponent(agentSlug)}`,
          { cache: 'no-store' },
        );
        const json = await readJsonOrExplain(res, 'verify/pulse-trace (history)').catch(() => null);
        const latest = Array.isArray(json?.records) ? (json.records[0] as CorrelationRecord | undefined) : undefined;
        if (!cancelled && latest) setRecord(latest);
        // No latest record, or the read itself failed: leave `record` null —
        // the panel then shows only the (still fully available) "Run
        // correlated trace" affordance, exactly as before this change.
      } catch {
        // A transport failure here says nothing new — the panel degrades to
        // its pre-existing "nothing shown until Run is clicked" behavior.
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentSlug]);

  const continueOnce = useCallback(async (attemptId: string, atSeconds: 5 | 15 | 30) => {
    setProgressNote(`Reading authoritative status at t+${atSeconds}s…`);
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/verify/pulse-trace/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId }),
      });
      const json = await readJsonOrExplain(res, 'verify/pulse-trace/continue');
      if (res.ok && json?.ok) {
        setRecord(json.record as CorrelationRecord);
      }
      // A failed continue call leaves the last-known record standing — the
      // t+0 (or earlier) evidence is unaffected; the operator can still see
      // it and the schedule below still runs its remaining reads.
    } catch {
      // Same reasoning — a transport failure here says nothing new.
    } finally {
      setProgressNote(null);
    }
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRecord(null);
    clearTimers();
    setProgressNote('Running build → sign → submit → the immediate status read (t+0s)…');
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/verify/pulse-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
      });
      const json = await readJsonOrExplain(res, 'verify/pulse-trace');
      if (!res.ok || !json?.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : `Correlation trace failed (${res.status})`);
      }
      const started = json.record as CorrelationRecord;
      setRecord(started);
      // Schedule the further rereads on OUR OWN client-side timers — never a
      // server-side sleep. Each one is independent; a started trace that is
      // already `complete` (e.g. a LOCAL_CONTRACT_ERROR before submission)
      // schedules nothing.
      if (!started.complete) {
        REREAD_DELAYS_MS.forEach((atSeconds) => {
          const timer = setTimeout(() => void continueOnce(started.attemptId, atSeconds), atSeconds * 1000);
          timersRef.current.push(timer);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correlation trace failed');
    } finally {
      setProgressNote(null);
      setRunning(false);
    }
  }, [agentSlug, clearTimers, continueOnce]);

  const latestStatusRead = record?.statusReads?.length ? record.statusReads[record.statusReads.length - 1] : null;
  /*
   * "More rereads scheduled" must name an ACTUAL scheduled timer, not merely
   * `!record.complete` — a record loaded from history (the mount fetch
   * above) can be incomplete simply because the browser that ran it closed
   * before its own +5/+15/+30s timers fired. Nothing is scheduled for that
   * record now, and claiming otherwise would be exactly the kind of
   * fabricated-progress this session has been correcting elsewhere.
   */
  const stillPolling = timersRef.current.length > 0 && record !== null && !record.complete;

  return (
    <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-200">Correlated enrollment trace</p>
          <p className="mt-0.5 text-slate-500">
            Runs ONE fresh attempt (build → sign → submit → t+0 read) then rereads authoritative status at
            +5s/+15s/+30s on separate calls, so a submission Horizen accepted but never persisted is distinguishable
            from one it genuinely rejected — never collapsed into &quot;not enrolled&quot; alone.
          </p>
        </div>
        <button
          onClick={() => void run()}
          disabled={running}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {running ? 'Starting…' : 'Run correlated trace'}
        </button>
      </div>

      {loadingHistory && !record && (
        <p className="mt-2 flex items-center gap-1.5 text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Reading last known trace, if any…
        </p>
      )}
      {progressNote && (
        <p className="mt-2 flex items-center gap-1.5 text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> {progressNote}
        </p>
      )}
      {error && <p className="mt-2 text-rose-300">{error}</p>}

      {record && (
        <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
          {/* THE UI REQUIREMENT, VERBATIM (directive, 2026-08-06) — these
              lines are never omitted and never merged into one summary. */}
          <div className={`rounded border px-2 py-1.5 ${CLASSIFICATION_STYLE[record.classification]}`}>
            <span className="font-medium">Pulse submission outcome:</span> {CLASSIFICATION_LABEL[record.classification]}
            {stillPolling && <span className="ml-1 text-[10px] opacity-70">(provisional — more rereads scheduled)</span>}
            <span className="ml-1 block text-[10px] opacity-80">{record.classificationReason}</span>
          </div>

          <div>
            <p className="font-medium text-slate-300">Latest partner submission response (verbatim):</p>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-300">
              {record.reachedPartnerSubmission
                ? verbatim(record.normalizedSubmission?.partnerMessage ?? record.rawSubmitResponse)
                : `(never reached enable_pulse_monitoring — ${record.localContractError ?? 'local refusal before submission'})`}
            </pre>
          </div>

          <div>
            <p className="font-medium text-slate-300">Latest authoritative status (verbatim, t+{latestStatusRead?.atSeconds ?? '?'}s):</p>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-300">
              {latestStatusRead ? verbatim(latestStatusRead.rawStatusResult) : '(no status reread ran — submission never reached the partner)'}
            </pre>
          </div>

          <p className="text-slate-500">
            Attempt ID: <span className="font-mono text-slate-400">{record.attemptId}</span>
            {record.authorizationId && (
              <>
                {' '}
                · Authorization: <span className="font-mono text-slate-400">{record.authorizationId}</span>
              </>
            )}
          </p>

          {record.statusReads.length > 1 && (
            <details className="text-slate-500">
              <summary className="cursor-pointer text-slate-400">
                All {record.statusReads.length} status reads (t+0/5/15/30s)
              </summary>
              <ul className="mt-1 space-y-1">
                {record.statusReads.map((r) => (
                  <li key={r.atSeconds} className="border-t border-slate-800 pt-1">
                    t+{r.atSeconds}s — {r.enrollmentState ?? '(no raw result)'} {r.refusalCode ? `(${r.refusalCode})` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default PulseEnrollmentTracePanel;
