'use client';

/**
 * FinancialSovereigntyTopicChips — "deeper explanations behind topic chips"
 * (CFS critical layout correction, 2026-09-03). Replaces the always-visible
 * stacked topic cards in the old `FinancialSovereigntyStageExtras` with a
 * row of chips; selecting one reveals that topic's body in a single inline
 * drawer beneath the row — never more than one topic's text open at once,
 * never a second scrolling column of cards.
 */

import { useState } from 'react';
import type { FsTopic } from '@/services/journey/financialSovereigntyContent';

export function FinancialSovereigntyTopicChips({ topics }: { topics: FsTopic[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (topics.length === 0) return null;
  const open = topics.find((t) => t.id === openId) ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {topics.map((topic) => {
          const active = topic.id === openId;
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => setOpenId(active ? null : topic.id)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
              }`}
            >
              {topic.title}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300">
          {open.body}
        </div>
      )}
    </div>
  );
}

export default FinancialSovereigntyTopicChips;
