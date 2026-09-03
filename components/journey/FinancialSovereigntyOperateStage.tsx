'use client';

/**
 * FinancialSovereigntyOperateStage — the intermediary Operate workspace
 * (B1, 2026-09-02; label corrected to bare "Operate" same day after
 * live review — the qualified "Operate with MoneyPenny" breadcrumb label
 * read poorly once truncated in the stage stepper, and the distinct
 * `fs-operate` stage id already prevents any routing/receipt collision
 * with the advanced Horizen `aigentme` stage without needing a qualified
 * label).
 *
 * A DISTINCT stage identity (`fs-operate`) from the advanced Horizen
 * `aigentme` stage, which ALSO carries the visible label "Operate"
 * (horizenMoneyPennyJourney.ts:415, a 2026-08-09 verb-normalization pass).
 * Both stages share the bare label "Operate" — this is fine because
 * neither label ever serves as a routing or receipt identifier; only the
 * stage ids (`fs-operate` / `aigentme`) and their own completionEvidence
 * do that. The in-stage headline/eyebrow below still say "Operate" /
 * "Work with MoneyPenny..." so the surrounding page context always
 * disambiguates which "Operate" a reader is looking at.
 *
 * Deliberately empty `completionEvidence` on this stage (see the journey
 * definition's own comment) — this is a persistent destination, not a
 * gate to clear. The real MoneyPenny cartridge (statements, plans,
 * capabilities) mounts IN PLACE via `MoneyPennyBridgeEmbed` (MoneyPenny
 * experience-coherence correction, 2026-09-03 — a real iframe embed via
 * the same mechanism Horizen's own MoneyPenny embed already used, never
 * `window.location.assign`; see that component's own header) when
 * "Open MoneyPenny" is clicked, toggling closed again with "Continue"
 * still available throughout.
 */

import { useCallback, useState } from 'react';
import { BridgeMediaStage, type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { MoneyPennyBridgeEmbed } from '@/components/journey/MoneyPennyBridgeEmbed';

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
  const [embedOpen, setEmbedOpen] = useState(false);

  const handleOpenMoneyPenny = useCallback(() => {
    setEmbedOpen(true);
  }, []);

  const handleCloseMoneyPenny = useCallback(() => {
    setEmbedOpen(false);
  }, []);

  const handleContinue = useCallback(() => {
    selectStage(nextStageId);
  }, [nextStageId]);

  if (embedOpen) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCloseMoneyPenny}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            ← Close MoneyPenny workspace
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:opacity-80"
          >
            Continue
          </button>
        </div>
        <MoneyPennyBridgeEmbed tab="overview" personaId={personaId} className="min-h-0 w-full flex-1 rounded-md border border-slate-800 bg-slate-950" />
      </div>
    );
  }

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
        secondaryCtaLabel="Open MoneyPenny"
        onSecondaryCta={handleOpenMoneyPenny}
        accent={accent}
        layout="standard"
      />
    </div>
  );
}

export default FinancialSovereigntyOperateStage;
