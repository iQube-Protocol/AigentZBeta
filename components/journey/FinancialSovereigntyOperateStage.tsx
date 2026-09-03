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
 *
 * Production learning pattern completion (2026-09-03) — the pre-embed
 * INTRO view now uses the same locked-viewport BridgeMediaInteractionSection
 * shell (real O-I01 infographic + placeholder video, BridgeActivityGroupRail
 * for the "How it works" topics/checks), matching the operator's own
 * standing invariant for this stage: "Operate's primary surface is the
 * existing MoneyPenny workspace... Educational media belongs in optional
 * contextual help." The embedOpen branch below is completely untouched —
 * no media rail, no carousel — so opening/closing MoneyPenny, or scrolling/
 * navigating the intro view's media before opening it, can never remount or
 * reset the embed's own state.
 */

import { useCallback, useState } from 'react';
import { type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { BridgeMediaInteractionSection } from '@/components/journey/BridgeMediaInteractionSection';
import { BridgeActivityGroupRail } from '@/components/journey/BridgeActivityGroupRail';
import type { BridgeActivityGroup } from '@/services/journey/bridgeActivity';
import { MoneyPennyBridgeEmbed } from '@/components/journey/MoneyPennyBridgeEmbed';
import { FinancialSovereigntyCheckGroup } from '@/components/journey/FinancialSovereigntyCheckGroup';
import { FS_STAGE_CONTENT, resolveFsSectionContent, type FsBridge, type FsStructuredContent } from '@/services/journey/financialSovereigntyContent';
import { useFsBridgeSection } from '@/services/journey/useFsBridgeSection';
import { FS_PLACEHOLDER_VIDEO_LABEL } from '@/services/journey/fsPlaceholderVideo';
import { buildFsMediaItems } from '@/services/journey/fsCanonicalMedia';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

const ACCENT_BUTTON: Record<BridgeAccent, string> = {
  amber: 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
  indigo: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
};

const PLACEHOLDER_VIDEO_OVERLAY = (
  <span className="pointer-events-none absolute left-2 top-2 max-w-[85%] rounded-md border border-amber-400/40 bg-slate-950/85 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-200">
    {FS_PLACEHOLDER_VIDEO_LABEL}
  </span>
);

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

  const resolved = resolveFsSectionContent('operate', bridge, fsConfig?.structuredContent as FsStructuredContent | null | undefined);
  const items = buildFsMediaItems(fsConfig, PLACEHOLDER_VIDEO_OVERLAY, [
    { assetRef: 'O-I01', title: FS_STAGE_CONTENT.operate.asset.title },
  ]);
  const groups: BridgeActivityGroup[] = [
    {
      id: 'how-it-works',
      title: 'How it works',
      activities: resolved.topics.map((topic) => ({
        id: topic.id,
        type: 'example',
        title: topic.title,
        content: <p className="text-xs text-slate-400">{topic.body}</p>,
      })),
    },
    {
      id: 'checks',
      title: 'Check your understanding',
      activities: [
        {
          id: 'checks',
          type: 'knowledge-check',
          title: 'Quick check',
          content: <FinancialSovereigntyCheckGroup checks={resolved.checks} label="Start" />,
        },
      ],
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
      <div className="min-h-0 flex-1">
        <BridgeMediaInteractionSection
          items={items}
          emptyLabel="Infographic not yet published."
          eyebrow="Operate"
          headline="Work with MoneyPenny — for as long as you find it useful."
          lead="Understand a spending pattern, revise a goal, rehearse an exchange, or review a bounded live task once a route is verified — all in MoneyPenny's own workspace, with the same financial profile you just prepared. This is not a step to clear — come back to it any time."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleOpenMoneyPenny}
              className={`rounded-xl border px-6 py-3 text-sm font-semibold transition ${ACCENT_BUTTON[accent]}`}
            >
              Open MoneyPenny →
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="rounded-xl border border-slate-700 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:opacity-80"
            >
              Continue
            </button>
          </div>

          {resolved.contextualLine && <p className="text-xs text-slate-400">{resolved.contextualLine}</p>}
          <BridgeActivityGroupRail groups={groups} />
        </BridgeMediaInteractionSection>
      </div>
    </div>
  );
}

export default FinancialSovereigntyOperateStage;
