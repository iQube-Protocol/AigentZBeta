'use client';

/**
 * FinancialSovereigntyIntroStage — the DISCOVER/LEARN/EXPLORE segment of the
 * KNYTS/CI → Financial Services main spine (AEE-XP-001 §4.2). Bridge-neutral
 * (KNYTS passes accent="amber", CI passes accent="indigo") — ONE
 * implementation composed by both, never forked, exactly like
 * `BridgeOrientSurface`/`BridgeMediaStage` already are for ORIENT/HOME.
 *
 * Reuses `BridgeMediaStage` directly (the same generic shell HOME/ORIENT use
 * elsewhere in both bridges) rather than a bespoke layout. EXPLORE
 * additionally projects the REAL canonical Financial Services catalogue
 * (`services/financialServices/serviceCatalog.ts`) — never a second,
 * hand-authored service list.
 *
 * Content for DISCOVER/LEARN is intentionally minimal, static copy: the
 * canonical Financial Services Learning capability taxonomy (AEE-XP-001 §9,
 * XP-4 "Progressive Sovereignty Experience Pack") is explicitly later-phase
 * work (spec §15, Phase 5) — this stage's job in Phase 1 is only to prove
 * the main-spine connection exists and hands off correctly, not to author
 * the eventual Studio-driven learning content.
 *
 * AEE-XP-001 §10/XP-6 (2026-09-01) — the first live DCIR adopter on the
 * generic experience-evidence loop. `useDcirSeam` observes the "Continue"
 * interaction (the SAME generic DCIR constructor every other adopter uses,
 * `aigentMeCapsuleEngagedEvent` — no new DCIR event kind), then
 * `promoteExperienceObservation`'s HTTP boundary
 * (`POST /api/journey/experience-observation`) writes ONE durable
 * `experience_interaction_observed` receipt, then the SAME
 * `journey:select-stage` event this file already dispatches now also
 * carries `trigger: 'stage-satisfaction-evidence-change'` — the existing,
 * previously-unfired re-evaluation trigger
 * (services/adaptive/journeyReEvaluationTrigger.ts) — so
 * JourneyRunSurface's existing listener refetches authoritative state
 * immediately. DCIR observation itself is NEVER durable constitutional
 * truth on its own; only the explicit promotion call below writes evidence.
 */

import { useCallback } from 'react';
import { BridgeMediaStage, type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { listFinancialServiceDefinitions } from '@/services/financialServices/serviceCatalog';
import { useDcirSeam } from '@/services/dcir/useDcirSeam';
import { aigentMeCapsuleEngagedEvent } from '@/services/dcir/eventStream';
import { personaFetch } from '@/utils/personaSpine';

export type FinancialSovereigntyIntroStageKey = 'discover' | 'learn' | 'explore';

function selectStage(stageId: string, trigger?: 'stage-satisfaction-evidence-change') {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId, trigger } }));
  } catch {
    /* non-fatal */
  }
}

/**
 * Fire-and-forget promotion call — never blocks navigation. A failed
 * observation write means the Journey Spine simply doesn't see this
 * evidence yet; it does not block the operator from continuing, exactly
 * like the AEE `aee` projection's own fall-open contract.
 *
 * `/api/journey/experience-observation` resolves the caller through
 * `getActivePersona` — a spine endpoint (CLAUDE.md "Client-side spine
 * fetches") — so this MUST go through `personaFetch`, never raw `fetch`.
 */
function observeExperienceInteraction(journeyId: string, stageId: string, surfaceRef: string, personaIdHint?: string) {
  try {
    void personaFetch('/api/journey/experience-observation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journeyId, stageId, surfaceRef }),
      personaIdHint,
    }).catch(() => {
      /* non-fatal — fall-open, see header comment */
    });
  } catch {
    /* non-fatal */
  }
}

const COPY: Record<FinancialSovereigntyIntroStageKey, { eyebrow: string; headline: string; paragraphs: string[] }> = {
  discover: {
    eyebrow: 'Progressive Financial Sovereignty',
    headline: 'Your agents can act with your authority — bounded, evidenced, reversible.',
    paragraphs: [
      'Financial agency in the Polity is not "connect a wallet and hope." It is a professional runtime with a registered agent, a bounded mandate, and a receipt for every consequential act.',
      'This is a short introduction, not a commitment — you can stop at any stage and nothing here changes your constitutional state.',
    ],
  },
  learn: {
    eyebrow: 'Learn',
    headline: 'What a Financial Services agent actually does — and what it never does without you.',
    paragraphs: [
      'An advisor explains. An architect proposes. Only a runtime action — one you authorize — actually changes anything, and only after a governed consequence check.',
      'Every consequential act is recorded as a receipt. Nothing is inferred from conversation alone.',
    ],
  },
  explore: {
    eyebrow: 'Explore',
    headline: 'The Financial Services you can reach once your agent is registered.',
    paragraphs: [
      'These are the real, currently offered Financial Services capabilities — not a preview or a promise.',
    ],
  },
};

export function FinancialSovereigntyIntroStage({
  stageKey,
  accent,
  nextStageId,
  journeyId,
  personaId,
}: {
  stageKey: FinancialSovereigntyIntroStageKey;
  accent: BridgeAccent;
  nextStageId: string;
  /**
   * The owning journey's id (e.g. 'knyts-bridge-crossing',
   * 'constitutional-internet-bridge') — required to build the generic
   * `${journeyId}:${stageId}` experienceRef the observation promotion
   * seam uses. Optional only so this component degrades gracefully (no
   * observation write, navigation still works) if a future caller forgets
   * to thread it, rather than throwing.
   */
  journeyId?: string;
  personaId?: string | null;
}) {
  const copy = COPY[stageKey];
  const services = stageKey === 'explore' ? listFinancialServiceDefinitions() : [];
  const serviceLine = services.length > 0 ? services.map((s) => s.displayName).join(' · ') : undefined;
  const stageId = `fs-${stageKey}`;

  // AEE-XP-001 §10/XP-6 — DCIR observation of the "Continue" interaction.
  // Local-only (session ring buffer, never persisted by DCIR itself); the
  // durable write is the separate `observeExperienceInteraction` promotion
  // call below. Reuses the SAME generic surface concept every other DCIR
  // adopter uses (services/dcir/useDcirSeam.ts).
  const { observe } = useDcirSeam({ surface: 'financial-sovereignty-intro', workflowStage: stageKey });

  const handlePrimaryCta = useCallback(() => {
    observe(aigentMeCapsuleEngagedEvent(stageId));
    if (journeyId) {
      observeExperienceInteraction(journeyId, stageId, `financial-sovereignty-intro:${stageKey}`, personaId ?? undefined);
    }
    // Only DISCOVER's Journey stage definition currently declares
    // `completionEvidence` against this promotion (AEE-XP-001 §10/XP-6
    // first live proof, scoped deliberately) — LEARN/EXPLORE already write
    // the same evidence today and need no code change when their own
    // stage definitions are extended to consume it.
    const trigger = stageKey === 'discover' ? 'stage-satisfaction-evidence-change' : undefined;
    selectStage(nextStageId, trigger);
  }, [observe, stageId, journeyId, stageKey, personaId, nextStageId]);

  return (
    <div className="flex h-full flex-col">
      <BridgeMediaStage
        eyebrow={copy.eyebrow}
        headline={copy.headline}
        paragraphs={copy.paragraphs}
        highlightLine={serviceLine}
        primaryCtaLabel="Continue"
        onPrimaryCta={handlePrimaryCta}
        accent={accent}
        layout="standard"
      />
    </div>
  );
}

export default FinancialSovereigntyIntroStage;
