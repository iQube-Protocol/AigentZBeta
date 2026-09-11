'use client';

/**
 * FinancialSovereigntyCostExample — the ONE deterministic interactive the
 * brief asks to start with (E-X01, "Does the apparent opportunity survive
 * the costs?"): synthetic arithmetic only, never a live quote. A $0.30
 * gross benefit against an editable cost slider, computing the net result
 * live. All values are labeled synthetic; adjusting the slider changes
 * nothing outside this component — no live strategy parameter, no save,
 * no submitted order.
 */

import { useState } from 'react';

const GROSS_BENEFIT = 0.3;

export function FinancialSovereigntyCostExample() {
  const [cost, setCost] = useState(0.2);
  const net = GROSS_BENEFIT - cost;
  const isLoss = net < 0;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Synthetic example — does the opportunity survive the costs?
      </p>
      <p className="mt-1 text-xs text-slate-400">
        A gross benefit of <span className="text-slate-200">${GROSS_BENEFIT.toFixed(2)}</span> against modelled
        costs you can adjust below. Illustrative only — never a real quote, a trade recommendation, or a complete
        arbitrage model.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="fs-cost-slider" className="text-xs text-slate-400">
          Total costs
        </label>
        <input
          id="fs-cost-slider"
          type="range"
          min={0}
          max={0.6}
          step={0.05}
          value={cost}
          onChange={(e) => setCost(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-14 text-right text-xs text-slate-200">${cost.toFixed(2)}</span>
      </div>
      <p className={`mt-2 text-sm font-semibold ${isLoss ? 'text-rose-300' : 'text-emerald-300'}`}>
        Net result: {isLoss ? '−' : ''}${Math.abs(net).toFixed(2)} {isLoss ? '(a loss)' : '(a gain)'}
      </p>
    </div>
  );
}

export default FinancialSovereigntyCostExample;
