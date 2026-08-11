'use client';

/**
 * ConstitutionalInternetBridgeStandPanel — the Constitutional Internet
 * Bridge's STAND stage UI.
 *
 * Deliberately does not repeat the KNYTS Bridge STAND panel's mislabeling
 * (engagement counters displayed as "Standing"). This panel shows two
 * distinct, honestly-labeled things: the real constitutional events
 * recorded so far (Passport, disposition), and the real canonical Standing
 * score from services/standing/standingScore.ts, with an explainer that it
 * tracks verified declarations and contribution over time — not this
 * journey's own navigation.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface ConstitutionalEvent {
  actionType: string;
  summary: string;
  occurredAt: string | null;
}

interface StandingScoreBreakdown {
  score: number;
  veracityScore: number;
  contributionScore: number;
  qualified: boolean;
  hasCompiledVsp: boolean;
}

interface StandResponse {
  ok: boolean;
  stand?: { events: ConstitutionalEvent[]; standing: StandingScoreBreakdown };
  error?: string;
}

interface ConstitutionalInternetBridgeStandPanelProps {
  personaId?: string;
}

export function ConstitutionalInternetBridgeStandPanel({ personaId }: ConstitutionalInternetBridgeStandPanelProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StandResponse['stand'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    personaFetch('/api/journey/constitutional-internet-bridge/stand', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: StandResponse) => {
        if (cancelled) return;
        if (json.ok && json.stand) {
          setData(json.stand);
        } else {
          setError(json.error || 'Could not load your constitutional standing.');
        }
      })
      .catch(() => { if (!cancelled) setError('Could not load your constitutional standing.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  if (!personaId) {
    return <p className="text-xs text-slate-400">Claim your Passport to see your constitutional standing.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-xs text-rose-400">{error || 'Could not load your constitutional standing.'}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Constitutional events recorded</p>
        {data.events.length === 0 ? (
          <p className="text-xs text-slate-400">No constitutional events recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.events.map((ev) => (
              <li key={ev.actionType} className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{ev.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Your Standing score</p>
        <p className="text-2xl font-bold text-white">{data.standing.score}<span className="text-sm text-slate-500">/100</span></p>
        <p className="mt-1 text-xs text-slate-400">
          Standing tracks verified declarations and contribution over time — it does not move just from
          crossing this Bridge. {!data.standing.hasCompiledVsp && 'You have not yet compiled a verified profile, so this score is a starting point, not a ceiling.'}
        </p>
      </div>
    </div>
  );
}

export default ConstitutionalInternetBridgeStandPanel;
