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
 * "Open MoneyPenny" is clicked.
 *
 * `expandable` (navigation/viewport correction follow-up, 2026-09-03,
 * operator directive: "They should both have the exact same
 * expand-to-metaMe-shell affordance as Horizen bridge. They do not need
 * the continue button... as the user can use the stepper to progress.") —
 * the embed-open state no longer renders its own "← Close MoneyPenny
 * workspace" / "Continue" header; `MoneyPennyBridgeEmbed`'s own toolbar
 * (breadcrumb + Focus/Full toggle) replaces both, reusing the identical
 * `moneypenny-orchestration-focused` descriptor Horizen's Operate stage
 * uses — expanding reveals the SAME metaMe shell, never a jump to the
 * standalone cartridge. Stage-to-stage navigation (what "Continue" used
 * to do) is the stepper's job, not this panel's.
 */

import { useCallback, useState } from 'react';
import { BridgeMediaStage, type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { MoneyPennyBridgeEmbed } from '@/components/journey/MoneyPennyBridgeEmbed';
import { FS_LOGICAL_SECTION_MAP, resolveFsSectionContent, type FsBridge, type FsStructuredContent } from '@/services/journey/financialSovereigntyContent';
import { useFsBridgeSection } from '@/services/journey/useFsBridgeSection';
import { FinancialSovereigntyStageExtras } from '@/components/journey/FinancialSovereigntyStageExtras';

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
  const bridge: FsBridge = accent === 'indigo' ? 'ci' : 'knyts';
  const fsConfig = useFsBridgeSection(bridge, 'operate');
  const [embedOpen, setEmbedOpen] = useState(false);

  const handleOpenMoneyPenny = useCallback(() => {
    setEmbedOpen(true);
  }, []);

  const handleContinue = useCallback(() => {
    selectStage(nextStageId);
  }, [nextStageId]);

  if (embedOpen) {
    return (
      <div className="flex h-full flex-col p-4">
        <MoneyPennyBridgeEmbed
          tab="home"
          personaId={personaId}
          expandable
          className="min-h-0 w-full flex-1 rounded-md border border-slate-800 bg-slate-950"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
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
      >
        {(() => {
          const resolved = resolveFsSectionContent('operate', bridge, fsConfig?.structuredContent as FsStructuredContent | null | undefined);
          const [, mapHelp] = FS_LOGICAL_SECTION_MAP.operate;
          return (
            <FinancialSovereigntyStageExtras
              sectionLabel={mapHelp.label}
              topics={resolved.topics}
              checks={resolved.checks}
              exerciseSummary={resolved.exerciseSummary}
              contextualLine={resolved.contextualLine}
              assets={[{ caption: resolved.assetCaption, alt: resolved.assetAlt, infographicUrl: fsConfig?.infographicUrl }]}
            />
          );
        })()}
      </BridgeMediaStage>
    </div>
  );
}

export default FinancialSovereigntyOperateStage;
