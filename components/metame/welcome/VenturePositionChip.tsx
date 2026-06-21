'use client';

/**
 * VenturePositionChip — a carousel badge on the aigentMe right pane that gives a
 * free Citizen a *glimpse* of where their venture sits (derived from the
 * experience guide), and is the first upgrade CTA into Venture Lab.
 *
 * - Free Citizen (no Venture Lab access): the chip + inline capsule show the
 *   venture position glimpse and an "Upgrade to Venture Lab Lite" chip. The
 *   Venture Lab cartridge itself stays gated.
 * - Paid (Venture Lab Lite/Pro/Elite): the capsule shows the position and an
 *   "Open Venture Lab" cue.
 *
 * Self-contained (like PersonalGuideChip): fetches its own data via personaFetch.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Lock, X } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface Calibration {
  growth: { yMaturity: number; xCommercialization: number; zone: string; label: string };
  ventures: Array<{ name: string; stage: string; derived?: boolean }>;
  hasExperienceModel: boolean;
}

interface Plan {
  ventureLabAccess: boolean;
  ventureTier: string;
  ventureTierLabel: string;
}

const ZONE_COLOR: Record<string, string> = {
  formation: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
  validation: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  activation: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  strategic: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  scale: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
};

export function VenturePositionChip({ personaId }: { personaId?: string }) {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        personaFetch('/api/experience/matrix-calibration', { cache: 'no-store' }),
        personaFetch('/api/billing/plan', { cache: 'no-store' }),
      ]);
      const cJson = await cRes.json();
      const pJson = await pRes.json();
      if (cJson.ok) setCal(cJson);
      if (pJson.ok) setPlan(pJson);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => { load(); }, [load, personaId]);

  // Only show once we have a derived position (experience model or a venture).
  if (!cal || (!cal.hasExperienceModel && cal.ventures.length === 0)) return null;

  const zoneClass = ZONE_COLOR[cal.growth.zone] ?? ZONE_COLOR.formation;
  const hasAccess = plan?.ventureLabAccess ?? false;

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Your venture position (from your experience guide)"
        className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap flex items-center gap-1 ${zoneClass}`}
      >
        <TrendingUp className="w-3 h-3" />
        Venture: {cal.growth.label}
        {!hasAccess && <Lock className="w-2.5 h-2.5 opacity-70" />}
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 right-0 w-64 rounded-xl border border-amber-500/25 bg-slate-900/95 backdrop-blur-sm p-3 shadow-xl text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-100">Your venture position</span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div>
              Growth: <span className="font-mono text-slate-100">{cal.growth.label}</span> · zone{' '}
              <span className={`px-1 rounded ${zoneClass}`}>{cal.growth.zone}</span>
            </div>
            <div className="text-slate-400">
              maturity {cal.growth.yMaturity}/7 · commercialization {cal.growth.xCommercialization}/7
            </div>
            {cal.ventures[0] && (
              <div className="text-slate-400">Venture: {cal.ventures[0].name} ({cal.ventures[0].stage})</div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-white/[0.06]">
            {hasAccess ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                <TrendingUp className="w-3 h-3" /> Open Venture Lab → Commercial Funnel for the full matrix.
              </span>
            ) : (
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30"
                title="Upgrade to unlock the Venture Lab cartridge"
              >
                <Lock className="w-3 h-3" /> Upgrade to Venture Lab Lite to view in detail
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

export default VenturePositionChip;
