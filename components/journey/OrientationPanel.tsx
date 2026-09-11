'use client';

/**
 * OrientationPanel — the Orient stage's surface (Threshold Journey — Orient
 * stage + Consequence Fork, operator spec, 2026-08-09).
 *
 * Orient's ONE guided action: read the contextually-resolved orientation
 * ritual (services/journey/orientationContext.ts, via
 * GET /api/journey/moneypenny-horizen/orient/acknowledge) and let the
 * operator perform the ONE act that completes it — an explicit
 * acknowledgment (POST to the same route), never a click-only completion.
 * Mirrors MarketaEligibilityView's shape exactly: observe real state on
 * mount, offer the act only while genuinely outstanding, re-read (never
 * trust the POST's own echo) after acting.
 *
 * Spine-gated route — MUST use personaFetch, never raw fetch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface OrientationContext {
  ritualKind: 'principal-first-constitutional-act' | 'acknowledge-existing-relationship';
  capsule: string;
  acknowledgeActionLabel: string;
}

interface OrientationPanelProps {
  personaId?: string;
  /** Which agent Orient is about — required, never defaulted (same discipline as MarketaEligibilityView's agentSlug). */
  agentSlug: string;
}

export function OrientationPanel({ agentSlug }: OrientationPanelProps) {
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [completionSource, setCompletionSource] = useState<'ritual' | 'legacy-precedent' | 'none'>('none');
  const [context, setContext] = useState<OrientationContext | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch(
        `/api/journey/moneypenny-horizen/orient/acknowledge?agentSlug=${encodeURIComponent(agentSlug)}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'orient/acknowledge');
        setComplete(Boolean(json.orientationComplete));
        setCompletionSource((json.orientationCompletionSource as typeof completionSource) ?? 'none');
        setContext((json.orientationContext as OrientationContext) ?? null);
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

  const acknowledge = useCallback(async () => {
    setAcknowledging(true);
    setError(null);
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/orient/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
      });
      const json = await readJsonOrExplain(res, 'orient/acknowledge');
      if (!res.ok || !json.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      // Re-read rather than trusting the POST's own echo — the observer is
      // the authority on whether the acknowledgment is now recorded.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the orientation acknowledgment');
    } finally {
      setAcknowledging(false);
    }
  }, [agentSlug, refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving the orientation ritual…
      </div>
    );
  }

  /*
   * COMPLETE ENDS THIS STAGE'S ACT — no button. The operator has nothing left
   * to do; re-offering acknowledgment for an already-oriented operator would
   * ask them to duplicate a completed constitutional act, exactly what Orient
   * exists to avoid (operator spec, 2026-08-09).
   */
  if (complete) {
    return (
      <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Oriented</p>
            <p className="mt-1 opacity-80">
              {completionSource === 'legacy-precedent'
                ? 'This admission already established an issued Passport, active bounded delegation and ' +
                  'activated Operate before Orient existed as a stage — that stronger downstream standing ' +
                  'satisfies Orient without repeating an acknowledgment this operator never needed to perform.'
                : context?.capsule ??
                  'The constitutional act this operator needed before Passport was identified and acknowledged.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">
        {context?.capsule ??
          'You have proved control of this agent. Control does not yet establish constitutional authority.'}
      </p>
      <button
        onClick={() => void acknowledge()}
        disabled={acknowledging}
        className="mt-3 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:opacity-50"
      >
        {acknowledging ? 'Recording…' : context?.acknowledgeActionLabel ?? 'I understand'}
      </button>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default OrientationPanel;
