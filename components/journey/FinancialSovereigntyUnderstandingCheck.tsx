'use client';

/**
 * FinancialSovereigntyUnderstandingCheck — one multiple-choice question from
 * CFS_Bridge_Content_Pack_v1's content/understanding-checks.json, rendered
 * generically for any CFS stage. Per the pack's own policy block
 * (`readingPreparationAndSampleModeUngated`, `quizIsNotCertification`,
 * `quizNeverGrantsAuthority`): this is client-local instructional feedback
 * ONLY — no server write, no evidence receipt, never blocks reading,
 * navigation, or any other action on this page. Selecting an option merely
 * reveals the feedback text; nothing is graded, stored, or reported.
 */

import { useState } from 'react';
import type { FsUnderstandingCheck } from '@/services/journey/financialSovereigntyContent';

export function FinancialSovereigntyUnderstandingCheck({ check }: { check: FsUnderstandingCheck }) {
  const [selected, setSelected] = useState<string | null>(null);
  const isCorrect = selected === check.correctOption;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Check your understanding</p>
      <p className="mt-1 font-medium text-slate-200">{check.prompt}</p>
      <div className="mt-2 space-y-1.5">
        {check.options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              aria-pressed={isSelected}
              className={`block w-full rounded-md border px-3 py-1.5 text-left text-xs transition ${
                isSelected
                  ? isCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 bg-transparent text-slate-300 hover:border-white/20'
              }`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="mt-2 text-xs text-slate-400">
          <span className={isCorrect ? 'text-emerald-300' : 'text-amber-300'}>{isCorrect ? 'Correct. ' : 'Not quite. '}</span>
          {check.feedback}
        </p>
      )}
    </div>
  );
}

export default FinancialSovereigntyUnderstandingCheck;
