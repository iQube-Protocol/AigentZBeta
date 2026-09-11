'use client';

/**
 * BridgeActionModeQuestion — the "What would you like to do in the Polity?"
 * signal question (Create/Build/Develop/Research/Safeguard), extracted from
 * CI's own `PolityIntentQuestion` (2026-08-12, KNYTS↔CI parity pass) so both
 * bridges' Passport-established surfaces compose the SAME questionnaire —
 * never a second copy. A preference/demand signal for aigentMe, NEVER an
 * authority grant, NEVER Standing, NEVER delegation. Persisted best-effort
 * to the caller's own campaign-scoped intent route (`postUrl`) — failure to
 * persist never blocks the visitor, and a signed-out visitor's choice is
 * simply not persisted.
 *
 * The selected-state treatment stays the fixed amber CI always used here,
 * independent of the host bridge's own accent theme — CI's visible output
 * is unchanged, and it reads consistently on KNYTS's amber theme too.
 */

import { useState } from 'react';
import { Compass, Hammer, Shield, Sparkles, Wrench } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

const ACTION_MODES = [
  { value: 'create', label: 'Create', icon: Sparkles, description: 'Make something new.' },
  { value: 'build', label: 'Build', icon: Hammer, description: 'Construct and ship.' },
  { value: 'develop', label: 'Develop', icon: Wrench, description: 'Grow and improve something existing.' },
  { value: 'research', label: 'Research', icon: Compass, description: 'Investigate and understand.' },
  { value: 'safeguard', label: 'Safeguard', icon: Shield, description: 'Protect and preserve.' },
] as const;

export interface BridgeActionModeQuestionProps {
  /** Campaign-scoped intent route this bridge persists the signal to. */
  postUrl: string;
}

export function BridgeActionModeQuestion({ postUrl }: BridgeActionModeQuestionProps) {
  const [chosen, setChosen] = useState<string | null>(null);

  const choose = (value: string) => {
    setChosen(value);
    void personaFetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionMode: value }),
    }).catch(() => {
      /* best-effort — the selection still renders regardless */
    });
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-slate-900/40 p-4">
      <p className="text-xs font-medium text-slate-200">What would you like to do in the Polity?</p>
      <p className="mt-1 text-[11px] text-slate-500">
        A signal for aigentMe, not an authority grant — this never becomes Standing or delegation.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACTION_MODES.map((mode) => {
          const Icon = mode.icon;
          const selected = chosen === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => choose(mode.value)}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                selected
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'
              }`}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${selected ? 'text-amber-300' : 'text-slate-500'}`} />
              <span>
                <span className="font-medium">{mode.label}</span>
                <span className="mt-0.5 block text-slate-500">{mode.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BridgeActionModeQuestion;
