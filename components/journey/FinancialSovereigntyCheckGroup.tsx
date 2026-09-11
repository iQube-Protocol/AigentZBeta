'use client';

/**
 * FinancialSovereigntyCheckGroup — assessment as secondary and bounded (CFS
 * critical layout correction, 2026-09-03, positive invariant P6). Replaces
 * the always-visible stacked list of `FinancialSovereigntyUnderstandingCheck`
 * questions with ONE chip that opens a compact panel showing a single
 * question at a time (Prev/Next), capped at 5 questions per group (a
 * ceiling the caller is expected to respect — this component renders
 * whatever it's given but never adds pagination controls beyond a plain
 * counter). Selected answers are kept in this component's own state for as
 * long as it stays mounted, so re-opening the panel or moving between
 * questions never loses a prior selection — client-local instructional
 * feedback only, same policy as the underlying per-question component:
 * nothing is graded, stored, or reported, and this never gates navigation.
 */

import { useState } from 'react';
import type { FsUnderstandingCheck } from '@/services/journey/financialSovereigntyContent';

export function FinancialSovereigntyCheckGroup({ checks, label = 'Check your understanding' }: { checks: FsUnderstandingCheck[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (checks.length === 0) return null;

  const current = checks[Math.min(index, checks.length - 1)];
  const selected = answers[current.id] ?? null;
  const isCorrect = selected === current.correctOption;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-white/20"
      >
        {label} ({checks.length} question{checks.length > 1 ? 's' : ''})
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Question {index + 1} of {checks.length}
          </p>
          <p className="mt-1 font-medium text-slate-200">{current.prompt}</p>
          <div className="mt-2 space-y-1.5">
            {current.options.map((option) => {
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: option.id }))}
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
              {current.feedback}
            </p>
          )}

          {checks.length > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(checks.length - 1, i + 1))}
                disabled={index === checks.length - 1}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FinancialSovereigntyCheckGroup;
