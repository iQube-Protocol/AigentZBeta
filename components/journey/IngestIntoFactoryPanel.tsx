'use client';

/**
 * IngestIntoFactoryPanel — the Ingest (deploy) stage's ONE guided action
 * (Horizen Pilot Closure — Final Standing + DVN Closure, part 2, operator
 * decision A, 2026-08-09: "The recorded MoneyPenny journey needs a visible
 * consequential act, not an observer magically flipping after viewing the
 * Assets catalogue").
 *
 * Mirrors OrientationPanel's shape exactly: observe real state on mount
 * (GET), offer the act only while genuinely outstanding and eligible, POST
 * to perform it, then re-read (never trust the POST's own echo). The
 * Ingested Assets registry catalogue (ParticipationStandingTab's
 * `only:'registry'` mount) stays on this same stage, unchanged — this panel
 * is the missing act ABOVE it, not a replacement for it.
 *
 * Writes no Standing itself. The existing state-route seed-award mechanism
 * observes the resulting `capability_registered` receipt on its own next
 * read and accrues the nominal initial Standing separately — this panel
 * only reports that the act is done; it does not narrate Standing.
 *
 * Spine-gated route — MUST use personaFetch, never raw fetch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Factory, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface IngestStatus {
  eligible: boolean;
  alreadyIngested: boolean;
  existingIngestReceiptId: string | null;
  aigentQubeResolved: boolean;
  registered: boolean;
  aigentMeActive: boolean;
  focusDispositionRecorded: boolean;
}

interface IngestIntoFactoryPanelProps {
  personaId?: string;
  /** Which agent Ingest is about — required, never defaulted (same discipline as OrientationPanel's agentSlug). */
  agentSlug: string;
}

function blockingReason(status: IngestStatus): string | null {
  if (!status.aigentQubeResolved) return 'This agent has no AigentQube in the registry yet — Register must complete first.';
  if (!status.registered) return 'This agent has no confirmed Horizen registration yet — Register must complete first.';
  if (!status.aigentMeActive || !status.focusDispositionRecorded) return 'Operate (aigentMe) has not been completed yet — Ingest requires Operate first.';
  return null;
}

export function IngestIntoFactoryPanel({ agentSlug }: IngestIntoFactoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch(`/api/journey/moneypenny-horizen/ingest?agentSlug=${encodeURIComponent(agentSlug)}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'ingest');
        setStatus({
          eligible: Boolean(json.eligible),
          alreadyIngested: Boolean(json.alreadyIngested),
          existingIngestReceiptId: (json.existingIngestReceiptId as string | null) ?? null,
          aigentQubeResolved: Boolean(json.aigentQubeResolved),
          registered: Boolean(json.registered),
          aigentMeActive: Boolean(json.aigentMeActive),
          focusDispositionRecorded: Boolean(json.focusDispositionRecorded),
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

  const ingest = useCallback(async () => {
    setIngesting(true);
    setError(null);
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
      });
      const json = await readJsonOrExplain(res, 'ingest');
      if (!res.ok || !json.ok) throw new Error((json?.error as string) ?? `Request failed (${res.status})`);
      // Re-read rather than trusting the POST's own echo — the observer is
      // the authority on whether ingestion is now recorded.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record ingestion into the Factory');
    } finally {
      setIngesting(false);
    }
  }, [agentSlug, refresh]);

  if (loading || !status) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving Ingest eligibility…
      </div>
    );
  }

  if (status.alreadyIngested) {
    return (
      <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Ingested into the Factory</p>
            <p className="mt-1 opacity-80">
              This agent is a registered Factory participant, eligible to accrue Standing through validated
              work. Receipt: <span className="font-mono">{status.existingIngestReceiptId}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const blocked = blockingReason(status);

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">
        Ingest this agent into the Factory to make it eligible to accrue Standing through validated work. This
        does not itself accrue Standing.
      </p>
      <button
        onClick={() => void ingest()}
        disabled={ingesting || !!blocked}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
        {ingesting ? 'Ingesting…' : 'Ingest into Factory'}
      </button>
      {blocked && <p className="mt-2 text-xs text-slate-500">{blocked}</p>}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default IngestIntoFactoryPanel;
