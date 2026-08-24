'use client';

/**
 * IanOrientationPanel — the Ian Boundary Research journey's Orient stage
 * surface (SPEC-JS-001 §14.4 PHASE A).
 *
 * Deliberately NOT a reuse of components/journey/OrientationPanel.tsx: that
 * panel performs its OWN GET read against the Horizen agent-orientation
 * ritual (services/journey/orientationContext.ts, a different capability
 * instance scoped to external-agent admission). Per JourneyRunSurface's own
 * three-layer rule ("projection consumes observer state only; no stepper
 * component may query lower-level evidence directly"), this panel takes its
 * completion state from the ALREADY-RESOLVED `runtimeState` the caller
 * passes in via `resolveSurfaceProps` — it never re-derives or re-fetches
 * "is Orient done" on its own. Its one guided action posts to
 * /api/journey/ian/orient/acknowledge, then asks the observer to reread via
 * `requestStateRefresh` — never trusting its own POST's echo.
 */

import React, { useCallback, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface IanOrientationPanelProps {
  complete: boolean;
  requestStateRefresh: () => void;
}

export function IanOrientationPanel({ complete, requestStateRefresh }: IanOrientationPanelProps) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acknowledge = useCallback(async () => {
    setAcknowledging(true);
    setError(null);
    try {
      const res = await personaFetch('/api/journey/ian/orient/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await readJsonOrExplain(res, 'ian/orient/acknowledge');
      if (!res.ok || !json.ok) throw new Error(typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`);
      requestStateRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your acknowledgment.');
    } finally {
      setAcknowledging(false);
    }
  }, [requestStateRefresh]);

  if (complete) {
    return (
      <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Oriented</p>
            <p className="mt-1 opacity-80">
              You understand the crossing. Identity comes next.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <p className="text-sm text-slate-200">
        Boundary Research is a persistent knowledge commons for rigorous work between
        Constitutional Computing / IRL and OCSGA. You&apos;ve been invited to a reciprocal
        architecture exchange: both sides deposit and freeze an independent artifact, then
        sign a shared exchange instrument. Only once both sides are ready does the exchange
        cross and boundary comparison begin.
      </p>
      <p className="text-sm text-slate-400">
        This guide only ever asks you for what is actually required next — nothing more.
      </p>
      <button
        onClick={() => void acknowledge()}
        disabled={acknowledging}
        className="rounded-md border border-violet-800/60 bg-violet-950/30 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-900/40 disabled:opacity-50"
      >
        {acknowledging ? 'Recording…' : 'I understand — continue'}
      </button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default IanOrientationPanel;
