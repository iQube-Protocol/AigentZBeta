'use client';

/**
 * PulseEnrollmentTracePanel — "Close Nakamoto Pulse Enrollment — Final
 * Correlated Trace" (operator directive, 2026-08-06).
 *
 * A DIAGNOSTIC surface, additive to PulseTransparencyToggle — never a
 * replacement for its Authorize/"Check status again" affordances. Drives
 * POST /api/journey/moneypenny-horizen/verify/pulse-trace, which runs ONE
 * fresh enrollment attempt (build -> sign -> submit -> reread at
 * t+0/5/15/30s) and returns the full correlation record
 * (services/horizen/pulseEnrollmentTrace.ts). Renders exactly the UI
 * requirement the directive specifies — classification, the latest
 * submission response verbatim, the latest authoritative status verbatim,
 * and the attempt id — and never collapses any of that into "not enrolled"
 * alone.
 *
 * Takes ~30s+ by design (the required sequence's own timed rereads); the
 * button disables and narrates progress rather than appearing hung.
 *
 * Spine-gated route — personaFetch only, never raw fetch.
 */

import { useCallback, useState } from 'react';
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

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRecord(null);
    setProgressNote('Running build → sign → submit → reread (t+0s)… this includes rereads at +5s/+15s/+30s, so it takes about 30-40 seconds.');
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
      setRecord(json.record as CorrelationRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correlation trace failed');
    } finally {
      setProgressNote(null);
      setRunning(false);
    }
  }, [agentSlug]);

  const latestStatusRead = record?.statusReads?.length ? record.statusReads[record.statusReads.length - 1] : null;

  return (
    <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-200">Correlated enrollment trace</p>
          <p className="mt-0.5 text-slate-500">
            Runs ONE fresh attempt end to end and rereads authoritative status at t+0/5/15/30s, so a submission Horizen
            accepted but never persisted is distinguishable from one it genuinely rejected — never collapsed into
            &quot;not enrolled&quot; alone.
          </p>
        </div>
        <button
          onClick={() => void run()}
          disabled={running}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {running ? 'Running…' : 'Run correlated trace'}
        </button>
      </div>

      {progressNote && <p className="mt-2 text-slate-500">{progressNote}</p>}
      {error && <p className="mt-2 text-rose-300">{error}</p>}

      {record && (
        <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
          {/* THE UI REQUIREMENT, VERBATIM (directive, 2026-08-06) — these four
              lines are never omitted and never merged into one summary. */}
          <div className={`rounded border px-2 py-1.5 ${CLASSIFICATION_STYLE[record.classification]}`}>
            <span className="font-medium">Pulse submission outcome:</span> {CLASSIFICATION_LABEL[record.classification]}
            <span className="ml-1 text-[10px] opacity-80">— {record.classificationReason}</span>
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
