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
import { buildJourneyIntroText, focusJourneyStage } from '@/services/journey/journeyCompanionTrigger';
import { renderJourneyCopy } from '@/services/journey/journeyCopyTemplate';
import { getSelectedPilotAgentSlug } from '@/services/journey/selectedPilotAgent';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import type { JourneyRuntimeState } from '@/types/journey';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface Props {
  personaId?: string;
  codexId?: string;
  /**
   * The agent this Companion instance is admitting. Optional so existing
   * callers keep working — when absent, resolves the operator's last
   * selection on the Journey tab (services/journey/selectedPilotAgent.ts),
   * never a hardcoded MoneyPenny default (Horizen Pilot Closure item 5,
   * 2026-08-09).
   */
  agentSlug?: string;
}

function resolveAgent(agentSlug?: string): RegistrableAgentConfig {
  const slug = agentSlug ?? getSelectedPilotAgentSlug();
  return resolveRegistrableAgent(slug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;
}

export function JourneyCompanionCarousel({ personaId, codexId, agentSlug }: Props) {
  // Resolved with the literal default on first render (SSR-safe — never
  // reads localStorage during render, per CLAUDE.md's SSR/CSR rule), then
  // corrected in the effect below once the operator's real selection (or an
  // explicit prop) is known.
  const [agent, setAgent] = useState<RegistrableAgentConfig>(() => resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!);
  const [runtimeState, setRuntimeState] = useState<JourneyRuntimeState | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>(HORIZEN_MONEYPENNY_JOURNEY.stages[0].id);

  useEffect(() => {
    setAgent(resolveAgent(agentSlug));
  }, [agentSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/journey/moneypenny-horizen/state?agentSlug=${encodeURIComponent(agent.slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await readJsonOrExplain(res, 'journey/companion');
        if (!cancelled) setRuntimeState(json.state as JourneyRuntimeState);
      } catch {
        /* leave null — chips still render, just without live status */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent.slug]);

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
      <p className="whitespace-pre-line text-sm leading-relaxed">{buildJourneyIntroText(agent)}</p>
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
              title={renderJourneyCopy(stage.description, agent)}
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
