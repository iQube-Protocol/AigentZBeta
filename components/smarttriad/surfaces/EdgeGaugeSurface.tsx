/**
 * EdgeGaugeSurface — atomic SmartTriad surface (kind: 'market.edge').
 *
 * Harvested from MoneyPenny002's `src/components/EdgeGauge.tsx` (2026-09-04
 * "atomic, capsule-composable surfaces" ruling: harvest the UI/interaction
 * pattern, never the donor's data generation — see
 * services/moneypenny/marketSimulation.ts for where these numbers actually
 * come from). Layout/interaction preserved (floor/min-edge markers, a
 * live-edge fill bar, a compact numeric readout); the donor's arbitrary
 * "glass-card"/"neon-text" classes are replaced with this codebase's
 * canonical translucent-slate house style (CLAUDE.md "Canonical Surface
 * Styling") since neither class exists here.
 *
 * Independently renderable inline (in a copilot message), inside a capsule,
 * or in a workspace panel — this component has no host-specific behaviour;
 * presentation depth is the caller's concern (`compact` narrows spacing).
 */

import { SmartTriadSourceBadge } from './SmartTriadSourceBadge';
import type { SmartTriadEdgeGaugePayload } from '@/types/smarttriad/richBlocks';

export function EdgeGaugeSurface({ payload, compact = false }: { payload: SmartTriadEdgeGaugePayload; compact?: boolean }) {
  const { floorBps, minEdgeBps, liveEdgeBps, mode, source } = payload;
  const maxBps = Math.max(floorBps, minEdgeBps, liveEdgeBps, 0.01) * 1.5;
  const floorPercent = (floorBps / maxBps) * 100;
  const minPercent = (minEdgeBps / maxBps) * 100;
  const livePercent = Math.max(0, Math.min(100, (liveEdgeBps / maxBps) * 100));

  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-xl ${compact ? 'p-2.5' : 'p-3'}`}
      role="group"
      aria-label="Edge gauge"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Edge Gauge</span>
        <SmartTriadSourceBadge mode={mode} source={source} />
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
          <div className="absolute bottom-0 top-0 w-0.5 bg-slate-500/60" style={{ left: `${floorPercent}%` }} />
          <div className="absolute bottom-0 top-0 w-0.5 bg-amber-400" style={{ left: `${minPercent}%` }} />
          <div
            className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-500"
            style={{ width: `${livePercent}%` }}
          />
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-xs">
          <span className="text-slate-500">{floorBps.toFixed(2)}</span>
          <span className="text-amber-400">{minEdgeBps.toFixed(2)}</span>
          <span className="font-semibold text-emerald-300">{liveEdgeBps.toFixed(2)} bps</span>
        </div>
      </div>
    </div>
  );
}
