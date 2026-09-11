'use client';

/**
 * VentureFunnelTab — the Venture Lab consolidation surface.
 *
 * Consolidates the two matrices the operator asked for:
 *   1. Venture progress view — the Venture Lab growth matrix (maturity ×
 *      commercialization), one dot per venture (venture_lab_scorecard).
 *   2. Customer progress view — the GENERALIZED customer matrix (Engagement ×
 *      Sovereignty Journey), from /api/venture/customer-matrix (journey_states),
 *      no longer KNYT-specific. Scope selector: Platform / a tenant.
 *
 * Together on one Venture Lab surface = the matrix-based commercial funnel
 * (venture × customer), not a one-dimensional funnel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, Users, RefreshCw, Loader2, Grid3x3 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface ScorecardVenture {
  id: string;
  venture_name: string;
  y_maturity: number;
  x_commercialization: number;
  zone: string;
}

interface CustomerMatrix {
  cells: Record<string, number>;
  total: number;
  engagementLevels: string[];
  sovereigntyStages: string[];
  scope: string;
  empty: boolean;
}

interface VentureGrowthPoint {
  ventureId: string;
  name: string;
  stage: string;
  yMaturity: number;
  xCommercialization: number;
  zone: string;
}

interface MatrixCalibration {
  source: string;
  growth: { yMaturity: number; xCommercialization: number; zone: string; label: string };
  experience: { engagement: string; sovereignty: string };
  ventures: VentureGrowthPoint[];
  reason: string;
  hasExperienceModel: boolean;
}

interface Props {
  isAdmin?: boolean;
}

const ZONE_DOT: Record<string, string> = {
  formation: 'bg-slate-400',
  validation: 'bg-blue-400',
  activation: 'bg-emerald-400',
  strategic: 'bg-amber-400',
  scale: 'bg-violet-400',
};

// Y axis (maturity) labels, 1..7, rendered top (7) → bottom (1).
const MATURITY = ['Ideation', 'Validate', 'Prototype', 'Build', 'Early Rev', 'Market Fit', 'Scale'];
const COMMERCIAL = ['Pre-Market', 'Positioning', 'Early Sales', 'Growing', 'Scaling', 'Dominant', 'Leader'];

const SCOPES: Array<{ id: string; label: string; tenantId: string | null }> = [
  { id: 'platform', label: 'Platform (metaMe funnel)', tenantId: null },
  { id: 'metame', label: 'metaMe', tenantId: 'metame' },
  { id: 'nakamoto', label: 'KNYT', tenantId: 'nakamoto' },
];

function heat(count: number, max: number): string {
  if (count <= 0) return 'bg-slate-900/40 text-slate-600';
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.66) return 'bg-emerald-600/40 text-emerald-100';
  if (ratio > 0.33) return 'bg-emerald-700/30 text-emerald-200';
  return 'bg-emerald-800/20 text-emerald-300';
}

export function VentureFunnelTab({ isAdmin }: Props) {
  const [ventures, setVentures] = useState<ScorecardVenture[]>([]);
  const [matrix, setMatrix] = useState<CustomerMatrix | null>(null);
  const [scope, setScope] = useState<string>('platform');
  const [calibration, setCalibration] = useState<MatrixCalibration | null>(null);
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);

  const loadVentures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch('/api/venture-lab/portfolio?status=active', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setVentures(json.ventures ?? []);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMatrix = useCallback(async (scopeId: string) => {
    setMatrixLoading(true);
    const tenantId = SCOPES.find((s) => s.id === scopeId)?.tenantId ?? null;
    try {
      const url = tenantId
        ? `/api/venture/customer-matrix?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/venture/customer-matrix';
      const res = await personaFetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setMatrix(json);
      else setMatrix(null);
    } catch {
      setMatrix(null);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  const loadCalibration = useCallback(async () => {
    try {
      const res = await personaFetch('/api/experience/matrix-calibration', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setCalibration(json);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => { loadVentures(); loadCalibration(); }, [loadVentures, loadCalibration]);
  useEffect(() => { loadMatrix(scope); }, [scope, loadMatrix]);

  // Index portfolio ventures by "x,y" for the growth-matrix grid.
  const ventureCell: Record<string, ScorecardVenture[]> = {};
  for (const v of ventures) {
    const key = `${v.x_commercialization},${v.y_maturity}`;
    (ventureCell[key] ??= []).push(v);
  }

  // Index the active persona's OWN ventures (derived from the experience-guide
  // SoT via /api/experience/matrix-calibration) so they plot automatically.
  const personaVentureCell: Record<string, VentureGrowthPoint[]> = {};
  for (const pv of calibration?.ventures ?? []) {
    const key = `${pv.xCommercialization},${pv.yMaturity}`;
    (personaVentureCell[key] ??= []).push(pv);
  }
  const growthHeadlineKey = calibration
    ? `${calibration.growth.xCommercialization},${calibration.growth.yMaturity}`
    : null;
  const experienceCellKey = calibration
    ? `${calibration.experience.engagement}:${calibration.experience.sovereignty}`
    : null;

  const maxCustomerCell = matrix
    ? Math.max(1, ...Object.values(matrix.cells))
    : 1;

  return (
    <div className="p-4 md:p-6 space-y-6 text-slate-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Grid3x3 className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Commercial Funnel</h2>
          <p className="text-xs text-slate-400">
            Venture progress × customer progress — the matrix-based funnel, consolidated.
          </p>
        </div>
      </div>

      {/* Calibration from the experience-guide source of truth */}
      {calibration && (
        <div className="px-3 py-2 rounded-lg bg-amber-900/15 border border-amber-500/20 text-xs text-amber-200 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5"><Grid3x3 className="w-3.5 h-3.5" /> Your position (from experience guide)</span>
          <span>growth: <span className="font-mono">{calibration.growth.label}</span> · zone {calibration.growth.zone}</span>
          <span>experience: {calibration.experience.engagement} × {calibration.experience.sovereignty}</span>
          {calibration.ventures.length > 0 && <span>{calibration.ventures.length} venture{calibration.ventures.length === 1 ? '' : 's'} plotted</span>}
          {!calibration.hasExperienceModel && <span className="text-amber-300/70">set up your experience model to calibrate</span>}
        </div>
      )}

      {/* ── Venture progress view (growth matrix) ─────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Briefcase className="w-4 h-4 text-amber-400/70" /> Venture Progress
            <span className="text-[11px] text-slate-500 font-normal">maturity × commercialization</span>
          </h3>
          <button onClick={loadVentures} className="text-slate-500 hover:text-slate-300">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading ventures…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-grid" style={{ gridTemplateColumns: `auto repeat(7, minmax(64px, 1fr))` }}>
              <div />
              {COMMERCIAL.map((c, i) => (
                <div key={c} className="text-[9px] text-slate-500 text-center px-1 pb-1">{i + 1}. {c}</div>
              ))}
              {[7, 6, 5, 4, 3, 2, 1].map((y) => (
                <React.Fragment key={y}>
                  <div className="text-[9px] text-slate-500 pr-2 flex items-center justify-end">{y}. {MATURITY[y - 1]}</div>
                  {[1, 2, 3, 4, 5, 6, 7].map((x) => {
                    const cellKey = `${x},${y}`;
                    const occ = ventureCell[cellKey] ?? [];
                    const mine = personaVentureCell[cellKey] ?? [];
                    const isHeadline = growthHeadlineKey === cellKey;
                    return (
                      <div
                        key={x}
                        title={[...occ.map((v) => v.venture_name), ...mine.map((v) => `${v.name} (yours)`)].join(', ')}
                        className={`h-9 m-0.5 rounded border bg-slate-900/40 flex items-center justify-center gap-0.5 flex-wrap ${
                          isHeadline ? 'border-amber-400/70 ring-1 ring-amber-400/40' : 'border-white/[0.05]'
                        }`}
                      >
                        {occ.slice(0, 3).map((v) => (
                          <span key={v.id} className={`w-2 h-2 rounded-full ${ZONE_DOT[v.zone] ?? 'bg-slate-500'}`} />
                        ))}
                        {mine.slice(0, 3).map((v) => (
                          <span key={v.ventureId} title={`${v.name} (yours)`} className="w-2 h-2 rounded-sm bg-amber-400 ring-1 ring-amber-200/50" />
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        {!loading && ventures.length === 0 && (
          <p className="text-xs text-slate-500">No ventures plotted yet.</p>
        )}
      </section>

      {/* ── Customer progress view (generalized matrix) ───────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Users className="w-4 h-4 text-amber-400/70" /> Customer Progress
            <span className="text-[11px] text-slate-500 font-normal">engagement × sovereignty journey</span>
          </h3>
          <div className="flex items-center gap-1">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`px-2.5 py-1 text-[11px] rounded-lg border ${
                  scope === s.id
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/40 border-white/[0.06] text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {matrixLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading customer matrix…
          </div>
        ) : !matrix || matrix.empty ? (
          <p className="text-xs text-slate-500 py-4">
            No customer journey data for this scope yet. The feed is generalized (journey_states) —
            cells populate once this venture/tenant has customers progressing.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-grid" style={{ gridTemplateColumns: `auto repeat(${matrix.sovereigntyStages.length}, minmax(56px, 1fr))` }}>
              <div className="text-[9px] text-slate-500 pr-2 flex items-end justify-end pb-1">Y \ X</div>
              {matrix.sovereigntyStages.map((x) => (
                <div key={x} className="text-[9px] text-slate-500 text-center px-1 pb-1">{x}</div>
              ))}
              {[...matrix.engagementLevels].reverse().map((yLvl) => (
                <React.Fragment key={yLvl}>
                  <div className="text-[9px] text-slate-500 pr-2 flex items-center justify-end">{yLvl}</div>
                  {matrix.sovereigntyStages.map((x) => {
                    const key = `${yLvl}:${x}`;
                    const count = matrix.cells[key] ?? 0;
                    const isMine = experienceCellKey === key;
                    return (
                      <div
                        key={x}
                        title={isMine ? 'Your derived position' : undefined}
                        className={`h-8 m-0.5 rounded border flex items-center justify-center text-[10px] font-mono ${heat(count, maxCustomerCell)} ${
                          isMine ? 'border-amber-400/70 ring-1 ring-amber-400/40' : 'border-white/[0.05]'
                        }`}
                      >
                        {count > 0 ? count : isMine ? '◆' : ''}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {matrix.total} customers · scope: {matrix.scope} · goal: top-right (Architect × Steward = founder-operators)
            </p>
          </div>
        )}
      </section>

      {!isAdmin && (
        <p className="text-[11px] text-slate-600">
          The customer matrix aggregates across personas and is admin-gated; sign in as an operator to view live cells.
        </p>
      )}
    </div>
  );
}

export default VentureFunnelTab;
