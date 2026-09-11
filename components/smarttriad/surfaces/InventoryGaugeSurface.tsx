/**
 * InventoryGaugeSurface — atomic SmartTriad surface (kind: 'market.inventory').
 *
 * Harvested from MoneyPenny002's `src/components/InventoryGauge.tsx` — same
 * harvest ruling and styling adaptation as EdgeGaugeSurface (see that file's
 * header). Preserves the band/current-position/working-marker layout.
 */

import { SmartTriadSourceBadge } from './SmartTriadSourceBadge';
import type { SmartTriadInventoryGaugePayload } from '@/types/smarttriad/richBlocks';

export function InventoryGaugeSurface({
  payload,
  compact = false,
}: {
  payload: SmartTriadInventoryGaugePayload;
  compact?: boolean;
}) {
  const { inventoryMin, inventoryMax, currentInventory, workingQc, mode, source } = payload;
  const range = inventoryMax - inventoryMin;
  const currentPercent = range > 0 ? ((currentInventory - inventoryMin) / range) * 100 : 50;
  const workingPercent = range > 0 ? ((workingQc - inventoryMin) / range) * 100 : 50;

  return (
    <div
      className={`space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-xl ${compact ? 'p-2.5' : 'p-3'}`}
      role="group"
      aria-label="Inventory gauge"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Inventory Band</span>
        <SmartTriadSourceBadge mode={mode} source={source} />
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <div className="absolute bottom-0 top-0 bg-slate-600/30 transition-all duration-300" style={{ left: '0%', width: `${currentPercent}%` }} />
        <div className="absolute bottom-0 top-0 z-10 w-1 bg-emerald-500 transition-all duration-300" style={{ left: `${currentPercent}%` }} />
        <div className="absolute bottom-0 top-0 z-10 w-1 bg-cyan-400 transition-all duration-300" style={{ left: `${workingPercent}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-mono text-slate-300">Current: {currentInventory.toFixed(0)} Q¢</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <span className="font-mono text-slate-300">Working: {workingQc.toFixed(0)} Q¢</span>
        </div>
      </div>
    </div>
  );
}
