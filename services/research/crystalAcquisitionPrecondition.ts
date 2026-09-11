/**
 * The bounded, authoritative precondition composition for Track 2's targeted-
 * acquisition approval (2026-08-31, "Research Copilot targeted-acquisition
 * approval timeout" repair).
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 *
 * `POST .../acquisition/approve` recomposed a FULL `CrystalReadinessReport`
 * (`runCrystalReadinessReport`) synchronously in the request path before
 * writing the approval — ten checks, including duplicate-detection's TWO
 * O(n²) pairwise passes over the domain corpus and an intra-crystal edge
 * fetch, none of which `acquisitionBriefApplies`/`buildCrystalAcquisitionBrief`
 * ever read (see crystalAcquisitionBrief.ts's own header: "every figure is
 * read, never recomputed" — those two functions consult only
 * selection-space, derivation-headroom, and boundary-coverage). Once Crystal
 * v2's corpus grew large enough (inherited predecessor + successor
 * material, now through Stage 8/9), that unnecessary recomposition alone
 * could exceed a 15s request budget with no deadline racing it at all —
 * unlike `researchProgrammeOrchestrator.ts`'s OWN state composition, which
 * has raced `STATE_COMPOSITION_DEADLINE_MS` since the "empty 504" repair.
 *
 * ── THE FIX, IN TWO PARTS ────────────────────────────────────────────────────
 *
 * 1. `runCrystalReadinessReport({ scope: 'acquisition-gate' })` — a BOUNDED
 *    projection (crystalReadiness.ts's own doc comment) that skips exactly
 *    the two expensive computations above, computing every field the brief
 *    actually reads IDENTICALLY to the full report — never a second,
 *    independently-derived readiness (inv.engineering.036/037).
 * 2. Races that (plus the artifact/admitted-invariants reads) against
 *    `STATE_COMPOSITION_DEADLINE_MS` — the SAME canonical constant the
 *    orchestrator's own hard backstop uses, reused rather than duplicated —
 *    so a still-pathologically-slow read fails CLOSED with a clean,
 *    retryable response instead of hanging or dying opaquely. Never writes
 *    on a timeout; the caller (the approve route) performs
 *    acquisitionBriefApplies/getActiveAcquisitionApproval/
 *    approveAcquisitionJob itself, only once this resolves `ok: true`.
 */

import { runCrystalReadinessReport, type CrystalReadinessReport } from '@/services/research/crystalReadiness';
import { currentCrystalArtifactId } from '@/services/research/artifacts';
import { listInvariants } from '@/services/invariants/store';
import type { InvariantRecord } from '@/types/invariants';
import { STATE_COMPOSITION_DEADLINE_MS } from '@/services/research/researchProgrammeOrchestrator';

export interface AcquisitionPreconditionInput {
  experimentId: string;
  crystalDomain: string;
  /** Clamped to STATE_COMPOSITION_DEADLINE_MS — a caller can only NARROW
   *  this, never widen it. Exists so the race is testable without a real
   *  15s wait (same discipline as `advanceResearchProgramme`'s own
   *  `stateCompositionDeadlineMs`); every production route passes nothing. */
  stateCompositionDeadlineMs?: number;
}

export type AcquisitionPreconditionResult =
  | { ok: true; report: CrystalReadinessReport; crystalGeneration: string; admitted: InvariantRecord[] }
  | { ok: false; reason: 'timeout'; deadlineMs: number };

export async function composeAcquisitionPreconditions(
  input: AcquisitionPreconditionInput,
): Promise<AcquisitionPreconditionResult> {
  const deadlineMs = Math.max(
    1,
    Math.min(input.stateCompositionDeadlineMs ?? STATE_COMPOSITION_DEADLINE_MS, STATE_COMPOSITION_DEADLINE_MS),
  );

  const compositionPromise = Promise.all([
    runCrystalReadinessReport({
      experimentId: input.experimentId,
      crystalDomain: input.crystalDomain,
      scope: 'acquisition-gate',
    }),
    currentCrystalArtifactId(input.experimentId),
    listInvariants({ domain: input.crystalDomain, status: ['validated', 'canonical'], limit: 500 }).catch(() => []),
  ]);

  const raced = await Promise.race([
    compositionPromise.then((value) => ({ raced: 'completed' as const, value })),
    new Promise<{ raced: 'timeout' }>((resolve) => setTimeout(() => resolve({ raced: 'timeout' }), deadlineMs)),
  ]);

  if (raced.raced === 'timeout') {
    // eslint-disable-next-line no-console
    console.error(
      `[crystal-acquisition-precondition] composition for experiment '${input.experimentId}' exceeded its ` +
        `${deadlineMs}ms safety budget — refusing to write; nothing was approved. Re-run once the underlying ` +
        'read completes.',
    );
    // Forensic only, never awaited — mirrors researchProgrammeOrchestrator.ts's
    // own hard-backstop discipline: the orphaned read is left to finish or be
    // recycled with the Lambda, and its eventual outcome is logged purely for
    // diagnosis of which phase was actually slow.
    compositionPromise
      .then(() =>
        // eslint-disable-next-line no-console
        console.error(`[crystal-acquisition-precondition] the timed-out read for '${input.experimentId}' later completed.`),
      )
      .catch((error) =>
        // eslint-disable-next-line no-console
        console.error(
          `[crystal-acquisition-precondition] the timed-out read for '${input.experimentId}' later failed: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    return { ok: false, reason: 'timeout', deadlineMs };
  }

  const [report, crystalGeneration, admitted] = raced.value;
  return { ok: true, report, crystalGeneration, admitted };
}

export type { CrystalReadinessReport };
