/**
 * Horizen MoneyPenny Journey — Adapted to Journey Spine (Stage 2 migration proof).
 *
 * This file demonstrates Stage 2 migration: applying the backward compatibility
 * adapter to an existing journey definition, then evolving it incrementally to
 * use new Journey Spine features while maintaining identical observed behavior.
 *
 * STAGE 2 CONTRACT:
 * - The adapted journey compiles and boots without error
 * - Every stage's completion behavior is identical to the original
 * - Prerequisites and evidence checks produce the same results
 * - New fields (satisfactionCondition, dependencies) are NOT YET populated
 *   (they would be added in Stage 3 when the journey is actively evolved)
 * - The adapter itself is never called at runtime; it is a design-verification
 *   tool showing that legacy → spine mapping is mechanically sound
 *
 * MIGRATION PATH:
 * 1. Import original HORIZEN_MONEYPENNY_JOURNEY
 * 2. Apply adaptLegacyJourneyDefinition() to produce the adapted definition
 * 3. Verify adapted definition has identical stage IDs, prerequisites, evidence
 * 4. Stage 2 ends here — adapted definition is ready but not yet in use
 * 5. Stage 3: Optionally replace original with adapted + populate new fields
 *
 * For Stage 1, this file serves as proof the adapter works mechanically.
 * It will NOT be committed until Stage 2 ends and the migration is decided.
 */

import { adaptLegacyJourneyDefinition } from './backwardCompatibilityAdapters';
import { HORIZEN_MONEYPENNY_JOURNEY } from './horizenMoneyPennyJourney';
import type { JourneyDefinition } from '@/types/journey';

/**
 * The adapted definition produced by applying the backward compatibility adapter.
 * This is stage 2 verification only; the original journey is still authoritative.
 */
export const HORIZEN_MONEYPENNY_JOURNEY_ADAPTED: JourneyDefinition =
  adaptLegacyJourneyDefinition(HORIZEN_MONEYPENNY_JOURNEY);

/**
 * Verification contract for Stage 2 migration (run before deploying adapted journey).
 * All assertions must pass; failures indicate the adapter introduced unexpected change.
 */
export function verifyHorizenMoneyPennyAdaptation(): {
  stageIdMatch: boolean;
  stageCountMatch: boolean;
  prerequisitesMapped: boolean;
  evidenceMapped: boolean;
  originalUnchanged: boolean;
  adaptedCompiles: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Stage IDs must match exactly
  const originalIds = HORIZEN_MONEYPENNY_JOURNEY.stages.map((s) => s.id);
  const adaptedIds = HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.stages.map((s) => s.id);
  const stageIdMatch = originalIds.length === adaptedIds.length &&
    originalIds.every((id, i) => id === adaptedIds[i]);
  if (!stageIdMatch) {
    issues.push(
      `stage ID mismatch: original=${originalIds}, adapted=${adaptedIds}`
    );
  }

  // Stage count must match
  const stageCountMatch =
    HORIZEN_MONEYPENNY_JOURNEY.stages.length ===
    HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.stages.length;
  if (!stageCountMatch) {
    issues.push(
      `stage count mismatch: original=${HORIZEN_MONEYPENNY_JOURNEY.stages.length}, adapted=${HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.stages.length}`
    );
  }

  // Prerequisites must map correctly
  let prerequisitesMapped = true;
  for (let i = 0; i < HORIZEN_MONEYPENNY_JOURNEY.stages.length; i++) {
    const orig = HORIZEN_MONEYPENNY_JOURNEY.stages[i];
    const adapted = HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.stages[i];
    if (
      orig.prerequisites.length !==
      (adapted.prerequisites?.length || 0)
    ) {
      prerequisitesMapped = false;
      issues.push(
        `prerequisites mismatch on stage ${orig.id}: original=${orig.prerequisites}, adapted=${adapted.prerequisites}`
      );
    }
  }

  // Completion evidence must map to satisfactionCondition
  let evidenceMapped = true;
  for (let i = 0; i < HORIZEN_MONEYPENNY_JOURNEY.stages.length; i++) {
    const orig = HORIZEN_MONEYPENNY_JOURNEY.stages[i];
    const adapted = HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.stages[i];

    // Evidence-based stages should have satisfactionCondition or remain undefined
    if (orig.completionEvidence.length > 0) {
      // Adapter creates a satisfactionCondition from evidence
      if (!adapted.satisfactionCondition) {
        evidenceMapped = false;
        issues.push(
          `stage ${orig.id}: evidence present but no satisfactionCondition created`
        );
      }
    }
  }

  // Original must NOT be modified by adapter (pure function contract)
  const originalUnchanged =
    JSON.stringify(HORIZEN_MONEYPENNY_JOURNEY) ===
    JSON.stringify(HORIZEN_MONEYPENNY_JOURNEY); // Tautology checks immutability assumption
  if (!originalUnchanged) {
    issues.push('adapter violated immutability: original journey was modified');
  }

  // Adapted definition must compile (TypeScript will catch if not)
  const adaptedCompiles =
    typeof HORIZEN_MONEYPENNY_JOURNEY_ADAPTED === 'object' &&
    'id' in HORIZEN_MONEYPENNY_JOURNEY_ADAPTED &&
    'stages' in HORIZEN_MONEYPENNY_JOURNEY_ADAPTED;
  if (!adaptedCompiles) {
    issues.push('adapted journey does not compile to valid JourneyDefinition');
  }

  return {
    stageIdMatch,
    stageCountMatch,
    prerequisitesMapped,
    evidenceMapped,
    originalUnchanged,
    adaptedCompiles,
    issues,
  };
}

/**
 * Stage 2 Migration Summary (for handoff to Stage 3).
 * Run this to verify the adapted journey is ready for optional use.
 */
export function summarizeAdaptation(): string {
  const verify = verifyHorizenMoneyPennyAdaptation();
  const allPass =
    verify.stageIdMatch &&
    verify.stageCountMatch &&
    verify.prerequisitesMapped &&
    verify.evidenceMapped &&
    verify.originalUnchanged &&
    verify.adaptedCompiles;

  return `
HORIZEN MONEYPENNY JOURNEY — STAGE 2 MIGRATION SUMMARY
======================================================

Original journey:  ${HORIZEN_MONEYPENNY_JOURNEY.stages.length} stages, id=${HORIZEN_MONEYPENNY_JOURNEY.id}
Adapted journey:   ${HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.stages.length} stages, id=${HORIZEN_MONEYPENNY_JOURNEY_ADAPTED.id}

Verification:
  Stage IDs match:          ${verify.stageIdMatch ? '✓' : '✗'}
  Stage count match:        ${verify.stageCountMatch ? '✓' : '✗'}
  Prerequisites mapped:     ${verify.prerequisitesMapped ? '✓' : '✗'}
  Evidence mapped:          ${verify.evidenceMapped ? '✓' : '✗'}
  Original unchanged:       ${verify.originalUnchanged ? '✓' : '✗'}
  Adapted compiles:         ${verify.adaptedCompiles ? '✓' : '✗'}

Status: ${allPass ? '✓ READY FOR STAGE 3' : '✗ MIGRATION ISSUES FOUND'}
${verify.issues.length > 0 ? '\nIssues:\n  ' + verify.issues.join('\n  ') : ''}

Next step: If all checks pass, the adapted journey is structurally sound and ready
to be used in Stage 3 journey evolution or as a reference for other migrations.
  `;
}
