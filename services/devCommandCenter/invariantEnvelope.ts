/**
 * invariantEnvelope — IDE 2.0's retrieval seam for DevOn (Homecoming III Phase 2).
 *
 * ── What this module is, and is not ────────────────────────────────────────
 *
 * It is COMPOSITION. Every retrieval mechanism it uses already exists in
 * production and is called, not reimplemented:
 *
 *   @organ services/invariants/resolution.ts  — resolveConstitutionalField(),
 *          the universal constitutional pass and the perception over intent text
 *   @organ services/invariants/grounding.ts   — buildInvariantSlice(), the
 *          scoped substrate query (standing-ranked, server-side)
 *   @organ services/invariants/resolutionRecords.ts — loadRegistry(), the
 *          candidate-invariant registry and its `devon` projection channel
 *   @organ services/invariants/resolution.ts  — INVARIANT_BUDGET, the existing
 *          injection caps. No new budget is minted here.
 *
 * The Invariant Resolution Engine already performed retrieval and compression;
 * it was simply wired to the copilot and never to DevOn. Closing that one gap
 * is most of what makes DevOn invariant-driven, which is why this file is
 * small and calls a great deal.
 *
 * ── The problem this module exists to solve safely ─────────────────────────
 *
 * It merges FOUR epistemically different populations into one envelope:
 *
 *   constitutional invariants · substrate members · devon-projected
 *   candidates · live discoveries (Phase 3)
 *
 * An audit of the projection channel on 2026-08-15 found 29 candidates
 * declaring a `devon` target, of which 26 are `candidate` and only 3 are
 * `ratified`. Flattened into a prompt, 26 hypotheses would read exactly like 3
 * ratified rules. So every mapper below sets `provenance` and `lifecycle`, and
 * `mayBeCitedAsEstablished()` is the ONLY path into established context
 * (operator ruling, 2026-08-15).
 *
 * ── Purity boundary ────────────────────────────────────────────────────────
 *
 * The ranking, scope assignment, epistemic partition and compression are PURE
 * and exercised directly by canaries. Only `buildInvariantEnvelope` performs
 * I/O. That split is deliberate: the properties worth pinning are properties
 * of the selection, and a test that can only reach them through Supabase is a
 * test that does not run.
 */

import { loadRegistry } from '@/services/invariants/resolutionRecords';
import { buildInvariantSlice, type InvariantSliceItem } from '@/services/invariants/grounding';
import { resolveConstitutionalField, INVARIANT_BUDGET } from '@/services/invariants/resolution';
import {
  INVARIANT_ENVELOPE_SCHEMA_VERSION,
  INVARIANT_SCOPES,
  mayBeCitedAsEstablished,
  renderMarkedInvariantBlock,
  type CompressedInvariantSet,
  type EnvelopeInvariant,
  type InvariantDevelopmentEnvelope,
  type InvariantScope,
} from '@/types/invariantEnvelope';
import type { CandidateInvariant } from '@/types/resolutionRecords';
import type { StructuredDevIntent } from '@/types/devCommandCenter';

// ---------------------------------------------------------------------------
// Scope ranking — search broad→specific, RANK by causal materiality
// ---------------------------------------------------------------------------

/**
 * Materiality weight per scope.
 *
 * PRD §6: retrieval searches broad → specific but ranks by CAUSAL MATERIALITY,
 * "not simply taxonomy". Those pull in opposite directions, and this table is
 * where that is resolved: a repository-scoped invariant that determines the
 * outcome of THIS intent outranks a cross-domain one that merely touches it.
 *
 * `constitutional` is weighted top because it is non-negotiable rather than
 * because it is specific — it is the one scope whose members bound what may be
 * built at all. Everything below it rises with specificity to the intent.
 */
const SCOPE_MATERIALITY: Record<InvariantScope, number> = {
  constitutional: 1.0,
  intent: 0.9,
  repository: 0.8,
  'project-runtime': 0.7,
  'agentic-development': 0.6,
  'software-development': 0.5,
  'cross-domain': 0.4,
};

/** Broad → specific. The SEARCH order; ranking is separate and above. */
export const SCOPE_SEARCH_ORDER: readonly InvariantScope[] = INVARIANT_SCOPES;

/**
 * Lifecycle contribution to ranking — small, and deliberately so.
 *
 * Standing must not become a proxy for relevance: a `candidate` that squarely
 * determines this intent's outcome should outrank a `canonical` one that
 * barely touches it, or the envelope silently becomes a canon dump. The nudge
 * only breaks ties between comparably material members.
 */
function lifecycleNudge(item: EnvelopeInvariant): number {
  return mayBeCitedAsEstablished(item.lifecycle) ? 0.05 : 0;
}

/**
 * Rank by causal materiality, established-status only breaking ties.
 *
 * Pure and stable: equal scores preserve input order, so ranking never
 * reorders arbitrarily between runs.
 */
export function rankByMateriality(items: readonly EnvelopeInvariant[]): EnvelopeInvariant[] {
  return items
    .map((item, index) => {
      const base = typeof item.materiality === 'number' ? item.materiality : SCOPE_MATERIALITY[item.scope];
      return { item, index, score: base + lifecycleNudge(item) };
    })
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((r) => r.item);
}

// ---------------------------------------------------------------------------
// Mappers — every one of them sets provenance AND lifecycle
// ---------------------------------------------------------------------------

/**
 * A substrate slice item → an envelope member.
 *
 * `status` travels. The existing prompt path (`CitableInvariant`) projects the
 * same source down to `{seedId, statement}` and drops it, which is exactly the
 * erasure this envelope exists to prevent.
 */
export function fromSliceItem(
  item: InvariantSliceItem,
  scope: InvariantScope,
  provenance: 'constitutional-substrate' | 'crystal-substrate',
): EnvelopeInvariant {
  return {
    ref: String(item.seedId ?? item.id),
    statement: item.statement,
    provenance,
    lifecycle: { registry: 'invariant-substrate', status: item.status },
    scope,
    bearing: null,
    recoveries: [],
    materiality: 'unknown',
  };
}

/**
 * A `devon`-projected candidate invariant → an envelope member.
 *
 * Lifecycle is carried verbatim from the registry. A candidate at `candidate`
 * arrives as `candidate` and can never be presented as established, however
 * materially relevant it turns out to be.
 */
export function fromCandidate(candidate: CandidateInvariant, scope: InvariantScope): EnvelopeInvariant {
  return {
    ref: candidate.candidateId,
    statement: candidate.statement,
    provenance: 'projection-devon',
    lifecycle: { registry: 'resolution-records', status: candidate.status },
    scope,
    bearing: null,
    recoveries: [],
    materiality: 'unknown',
  };
}

/**
 * The scope a projected candidate occupies.
 *
 * Derived from the registry's OWN `scope` field rather than guessed from the
 * statement text: `cross-capability` is the registry's word for "binds beyond
 * where it was found", which is this ladder's `cross-domain`; `local` binds
 * where it was found, which for a devon projection is the repository.
 */
export function candidateScope(candidate: CandidateInvariant): InvariantScope {
  return candidate.scope === 'cross-capability' ? 'cross-domain' : 'repository';
}

// ---------------------------------------------------------------------------
// Epistemic partition — the shape prompt composition must preserve
// ---------------------------------------------------------------------------

export interface EpistemicPartition {
  /** Citable as established: constitutional + ratified/canonical members. */
  established: EnvelopeInvariant[];
  /** Real, relevant, and NOT established — candidates and proposals. */
  signals: EnvelopeInvariant[];
  /** Discovered this run, in no registry. */
  discoveries: EnvelopeInvariant[];
}

/**
 * Split an envelope into its epistemic populations.
 *
 * Operator requirement, 2026-08-15: "established invariants, candidate
 * signals, live discoveries, and constitutional constraints must remain
 * structurally distinct" all the way through prompt composition. A single
 * ranked list with markers keeps them DISTINGUISHABLE; this partition keeps
 * them SEPARATE, so a composer cannot merge them by accident even while
 * respecting the markers.
 *
 * Constitutional members land in `established` — they are established by
 * ratification, which is what the constitutional pass returns — while
 * remaining identifiable by `provenance` for a composer that wants to render
 * them under their own heading.
 */
export function partitionByEpistemicStanding(items: readonly EnvelopeInvariant[]): EpistemicPartition {
  const established: EnvelopeInvariant[] = [];
  const signals: EnvelopeInvariant[] = [];
  const discoveries: EnvelopeInvariant[] = [];
  for (const item of items) {
    if (item.provenance === 'live-discovery') discoveries.push(item);
    else if (mayBeCitedAsEstablished(item.lifecycle)) established.push(item);
    else signals.push(item);
  }
  return { established, signals, discoveries };
}

// ---------------------------------------------------------------------------
// Compression — the minimal causally determining set (PRD §14)
// ---------------------------------------------------------------------------

/**
 * Compress a ranked envelope into what actually reaches the model.
 *
 * Reuses `INVARIANT_BUDGET.withSessionMemory` rather than minting a cap: the
 * budget already exists precisely so nothing bounds the SUM in one place and
 * every injection site by itself.
 *
 * Two properties the canaries pin:
 *
 *  - **Nothing is dropped silently.** `omittedRefs` names every member the
 *    budget excluded. Compression that cannot say what it dropped is
 *    indistinguishable from retrieval that found nothing.
 *  - **Established members are never crowded out.** They are admitted first,
 *    so a large candidate population cannot push the constitutional ground out
 *    of the prompt. That is the failure mode the `devon` channel introduces:
 *    26 of its 29 members are non-established, and a purely materiality-ranked
 *    cut could fill the budget with them.
 */
export function compressEnvelope(
  ranked: readonly EnvelopeInvariant[],
  budget: number = INVARIANT_BUDGET.withSessionMemory,
): CompressedInvariantSet {
  const { established, signals, discoveries } = partitionByEpistemicStanding(ranked);
  const ordered = [...established, ...signals, ...discoveries];
  const items = ordered.slice(0, budget);
  /*
   * OMISSION IS TRACKED BY IDENTITY, NOT BY REF.
   *
   * A ref is NOT unique within an envelope: an invariant may hold at several
   * scopes, and `scope` is a property of the retrieval rather than an
   * exclusive classification of the invariant — a member may therefore appear
   * twice under one ref at two scopes.
   *
   * A `Set<ref>` of the carried members would then mark the OTHER copy as
   * carried too, and it would vanish from `omittedRefs` — dropped from the
   * prompt without being named. That is the silent omission this function
   * exists to make impossible, reintroduced by the bookkeeping rather than by
   * the budget.
   *
   * Object identity is the correct key: each retrieved member is its own
   * occurrence regardless of what it shares with another.
   */
  const kept = new Set<EnvelopeInvariant>(items);
  return {
    items,
    omittedRefs: ranked.filter((i) => !kept.has(i)).map((i) => i.ref),
    budgetApplied: budget,
    block: renderMarkedInvariantBlock(items),
  };
}

// ---------------------------------------------------------------------------
// Retrieval — the one I/O function
// ---------------------------------------------------------------------------

export interface EnvelopeBuildOptions {
  /** Domains to scope the substrate query to. Absent = unscoped substrate. */
  domains?: string[];
  /** Include the `devon` projection channel. Default true. */
  includeDevonProjections?: boolean;
  /** Repo root for the registry read. */
  repoRoot?: string;
  /** ISO timestamp — this module never reads the clock. */
  now: string;
  stage?: string;
}

/**
 * Read the `devon`-projected candidates from the existing registry.
 *
 * Pure filter over `loadRegistry()`; no second reader, no second registry
 * (CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001).
 */
export function loadDevonProjectedCandidates(repoRoot?: string): CandidateInvariant[] {
  const reg = loadRegistry(repoRoot ?? process.cwd());
  return reg.candidates.filter((c) => (c.projections?.targets ?? []).includes('devon'));
}

/**
 * Build the envelope for a development intent.
 *
 * Order matters and is the operator's ruling made structural:
 *
 *  1. **Constitutional first, and separately.** Its own pass, so it cannot be
 *     crowded out by a large scoped or projected population downstream.
 *  2. Scoped substrate.
 *  3. `devon` projections, lifecycle intact.
 *
 * Best-effort on the substrate legs (inherits the IRE's own fail-open
 * contract): a retrieval hiccup yields a thinner envelope, never a thrown
 * stage. The registry leg is filesystem-local and allowed to fail loudly.
 */
export async function buildInvariantEnvelope(
  intent: StructuredDevIntent,
  sessionRef: string,
  opts: EnvelopeBuildOptions,
): Promise<InvariantDevelopmentEnvelope> {
  const intentText = [intent.goal, ...(intent.successCriteria ?? []), ...(intent.constraints ?? [])]
    .filter(Boolean)
    .join('\n');

  const scopesSearched: InvariantScope[] = [];
  const invariants: EnvelopeInvariant[] = [];

  // 1 — Constitutional pass, on its own, first.
  try {
    const field = await resolveConstitutionalField(intentText);
    const universal = field.universal?.slice.items ?? [];
    if (universal.length > 0) scopesSearched.push('constitutional');
    for (const item of universal) {
      invariants.push(fromSliceItem(item, 'constitutional', 'constitutional-substrate'));
    }
  } catch {
    /* fail-open: a thinner envelope, never a thrown stage */
  }

  // 2 — Scoped substrate.
  try {
    const slice = await buildInvariantSlice({
      domains: opts.domains,
      limit: INVARIANT_BUDGET.withSessionMemory * 2,
    });
    const scope: InvariantScope = opts.domains?.length ? 'project-runtime' : 'software-development';
    if (slice.items.length > 0) scopesSearched.push(scope);
    for (const item of slice.items) {
      if (invariants.some((existing) => existing.ref === String(item.seedId ?? item.id))) continue;
      invariants.push(fromSliceItem(item, scope, 'crystal-substrate'));
    }
  } catch {
    /* fail-open, as above */
  }

  // 3 — devon projections, lifecycle intact.
  if (opts.includeDevonProjections !== false) {
    const candidates = loadDevonProjectedCandidates(opts.repoRoot);
    for (const candidate of candidates) {
      const scope = candidateScope(candidate);
      if (!scopesSearched.includes(scope)) scopesSearched.push(scope);
      invariants.push(fromCandidate(candidate, scope));
    }
  }

  const ranked = rankByMateriality(invariants);

  return {
    schemaVersion: INVARIANT_ENVELOPE_SCHEMA_VERSION,
    intentRef: intent.intentId,
    sessionRef,
    stageAtConstruction: opts.stage ?? 'intent_capture',
    scopesSearched,
    invariants: ranked,
    riskField: null,
    proofsOfRisk: [],
    expectedConsequences: [],
    falsifiers: [],
    unresolvedQuestions: [],
    compressed: compressEnvelope(ranked),
    generatedAt: opts.now,
    updatedAt: opts.now,
  };
}
