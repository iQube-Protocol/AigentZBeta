/**
 * Legacy Freeze Verification — a narrowly-versioned, DERIVED classification
 * for a frozen crystal whose byte-exact hash cannot be reproduced
 * (2026-08-30, EXP-P1 retrospective legacy-provenance audit).
 *
 * ── Why this exists, and what it does NOT do ─────────────────────────────
 *
 * `verifiedAgainstFreeze` (crystalFrozenManifest.ts) answers ONE strict
 * question: does the live domain corpus reproduce the exact frozen
 * `contentHash`, byte for byte? For vP1 it does not, because `status` — one
 * of the seven fields the hash covers — is KNOWN to have changed for members
 * later merged as duplicates (`mergeInvariants` flips `status` to
 * `superseded`), and no historical status snapshot was ever persisted at
 * freeze. `verifiedAgainstFreeze` is UNCHANGED by this module: it stays
 * strict, and nothing here weakens, redefines, or bypasses it.
 *
 * What this module answers is a NARROWER, still-honest question: even
 * though the byte-exact hash cannot be reproduced, is there evidence that
 * the fields the retrospective's instruments actually MEASURE have gone
 * unchanged since freeze? This is `scientific-content-verified` — a
 * strictly weaker claim than `byte-exact`, computed from EVIDENCE OF
 * MUTATION-PATH ABSENCE, never inferred from the hash mismatch itself and
 * never asserted without checking.
 *
 * ── The three-rung ladder ─────────────────────────────────────────────────
 *
 *   'byte-exact'                  — verifiedAgainstFreeze === true. The
 *                                    strongest claim; nothing below changes it.
 *   'scientific-content-verified' — verifiedAgainstFreeze === false, but every
 *                                    SCIENTIFICALLY MATERIAL hash-covered field
 *                                    (see crystalContentProjection.ts —
 *                                    everything except `status`) shows no
 *                                    evidence of a post-freeze (or, for
 *                                    fields with no in-app mutation path at
 *                                    all, any) mutation, for every recovered
 *                                    member, AND the only drifted field is
 *                                    `status` itself.
 *   'unverified'                  — the default. Any gap, any unparseable
 *                                    evidence, any member for which a check
 *                                    could not be completed, or any drift
 *                                    outside the immaterial set, fails closed
 *                                    to this rung.
 *
 * ── Identified mutation vectors this module checks (code audit, 2026-08-30) ──
 *
 *  1. `scripts/ingest-canonical-invariants.mjs` — an out-of-band script that,
 *     on re-run, BLIND-OVERWRITES `statement`/`namespace`/`semantic_type`/
 *     `provenance` for any invariant row matched by `seed_id` against
 *     `canonical-invariants.seed.json`. It unconditionally stamps
 *     `provenance.seeded_from = 'appendix-a'` and `provenance.seed_version`
 *     on every write it makes (insert or update) — so a row's OWN current
 *     provenance is dispositive: if those keys are absent, the script has
 *     NEVER touched that row, full stop. Checked via `seedId` (structural
 *     immunity when null) AND the seed file's own id list (a non-null seedId
 *     that doesn't appear in the file is equally immune) AND the
 *     `seeded_from`/`seed_version` stamps (direct, unconditional evidence).
 *  2. `applyProvenanceReclassification` (experimentalPopulations.ts), reached
 *     via `POST /api/invariants/discovery {action:'classify'}` — steward-
 *     gated, APPEND-ONLY: every event is preserved in
 *     `provenance[RECLASSIFICATION_LOG_KEY]` with its own `at` timestamp,
 *     never overwritten. Checked by comparing every event's `at` against
 *     `frozenAt`.
 *  3. Every OTHER `updateInvariant()` call site (services/invariants/
 *     lifecycle.ts: validateInvariant, canonizeInvariant, transitionInvariant,
 *     recomputeStanding, recordConsequence, recordUsage, addEdge's conflict
 *     quarantine, mergeInvariants) touches only `status`, `standing`, `reach`,
 *     `times_*`, `dvn_receipt_id`, or `reasoning_provenance` — NONE of which
 *     is in `SCIENTIFICALLY_MATERIAL_FIELD_NAMES` (`reasoning_provenance` is a
 *     SEPARATE column from the hash-covered `provenance`). Nothing further to
 *     check for these paths; named here so the scope of "identified vectors"
 *     is auditable from this file alone.
 *
 * This module cannot, and does not claim to, rule out a mutation path this
 * audit failed to find, or a manual/administrative database write outside
 * every served code path — see `unresolvedRisk` on the returned evidence.
 *
 * Server-safe, pure, read-only. Takes already-fetched data; performs no I/O
 * itself except importing the static canonical-invariants seed file (a
 * build-time asset, not a live query).
 */

import canonicalInvariantsSeed from '@/codexes/packs/irl/foundation/canonical-invariants.seed.json';
import { SCIENTIFICALLY_MATERIAL_FIELD_NAMES } from '@/services/research/crystalContentProjection';
import { RECLASSIFICATION_LOG_KEY, type ProvenanceReclassification } from '@/services/research/experimentalPopulations';
import type { InvariantRecord } from '@/types/invariants';

export type LegacyFreezeVerificationState = 'unverified' | 'scientific-content-verified' | 'byte-exact';

export interface LegacyFreezeVerificationEvidence {
  state: LegacyFreezeVerificationState;
  /** Mirrors `verifiedAgainstFreeze` for a caller reading this object alone —
   *  never an independent computation of the same fact. */
  byteExact: boolean;
  frozenAt: string;
  memberCount: number;
  /** The fields this classification actually checked for mutation-absence —
   *  derived from `SCIENTIFICALLY_MATERIAL_FIELD_NAMES`, never hand-typed. */
  materialFieldsChecked: readonly string[];
  /** Hash-covered fields where drift is either known (status, for vP1) or
   *  was found — empty when byte-exact, or when nothing could be attributed. */
  immaterialDriftFields: readonly string[];
  blockingGaps: string[];
  reason: string;
  /** Named once, unconditionally, so no reader mistakes an absence-of-
   *  evidence finding for a formal proof of no mutation whatsoever. */
  unresolvedRisk: string;
}

const CANONICAL_SEED_IDS: ReadonlySet<string> = new Set(
  (canonicalInvariantsSeed as { invariants?: Array<{ id?: string }> }).invariants?.map((inv) => inv.id ?? '') ?? [],
);

const UNRESOLVED_RISK_NOTE =
  'This classification covers every mutation path identified by the 2026-08-30 code audit ' +
  '(scripts/ingest-canonical-invariants.mjs; applyProvenanceReclassification; every other ' +
  'updateInvariant() call site). It is not a formal proof that no untraced code path or manual/' +
  'administrative database write exists — that residual risk is never resolved to zero by this module.';

interface MemberMutationCheck {
  invariantId: string;
  /** false ⇒ this member's statement/namespace/semanticType/provenance could
   *  never have been touched by the seed-ingest script's overwrite path. */
  seedIngestSafe: boolean;
  seedIngestReason: string;
  /** false ⇒ no provenance reclassification event fired after frozenAt. */
  reclassificationSafe: boolean;
  reclassificationReason: string;
  /** true only when both checks above completed without ambiguity. false ⇒
   *  this member's evidence could not be fully evaluated — fails closed. */
  evaluable: boolean;
}

function seedIngestCheck(inv: InvariantRecord): { safe: boolean; reason: string; evaluable: boolean } {
  const seedId = inv.seedId;
  const provenance = inv.provenance;
  const seededFrom = provenance && typeof provenance === 'object' ? provenance['seeded_from'] : undefined;
  const seedVersion = provenance && typeof provenance === 'object' ? provenance['seed_version'] : undefined;

  // Direct, unconditional evidence: the script stamps both keys on EVERY
  // write it makes, insert or update. Their presence is dispositive proof
  // the script touched this row at some point, regardless of seedId.
  if (seededFrom !== undefined && seededFrom !== null) {
    return {
      safe: false,
      reason: `provenance.seeded_from ('${String(seededFrom)}') is present — the seed-ingest script has written this row`,
      evaluable: true,
    };
  }
  if (seedVersion !== undefined && seedVersion !== null) {
    return {
      safe: false,
      reason: `provenance.seed_version (${JSON.stringify(seedVersion)}) is present — the seed-ingest script has written this row`,
      evaluable: true,
    };
  }

  // Structural immunity: the script's lookup is `.eq('seed_id', inv.id)` — a
  // null seedId can never match, and a non-null seedId absent from the seed
  // file's own id list can never match either.
  if (seedId === null || seedId === undefined) {
    return { safe: true, reason: 'seed_id is null — structurally unreachable by the seed-ingest script’s lookup', evaluable: true };
  }
  if (!CANONICAL_SEED_IDS.has(seedId)) {
    return {
      safe: true,
      reason: `seed_id '${seedId}' does not appear in canonical-invariants.seed.json — the seed-ingest script’s lookup cannot match it`,
      evaluable: true,
    };
  }
  return {
    safe: false,
    reason: `seed_id '${seedId}' matches an entry in canonical-invariants.seed.json — the seed-ingest script is capable of rewriting this row`,
    evaluable: true,
  };
}

function reclassificationCheck(
  inv: InvariantRecord,
  frozenAtMs: number,
): { safe: boolean; reason: string; evaluable: boolean } {
  const provenance = inv.provenance;
  if (!provenance || typeof provenance !== 'object') {
    return { safe: true, reason: 'no provenance bag — nothing to reclassify', evaluable: true };
  }
  const log = (provenance as Record<string, unknown>)[RECLASSIFICATION_LOG_KEY];
  if (log === undefined || log === null) {
    return { safe: true, reason: 'no provenanceReclassifications entries recorded', evaluable: true };
  }
  if (!Array.isArray(log)) {
    return {
      safe: false,
      reason: `provenance.${RECLASSIFICATION_LOG_KEY} is present but not an array — cannot be evaluated`,
      evaluable: false,
    };
  }
  for (const rawEvent of log) {
    const event = rawEvent as Partial<ProvenanceReclassification> | null;
    const at = event && typeof event === 'object' ? event.at : undefined;
    if (typeof at !== 'string') {
      return {
        safe: false,
        reason: `a provenanceReclassifications entry carries no parseable 'at' timestamp — cannot be evaluated`,
        evaluable: false,
      };
    }
    const atMs = Date.parse(at);
    if (Number.isNaN(atMs)) {
      return {
        safe: false,
        reason: `a provenanceReclassifications entry's 'at' ('${at}') is not a parseable timestamp — cannot be evaluated`,
        evaluable: false,
      };
    }
    if (atMs >= frozenAtMs) {
      return {
        safe: false,
        reason: `a provenanceReclassifications entry at '${at}' is at/after frozenAt — a scientifically material field (provenance) was reclassified after freeze`,
        evaluable: true,
      };
    }
  }
  return { safe: true, reason: `${log.length} reclassification event(s), all before frozenAt`, evaluable: true };
}

function checkMember(inv: InvariantRecord, frozenAtMs: number): MemberMutationCheck {
  const seedIngest = seedIngestCheck(inv);
  const reclassification = reclassificationCheck(inv, frozenAtMs);
  return {
    invariantId: inv.id,
    seedIngestSafe: seedIngest.safe,
    seedIngestReason: seedIngest.reason,
    reclassificationSafe: reclassification.safe,
    reclassificationReason: reclassification.reason,
    evaluable: seedIngest.evaluable && reclassification.evaluable,
  };
}

export interface DeriveLegacyFreezeVerificationInput {
  verifiedAgainstFreeze: boolean;
  frozenAt: string;
  /** The population `buildFrozenCrystalManifest` recovered via durable
   *  domain-context membership — NOT a live status-filtered re-query. Empty
   *  means membership could not be recovered at all. */
  invariants: readonly InvariantRecord[];
  /** True when the domain-membership read itself failed — a distinct failure
   *  mode from "read succeeded, zero members" (an empty domain). */
  membershipReadFailed: boolean;
}

/**
 * Pure, derived — never trusts a stored assertion (same discipline as
 * `remediationProfileBindingState`). Recomputes from the inputs every call.
 */
export function deriveLegacyFreezeVerification(
  input: DeriveLegacyFreezeVerificationInput,
): LegacyFreezeVerificationEvidence {
  const materialFieldsChecked = SCIENTIFICALLY_MATERIAL_FIELD_NAMES as readonly string[];
  const base = {
    frozenAt: input.frozenAt,
    memberCount: input.invariants.length,
    materialFieldsChecked,
    unresolvedRisk: UNRESOLVED_RISK_NOTE,
  };

  if (input.verifiedAgainstFreeze) {
    return {
      ...base,
      state: 'byte-exact',
      byteExact: true,
      immaterialDriftFields: [],
      blockingGaps: [],
      reason: 'the live domain corpus reproduces the frozen contentHash exactly — no drift of any kind, material or not',
    };
  }

  // condition 1 — complete historical membership recoverable.
  if (input.membershipReadFailed || input.invariants.length === 0) {
    return {
      ...base,
      state: 'unverified',
      byteExact: false,
      immaterialDriftFields: [],
      blockingGaps: [
        input.membershipReadFailed
          ? 'the domain-membership read failed — the complete historical population could not be recovered'
          : 'zero members were recovered — nothing to evaluate as the historical population',
      ],
      reason: 'membership could not be established as complete, so no legacy verification can proceed',
    };
  }

  if (!input.frozenAt) {
    return {
      ...base,
      state: 'unverified',
      byteExact: false,
      immaterialDriftFields: [],
      blockingGaps: ['no frozenAt timestamp is available — the temporal boundary for the provenance audit is undefined'],
      reason: 'without frozenAt, no post-freeze mutation window can be evaluated',
    };
  }
  const frozenAtMs = Date.parse(input.frozenAt);
  if (Number.isNaN(frozenAtMs)) {
    return {
      ...base,
      state: 'unverified',
      byteExact: false,
      immaterialDriftFields: [],
      blockingGaps: [`frozenAt ('${input.frozenAt}') is not a parseable timestamp`],
      reason: 'without a parseable frozenAt, no post-freeze mutation window can be evaluated',
    };
  }

  // condition 2 & 4 — every scientifically material field, every member,
  // every identified vector, actually evaluable.
  const perMember = input.invariants.map((inv) => checkMember(inv, frozenAtMs));
  const blockingGaps: string[] = [];

  const unevaluable = perMember.filter((m) => !m.evaluable);
  for (const m of unevaluable) {
    blockingGaps.push(`'${m.invariantId}': ${!m.seedIngestSafe ? m.seedIngestReason : m.reclassificationReason} — unevaluable, not assumed safe`);
  }

  const seedIngestUnsafe = perMember.filter((m) => m.evaluable && !m.seedIngestSafe);
  for (const m of seedIngestUnsafe) {
    blockingGaps.push(`'${m.invariantId}': ${m.seedIngestReason}`);
  }
  const reclassificationUnsafe = perMember.filter((m) => m.evaluable && !m.reclassificationSafe);
  for (const m of reclassificationUnsafe) {
    blockingGaps.push(`'${m.invariantId}': ${m.reclassificationReason}`);
  }

  if (blockingGaps.length > 0) {
    return {
      ...base,
      state: 'unverified',
      byteExact: false,
      immaterialDriftFields: [],
      blockingGaps,
      reason:
        'one or more members show evidenced (or unevaluable) mutation on a scientifically material field since ' +
        'freeze — scientific-content-verified requires a clean result for every recovered member',
    };
  }

  // condition 3 — the only field this codebase's freeze-eligibility rule
  // guarantees changed is `status` (freeze only ever draws from
  // validated/canonical rows, so a currently non-validated/canonical member
  // is KNOWN to have transitioned since it was part of that corpus). Every
  // materially-checked field above passed with no evidence of mutation, so
  // any hash drift is confined to `status` — the one field
  // SCIENTIFICALLY_MATERIAL_FIELD_NAMES excludes.
  const statusDrifted = input.invariants.filter((inv) => inv.status !== 'validated' && inv.status !== 'canonical');
  const immaterialDriftFields = statusDrifted.length > 0 ? (['status'] as const) : [];

  if (immaterialDriftFields.length === 0) {
    // verifiedAgainstFreeze is false, no material-field mutation was found,
    // and no status drift explains it either — an unexplained mismatch.
    // Never attribute it to "status" by default; fail closed.
    return {
      ...base,
      state: 'unverified',
      byteExact: false,
      immaterialDriftFields: [],
      blockingGaps: [
        'the frozen contentHash does not reproduce, no evidenced mutation was found on any scientifically ' +
          'material field, and no member currently carries a non-freeze-eligible status either — the hash ' +
          'mismatch is unexplained and cannot be attributed to a known-immaterial field',
      ],
      reason: 'an unattributed hash mismatch is treated as unverified, never assumed to be status-only',
    };
  }

  return {
    ...base,
    state: 'scientific-content-verified',
    byteExact: false,
    immaterialDriftFields,
    blockingGaps: [],
    reason:
      `${input.invariants.length} recovered member(s) show no evidenced post-freeze mutation on any ` +
      `scientifically material field (${materialFieldsChecked.join(', ')}). The frozen contentHash does not ` +
      `reproduce because ${statusDrifted.length}/${input.invariants.length} member(s) now carry a status ` +
      `outside {validated, canonical} (e.g. merged as a duplicate since freeze) — a field no readiness check ` +
      `reads as measured content. Hash drift is confined to that one, scientifically immaterial field.`,
  };
}
