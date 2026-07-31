'use client';

/**
 * VenturePosition — the free-Citizen *glimpse* of where their venture sits
 * (derived from the experience guide), and the first upgrade CTA into
 * Venture Lab.
 *
 * Surface split (2026-06-22 fix):
 *   - `VenturePositionChip` — a horizontal badge in the aigentMe right-pane
 *     carousel. Clicking it TOGGLES the capsule below; it no longer opens an
 *     absolute popover *inside* the carousel. (The carousel has
 *     `overflow-x-auto`, which clipped the old popover and made it read as
 *     vertically-stacked buttons jammed into the carousel.)
 *   - `VenturePositionCapsule` — renders in the main viewport flow UNDERNEATH
 *     the carousel, as a capsule along the same lines as the other layout
 *     templates (Brief / Venture cockpit). This is where the venture's
 *     positioning is showcased.
 *
 * Both consume `useVenturePosition()` so the data is fetched once at the
 * WelcomeRightPane level and shared between the chip and the capsule.
 *
 * - Free Citizen (no Venture Lab access): the capsule shows the venture
 *   position glimpse and an "Upgrade to Venture Lab Lite" chip. The Venture
 *   Lab cartridge itself stays gated.
 * - Paid (Venture Lab Lite/Pro/Elite): the capsule shows the position and an
 *   "Open Venture Lab" cue.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Lock, X } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface Calibration {
  growth: { yMaturity: number; xCommercialization: number; zone: string; label: string };
  ventures: Array<{
    name: string;
    stage: string;
    derived?: boolean;
    yMaturity?: number;
    xCommercialization?: number;
    zone?: string;
  }>;
  hasExperienceModel: boolean;
}

interface Plan {
  ventureLabAccess: boolean;
  ventureTier: string;
  ventureTierLabel: string;
}

export interface VenturePositionData {
  cal: Calibration | null;
  plan: Plan | null;
}

const ZONE_COLOR: Record<string, string> = {
  formation: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
  validation: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  activation: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  strategic: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  scale: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
};

/**
 * Fetch the venture-position glimpse once. Shared by the chip and the
 * capsule so clicking the chip never triggers a second network round-trip.
 */
export function useVenturePosition(personaId?: string): VenturePositionData {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

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

  return { cal, plan };
}

function hasPosition(cal: Calibration | null): cal is Calibration {
  return !!cal && (cal.hasExperienceModel || cal.ventures.length > 0);
}

/** Sum-based growth zone (mirrors the Venture Lab matrix zone logic). */
function zoneForCell(y: number, x: number): string {
  const sum = y + x;
  if (sum <= 4) return 'formation';
  if (sum <= 7) return 'validation';
  if (sum <= 10) return 'activation';
  if (sum <= 12) return 'strategic';
  return 'scale';
}

const ZONE_CELL_FILL: Record<string, string> = {
  formation: 'bg-slate-500/15',
  validation: 'bg-blue-500/15',
  activation: 'bg-emerald-500/15',
  strategic: 'bg-amber-500/15',
  scale: 'bg-violet-500/20',
};
const ZONE_DOT: Record<string, string> = {
  formation: 'bg-slate-300',
  validation: 'bg-blue-300',
  activation: 'bg-emerald-300',
  strategic: 'bg-amber-300',
  scale: 'bg-violet-300',
};

/**
 * Compact 7×7 growth matrix (X = commercialization 1→7, Y = maturity 7→1)
 * plotting the operator's venture position(s). A visual read of where the
 * venture sits, mirroring the Venture Lab matrix tab.
 */
function MatrixMini({ cal }: { cal: Calibration }) {
  // Collect points: the headline growth position + each derived venture point.
  const points: Array<{ y: number; x: number; zone: string; label: string }> = [];
  points.push({
    y: cal.growth.yMaturity,
    x: cal.growth.xCommercialization,
    zone: cal.growth.zone,
    label: cal.growth.label,
  });
  for (const v of cal.ventures) {
    if (typeof v.yMaturity === 'number' && typeof v.xCommercialization === 'number') {
      points.push({ y: v.yMaturity, x: v.xCommercialization, zone: v.zone ?? zoneForCell(v.yMaturity, v.xCommercialization), label: v.name });
    }
  }
  const keyOf = (y: number, x: number) => `${y},${x}`;
  const pointMap = new Map<string, { zone: string; label: string }>();
  for (const p of points) pointMap.set(keyOf(p.y, p.x), { zone: p.zone, label: p.label });

  const rows = [7, 6, 5, 4, 3, 2, 1]; // top → bottom
  const cols = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="mt-1">
      <div className="flex items-stretch gap-1">
        {/* Y axis label */}
        <div className="flex items-center">
          <span className="text-[8px] text-slate-500 [writing-mode:vertical-rl] rotate-180">Maturity →</span>
        </div>
        <div className="flex-1">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {rows.map((y) =>
              cols.map((x) => {
                const cellZone = zoneForCell(y, x);
                const hit = pointMap.get(keyOf(y, x));
                return (
                  <div
                    key={`${y}-${x}`}
                    title={hit ? `${hit.label} — ${cellZone}` : `maturity ${y} · commercialization ${x} · ${cellZone}`}
                    className={`aspect-square rounded-[2px] flex items-center justify-center ${ZONE_CELL_FILL[cellZone] ?? ''}`}
                  >
                    {hit && (
                      <span className={`block h-1.5 w-1.5 rounded-full ring-1 ring-white/40 ${ZONE_DOT[hit.zone] ?? 'bg-white'}`} />
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <div className="text-[8px] text-slate-500 text-center mt-0.5">Commercialization →</div>
        </div>
      </div>
    </div>
  );
}

/**
 * The carousel chip. A normal horizontal badge — clicking it toggles the
 * capsule rendered below the carousel (no inline popover).
 */
export function VenturePositionChip({
  data,
  open,
  onToggle,
}: {
  data: VenturePositionData;
  open: boolean;
  onToggle: () => void;
}) {
  const { cal, plan } = data;
  if (!hasPosition(cal)) return null;

  const zoneClass = ZONE_COLOR[cal.growth.zone] ?? ZONE_COLOR.formation;
  const hasAccess = plan?.ventureLabAccess ?? false;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title="Your venture position (from your experience guide)"
      className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 flex items-center gap-1 transition ${zoneClass} ${
        open ? 'ring-1 ring-violet-400/60 brightness-110' : 'hover:brightness-110'
      }`}
    >
      <TrendingUp className="w-3 h-3" />
      Venture: {cal.growth.label}
      {!hasAccess && <Lock className="w-2.5 h-2.5 opacity-70" />}
    </button>
  );
}

/**
 * The capsule, rendered in the main viewport flow underneath the carousel.
 * Mirrors the visual language of the other right-pane capsule layouts
 * (rounded-xl glass card with a header + dismiss control).
 */
export function VenturePositionCapsule({
  data,
  onClose,
}: {
  data: VenturePositionData;
  onClose: () => void;
}) {
  const { cal, plan } = data;
  if (!hasPosition(cal)) return null;

  const zoneClass = ZONE_COLOR[cal.growth.zone] ?? ZONE_COLOR.formation;
  const hasAccess = plan?.ventureLabAccess ?? false;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-slate-900/60 backdrop-blur-sm p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100">
          <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
          Your venture position
        </span>
        <button
          onClick={onClose}
          aria-label="Close venture position"
          className="text-slate-500 hover:text-slate-300"
        >
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
          <div className="text-slate-400">
            Venture: {cal.ventures[0].name} ({cal.ventures[0].stage})
          </div>
        )}
      </div>

      {/* Visual matrix — where the venture sits on the growth grid. */}
      <MatrixMini cal={cal} />

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
  );
}

export default VenturePositionChip;
