'use client';

/**
 * FinancialSovereigntyOperateStage — the intermediary "Operate with
 * MoneyPenny" workspace (B1, 2026-09-02).
 *
 * A DISTINCT stage identity (`fs-operate`) from the advanced Horizen
 * `aigentme` stage, which ALSO carries the visible label "Operate"
 * (horizenMoneyPennyJourney.ts:415, a 2026-08-09 verb-normalization pass).
 * Per the operator's naming decision: retain both labels, qualify headings
 * where needed ("Operate with MoneyPenny" here vs. bare "Operate" on the
 * advanced admission spine), and never let either label serve as a
 * routing or receipt identifier — only the stage ids (`fs-operate` /
 * `aigentme`) and their own completionEvidence do that.
 *
 * Deliberately empty `completionEvidence` on this stage (see the journey
 * definition's own comment) — this is a persistent destination, not a
 * gate to clear. The real MoneyPenny cartridge (statements, plans,
 * capabilities) is reached via `buildCodexUrl`, the SAME inter-cartridge
 * navigation contract every other cross-cartridge link in this codebase
 * uses (CLAUDE.md "Inter-Cartridge Navigation") — this stage does not
 * embed a second copy of MoneyPenny's split-pane workspace; full B2/B3
 * embedding is a later, larger slice, not invented here.
 */

import { useCallback } from 'react';
import { BridgeMediaStage, type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { buildCodexUrl } from '@/utils/codex-nav';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export function FinancialSovereigntyOperateStage({
  accent,
  nextStageId,
  personaId,
}: {
  accent: BridgeAccent;
  /** The Cross stage id to advance to — 'fs-cross' in both journeys today. */
  nextStageId: string;
  personaId?: string | null;
}) {
  const handleOpenMoneyPenny = useCallback(() => {
    try {
      const url = buildCodexUrl('moneypenny', { personaId: personaId ?? undefined, tab: 'overview' });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      /* non-fatal — the primary Continue action still works */
    }
  }, [personaId]);

  const handleContinue = useCallback(() => {
    selectStage(nextStageId);
  }, [nextStageId]);

  return (
    <div className="flex h-full flex-col">
      <BridgeMediaStage
        eyebrow="Operate"
        headline="Work with MoneyPenny — for as long as you find it useful."
        paragraphs={[
          'Understand a spending pattern, revise a goal, rehearse an exchange, or review a bounded live task once a route is verified — all in MoneyPenny\'s own workspace, with the same financial profile you just prepared.',
          'This is not a step to clear. Come back to it any time — there is no trade, deposit, or count required to move on when you are ready for advanced operations.',
        ]}
        primaryCtaLabel="Continue"
        onPrimaryCta={handleContinue}
        secondaryCtaLabel="Open MoneyPenny ↗"
        onSecondaryCta={handleOpenMoneyPenny}
        accent={accent}
        layout="standard"
      />
    </div>
  );
}

export default FinancialSovereigntyOperateStage;
