/**
 * SimulationNotice — the shared truthfulness label for MoneyPenny surfaces
 * still backed by simulated/mock data (SPEC-MPY-002 §7, §9, §13):
 *
 *   "Any surface still backed by simulated/mock data MUST be labelled
 *   SIMULATION or remain development-only. Mock prices, random fills,
 *   random arbitrage spreads, random backtests and fabricated transaction
 *   hashes from MoneyPenny002 SHALL NOT appear as live financial truth in
 *   the canonical cartridge."
 *
 * One authoritative badge, reused everywhere a panel still generates or
 * hardcodes data rather than reading a canonical service — never a
 * per-panel hand-rolled label (CLAUDE.md "Source-of-truth parity").
 * Panels that later gain a real canonical data source should DROP this
 * import, not merely hide it.
 */

import { FlaskConical } from "lucide-react";

export function SimulationNotice({ label = "Simulated data — not live financial truth" }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-amber-800/60 bg-amber-500/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-300">
      <FlaskConical className="h-3 w-3" />
      {label}
    </div>
  );
}

export default SimulationNotice;
