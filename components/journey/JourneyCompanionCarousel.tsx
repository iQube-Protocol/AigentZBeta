'use client';

/**
 * The Companion's journey quick-link carousel (PRD-GJR-001 §11.3-11.5,
 * operator ruling 2026-07-31). Rendered as the assistant's reply once the
 * `Horizen` trigger (services/journey/journeyCompanionTrigger.ts) is
 * recognized. Reads the SAME authoritative endpoint the Partner Journey tab
 * reads (§11.5's "one journey state, multiple authorized renderers") rather
 * than tracking journey progress independently, and stays live after being
 * rendered into chat history: it listens for `journey:select-stage` so a
 * selection made on the Journey tab highlights here too, and its own chip
 * clicks dispatch the same event.
 *
 * TEMPORARY INVARIANT (§11.7, pass 1-2 of 3): this carries location and
 * context only. It never completes a stage and never performs a sovereign
 * action — clicking a chip only selects a stage and focuses the Journey
 * surface. Principal/Passport/persona re-resolution is pass 3's separate,
 * reviewed scope; until then this must not be treated as an authority check.
 */

import React, { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { JOURNEY_INTRO_TEXT, focusJourneyStage } from '@/services/journey/journeyCompanionTrigger';
import type { JourneyRuntimeState } from '@/types/journey';

interface Props {
  personaId?: string;
  codexId?: string;
}

export function JourneyCompanionCarousel({ personaId, codexId }: Props) {
  const [runtimeState, setRuntimeState] = useState<JourneyRuntimeState | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>(HORIZEN_MONEYPENNY_JOURNEY.stages[0].id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/journey/moneypenny-horizen/state', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setRuntimeState(json.state as JourneyRuntimeState);
      } catch {
        /* leave null — chips still render, just without live status */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onSelect = (e: Event) => {
      const stageId = (e as CustomEvent<{ stageId?: string }>).detail?.stageId;
      if (typeof stageId === 'string' && HORIZEN_MONEYPENNY_JOURNEY.stages.some((s) => s.id === stageId)) {
        setSelectedStageId(stageId);
      }
    };
    window.addEventListener('journey:select-stage', onSelect);
    return () => window.removeEventListener('journey:select-stage', onSelect);
  }, []);

  const handleSelect = (stageId: string) => {
    setSelectedStageId(stageId);
    focusJourneyStage(stageId, codexId, personaId);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="whitespace-pre-line text-sm leading-relaxed">{JOURNEY_INTRO_TEXT}</p>
      <div className="flex flex-wrap gap-1.5">
        {HORIZEN_MONEYPENNY_JOURNEY.stages.map((stage, i) => {
          const stageState = runtimeState?.stages.find((s) => s.stageId === stage.id)?.state ?? 'NOT_STARTED';
          const isDone = stageState === 'COMPLETE';
          const isCurrent = stage.id === selectedStageId;
          const isBlocked = stageState === 'BLOCKED';
          return (
            <button
              key={stage.id}
              onClick={() => handleSelect(stage.id)}
              title={stage.description}
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors ${
                isCurrent
                  ? 'border-purple-400 bg-purple-500/20 text-purple-100'
                  : isDone
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {isDone ? (
                <Check className="h-3 w-3" />
              ) : isBlocked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <span className="text-[9px] opacity-70">{i + 1}</span>
              )}
              {stage.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default JourneyCompanionCarousel;
