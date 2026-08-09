/**
 * Observer Round assignment — the ONE orchestration path both
 * `POST /api/research/observer-review/[experimentId]` and the EXP-P1
 * bootstrap route (`POST /api/ops/research/bootstrap-exp-p1-observer-round`)
 * call (operator instruction, 2026-08-09 EXP-P1 go-live: "Reuse the EXISTING
 * Observer Review assignment implementation... do not create another
 * mechanism"). Extracted from the route so a second caller does not have to
 * either duplicate it or make an internal HTTP call to itself.
 *
 * Deliberately NOT folded into `crystalObserverReview.ts`, which is pure —
 * no I/O, no clock read — by design (see that module's header comment).
 * This is the I/O shell around it: `getArtifact` / `buildObserverReviewPackage`
 * / `observerRoundId` / `getObserverRound` / `upsertObserverRound` /
 * `writeLifecycleReceipt`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getArtifact } from './artifacts';
import { writeLifecycleReceipt } from './lifecycle';
import { buildObserverReviewPackage, pinnedObserverRoundPolicy, type ObserverRoundPolicy } from './crystalObserverReview';
import { observerRoundId, getObserverRound, upsertObserverRound, type ObserverReviewRoundRecord } from './observerReviewStore';

export type AssignObserverRoundResult =
  | { ok: true; round: ObserverReviewRoundRecord; created: boolean }
  | { ok: false; status: number; error: string };

export interface AssignObserverRoundInput {
  experimentId: string;
  observerRefs: readonly string[];
  /** A caller-declared policy; refused (not silently honoured or
   *  overridden) if it disagrees with a PINNED policy — same rule the route
   *  already enforced, preserved here rather than re-derived. */
  requestedRoundPolicy?: ObserverRoundPolicy | string | null;
  /** Attributed to the human/admin who triggered this assignment, for the
   *  lifecycle receipt. Omit for a system/cron-triggered call — the receipt
   *  is skipped rather than attributed to a fabricated actor (no identifier
   *  is ever guessed here). */
  actorPersonaId?: string | null;
  /** Caller-supplied — this module reads no clock itself. */
  createdAt: string;
}

/**
 * Build (or idempotently return) the Observer Review round for
 * `input.experimentId`'s current frozen crystal-version artifact.
 *
 * Idempotent at the PACKAGE level, not just "upsert happens to overwrite
 * with equal values": `assignedObserverRefs` is de-duplicated and sorted
 * before hashing, so a repeated call with the same cohort in a different
 * discovery order still reproduces the SAME deterministic `packageHash`
 * (`buildObserverReviewPackage`'s `commit()` is order-sensitive). When an
 * existing round already carries that exact hash, it is returned as-is —
 * never re-upserted, and the frozen package hash is never altered.
 */
export async function assignObserverRound(
  admin: SupabaseClient,
  input: AssignObserverRoundInput,
): Promise<AssignObserverRoundResult> {
  const pinned = pinnedObserverRoundPolicy(input.experimentId);
  if (pinned && typeof input.requestedRoundPolicy === 'string' && input.requestedRoundPolicy !== pinned) {
    return {
      ok: false,
      status: 400,
      error: `${input.experimentId}'s Observer Review round policy is pinned to '${pinned}' and may not be assigned as '${input.requestedRoundPolicy}'.`,
    };
  }
  const requestedPolicy: ObserverRoundPolicy = input.requestedRoundPolicy === 'any-assigned' ? 'any-assigned' : 'all-assigned';
  const roundPolicy: ObserverRoundPolicy = pinned ?? requestedPolicy;

  const artifact = await getArtifact(input.experimentId, 'crystal-version').catch(() => null);
  if (!artifact) {
    return { ok: false, status: 409, error: `No crystal-version artifact exists yet for ${input.experimentId}` };
  }
  if (artifact.lifecycle !== 'frozen') {
    return {
      ok: false,
      status: 409,
      error: `artifact '${artifact.id}' is '${artifact.lifecycle}', not 'frozen' — assign an Observer Review round only after the crystal is frozen`,
    };
  }

  const roundId = observerRoundId(input.experimentId, artifact.id);
  const sortedRefs = [...new Set(input.observerRefs)].sort();

  let pkg;
  try {
    pkg = buildObserverReviewPackage({
      packageId: `${roundId}:package`,
      experimentId: input.experimentId,
      artifact,
      roundPolicy,
      assignedObserverRefs: sortedRefs,
      createdAt: input.createdAt,
    });
  } catch (err) {
    return { ok: false, status: 400, error: err instanceof Error ? err.message : String(err) };
  }

  const existing = await getObserverRound(admin, roundId);
  if (existing?.package?.packageHash === pkg.packageHash) {
    return { ok: true, round: existing, created: false };
  }

  await upsertObserverRound(admin, {
    roundId,
    experimentId: input.experimentId,
    artifactId: artifact.id,
    status: 'open',
    package: pkg,
    roundPolicy,
    assignedObserverRefs: sortedRefs,
    decisions: existing?.decisions ?? [],
    changeProposals: existing?.changeProposals ?? [],
    supersedes: existing?.supersedes ?? null,
    supersededBy: null,
  });

  if (input.actorPersonaId) {
    await writeLifecycleReceipt({
      personaId: input.actorPersonaId,
      summary:
        `${input.experimentId} Observer Review round assigned against '${artifact.id}' — package ${pkg.packageHash.slice(0, 16)}… ` +
        `policy ${roundPolicy}, ${sortedRefs.length} observer(s) assigned`,
      invariantSeedIds: [],
    }).catch(() => null);
  }

  const round = await getObserverRound(admin, roundId);
  if (!round) return { ok: false, status: 500, error: 'round upsert succeeded but readback returned nothing' };
  return { ok: true, round, created: !existing };
}
