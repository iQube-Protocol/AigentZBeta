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
 */

import { BridgeMediaStage, type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { listFinancialServiceDefinitions } from '@/services/financialServices/serviceCatalog';

export type FinancialSovereigntyIntroStageKey = 'discover' | 'learn' | 'explore';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
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
}: {
  stageKey: FinancialSovereigntyIntroStageKey;
  accent: BridgeAccent;
  nextStageId: string;
}) {
  const copy = COPY[stageKey];
  const services = stageKey === 'explore' ? listFinancialServiceDefinitions() : [];
  const serviceLine = services.length > 0 ? services.map((s) => s.displayName).join(' · ') : undefined;

  return (
    <div className="flex h-full flex-col">
      <BridgeMediaStage
        eyebrow={copy.eyebrow}
        headline={copy.headline}
        paragraphs={copy.paragraphs}
        highlightLine={serviceLine}
        primaryCtaLabel="Continue"
        onPrimaryCta={() => selectStage(nextStageId)}
        accent={accent}
        layout="standard"
      />
    </div>
  );
}

export default FinancialSovereigntyIntroStage;
