/**
 * The canonical Companion trigger for the Guided Journey Runtime pilot
 * (PRD-GJR-001 §11.4, operator ruling 2026-07-31): a single typed word,
 * `Horizen`, recognized client-side before the message reaches
 * `/api/codex/chat` — mirroring CodexCopilotLayer's existing
 * `shouldBypassInference` convention for fixed, non-LLM actions.
 *
 * TEMPORARY INVARIANT (§11.7, pass 1-2 of 3): journey synchronization here
 * carries LOCATION and CONTEXT only, never authority. Nothing in this module
 * completes a stage, grants access, or stands in for principal/Passport/
 * persona re-resolution — that is pass 3's separate, reviewed scope.
 */

import { buildCodexUrl } from '@/utils/codex-nav';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

/** The Venture Lab codex's own id (data/codex-configs.ts VENTURE_LAB_CODEX.id). */
export const VENTURE_LAB_CODEX_ID = 'alpha-knyt-codex';
export const VENTURE_LAB_CODEX_SLUG = 'venture-lab';
export const PARTNER_JOURNEY_TAB_SLUG = 'partner-pilot-journey';

export function isHorizenTrigger(message: string): boolean {
  return message.trim().toLowerCase() === 'horizen';
}

export const JOURNEY_INTRO_TEXT = [
  `You're entering the Horizen × metaMe constitutional admission journey for MoneyPenny.`,
  // Count DERIVED, never written out: the intro said "seven stages" and went
  // stale the moment Standing became an eighth (2026-08-02). One source of
  // truth for what the journey contains — the registry itself.
  `We'll move through ${HORIZEN_MONEYPENNY_JOURNEY.stages.length} stages: ${HORIZEN_MONEYPENNY_JOURNEY.stages.map((s) => s.label).join(' · ')}.`,
  `I'll explain each stage, open the relevant application or partner surface, and keep the journey ` +
    `synchronized with the authoritative platform state. You retain all sovereign actions, including ` +
    `claiming, sponsorship, delegation and mandate approval.`,
  `We'll begin with Register.`,
].join('\n\n');

/**
 * Selects a stage across every renderer listening for it (§11.5's shared,
 * non-authoritative context) and focuses the Partner Journey surface in the
 * SAME window — never a new tab (§11.3's correction: resolveQuickLinks()'s
 * `_blank` behavior is wrong for this interaction). Same-cartridge uses the
 * existing `codex:navigate-tab` seam; cross-cartridge mirrors
 * CodexCopilotLayer's own `navigateDeepLink()` (buildCodexUrl + same-window
 * navigation, never `window.open`/`_blank`).
 */
export function focusJourneyStage(stageId: string, currentCodexId: string | undefined, personaId?: string): void {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
  try {
    if (currentCodexId === VENTURE_LAB_CODEX_ID) {
      window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: PARTNER_JOURNEY_TAB_SLUG } }));
      return;
    }
    window.location.href = buildCodexUrl(VENTURE_LAB_CODEX_SLUG, {
      tab: PARTNER_JOURNEY_TAB_SLUG,
      personaId,
    });
  } catch {
    /* non-fatal */
  }
}
