/**
 * resolution — the Invariant Resolution Engine, Phase 0 (CFS-037 / PRD-IRE-001,
 * RATIFIED 2026-07-28 by operator act `ACT-IRE-FAMILY-2026-07-28`, decision id
 * `CFS-037`; operator: "Go straight into p0").
 *
 * The 2026-07-17 ratification this header used to assert was agent-transcribed
 * attestation, which Law XI does not permit an agent to promote on, so the
 * header was corrected to DRAFT on 2026-07-27. The operator supplied the act
 * directly on 2026-07-28 — covering CFS-037/038/039/040/041 as ONE act with
 * FIVE independent document commitments and deliberately no aggregate hash —
 * so the claim is now true on the record rather than on a transcript. The
 * ratified bytes and the ledger row are in the CFS-037 header and
 * `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`.
 *
 * The constitutional query planner: RESOLUTION PRECEDES REASONING. Given an
 * intent, construct the minimal Resolved Constitutional Field it requires —
 * BEFORE any iQube selection, agent assembly, or LLM call. The IRE resolves;
 * the Invariant Projection Engine (CFS-035/039) projects.
 *
 * THE IPE NEVER RESOLVES A FIELD; IT CONSUMES ONE PRODUCED HERE. That was a
 * claim this header made while `engine.ts` — the module CFS-039 designates the
 * IPE — exported `computeFieldSnapshot`, `groundReasoning` and
 * `getCachedFieldSnapshot`. Corrected 2026-07-27 on operator ruling: field
 * construction now lives in `grounding.ts`, `engine.ts` imports only the TYPE,
 * and no self-resolving fallback is permitted anywhere in the projector.
 * Which surfaces actually route through this engine is recorded, queryably, in
 * `GROUNDING_SURFACES` at the foot of this file — never in a comment.
 *
 * Five phases (CFS-037 §3), Phase-0 scope per phase:
 *   1 Qualify   — v0: perception.extractField over intent text (the honest
 *                 keyword estimator; semantic qualification is the Gen-3 drop-in).
 *   2 Resolve   — the Universal Invariant Library pass (§4): today the library's
 *                 16 baseline nodes are UNSEEDED candidates, so the universal
 *                 pass grounds in the constitutional/epistemology namespaces
 *                 (the closest seeded proxy) — honest, named, not faked.
 *   3 Expand    — domain expansion via the perceived domains (+ caller extras).
 *   4 Calibrate — the first coordinate calibration (§5): per-invariant
 *                 STRUCTURAL coordinates derived from the record's own axes
 *                 (standing/confidence/reach — the seeded reality), plus
 *                 field-level OPERATIONAL estimates. Constitutional-class
 *                 coordinates (authority/consent/delegability…) need actor
 *                 context — carried as null until the CCR pass (never faked).
 *   5 Assemble  — one ResolvedConstitutionalField object.
 *
 * EXTENSION, NOT REPLACEMENT (operator directive): the field EXTENDS the
 * engine's FieldSnapshot (it carries one); coordinates extend the
 * IQubeScoreBlock calibrated-axis + provenance pattern (each coordinate carries
 * its `basis`). Nothing prior is superseded.
 *
 * SHADOW-FIRST (CFS-017): Phase 0 observes — `resolveConstitutionalField` is
 * pure composition + read-only grounding; it gates nothing. Consumers fold the
 * resolved field into traces (the Horizen pipeline is the first proving ground).
 *
 * T1-safe: statements/scores/domains only — never a personaId.
 */

import type { GroundingContext } from './grounding';
import type { InvariantNamespace } from '../../types/invariants';
import { computeFieldSnapshot, type FieldSnapshot } from './grounding';
import { extractField, type FieldExtraction } from './perception';
import { basisFor } from './coordinates';

// ─────────────────────────────────────────────────────────────────────────
// The Universal Invariant Library (CFS-037 §4) — candidate baseline, unseeded.
// Named here as the canonical constant so the seed-and-ratify pass (CCR) has
// one home to bind to. The runtime NEVER assumes this library is complete.
// ─────────────────────────────────────────────────────────────────────────

export const UNIVERSAL_INVARIANT_LIBRARY = [
  'personhood',
  'identity',
  'authority',
  'consent',
  'privacy',
  'trust',
  'accountability',
  'standing',
  'evidence',
  'provenance',
  'verifiability',
  'risk',
  'time-to-value',
  'repair-cost',
  'delegability',
  'constitutional-integrity',
] as const;
export type UniversalInvariant = (typeof UNIVERSAL_INVARIANT_LIBRARY)[number];

/** Namespaces the universal pass grounds in until the library is seeded —
 *  the closest seeded proxy for the baseline constitutional questions. */
const UNIVERSAL_PROXY_NAMESPACES: InvariantNamespace[] = ['constitutional', 'epistemology'];

// ─────────────────────────────────────────────────────────────────────────
// Constitutional Coordinates (CFS-037 §5) — Phase-0 calibration
// ─────────────────────────────────────────────────────────────────────────

/** One calibrated coordinate: value in [0,1] + the basis that produced it
 *  (the IQubeScoreBlock derived/override provenance pattern, lifted). */
export interface Coordinate {
  value: number;
  /** How the value was derived — transparency, never a bare number. */
  basis: string;
}

/** Per-invariant structural coordinates (actor-independent; Phase 0 derives
 *  them from the record's own seeded axes — no invented data). */
export interface InvariantCoordinates {
  invariantId: string;
  seedId: string | null;
  structural: {
    verifiability: Coordinate; // from confidence (validation-class axis)
    evidenceDensity: Coordinate; // from standing (earned validation)
    adoption: Coordinate; // from reach (Law XII)
  };
  /** Constitutional-class coordinates need actor context (authority, consent,
   *  delegability…). Phase 0 carries them as null — the CCR pass defines the
   *  basis; they are NEVER estimated without one (no fabricated calibration). */
  constitutional: null;
}

/** Field-level operational coordinates (Phase-0 estimates, basis named). */
export interface OperationalCoordinates {
  knowledgeCoverage: Coordinate; // how much of the intent the field covers
  reusePotential: Coordinate; // strength of existing canon in this region
  timeToValue: Coordinate; // proxy: coverage × canon strength (named as such)
}

// ─────────────────────────────────────────────────────────────────────────
// The Resolved Constitutional Field (CFS-037 §6)
// ─────────────────────────────────────────────────────────────────────────

/** The qualified intent (Phase-0: perception extraction + the raw text).
 *  Objectives/constraints/authority/stakeholders arrive with the IntentQube
 *  extension (CFS-037 §2 row 1) — typed now, resolved later, never faked. */
export interface ResolvedIntent {
  text: string;
  extraction: FieldExtraction;
  objectives: string[] | null;
  constraints: string[] | null;
  successCriteria: string[] | null;
}

/**
 * The IRE's output — a per-intent REGION of the (global) constitutional field.
 * EXTENDS FieldSnapshot (carries it verbatim). The register distinction
 * (CFS-037 §6): the global Constitutional Field is the whole substrate the
 * Observatory visualizes; THIS is the resolved region one intent requires.
 */
export interface ResolvedConstitutionalField {
  resolvedIntent: ResolvedIntent;
  /** The universal-pass snapshot (baseline constitutional grounding). */
  universal: FieldSnapshot | null;
  /** The domain-expanded snapshot (universal ∪ perceived domains). */
  snapshot: FieldSnapshot | null;
  /** Per-invariant coordinate calibration over the expanded slice. */
  coordinates: InvariantCoordinates[];
  operational: OperationalCoordinates;
  /** Overall resolution confidence [0,1] — perception × grounding coverage. */
  confidence: number;
  /** Every invariant id the resolution touched (the citation return path). */
  citedIds: string[];
  /** Honest phase marker — consumers know what this resolution can and
   *  cannot claim (Phase 0: keyword qualification, proxy universal pass,
   *  structural-only coordinates). */
  phase: 'p0-shadow';
}

// ─────────────────────────────────────────────────────────────────────────
// Pure calibration helpers (node-drillable)
// ─────────────────────────────────────────────────────────────────────────

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// ── Substrate-axis → unit-interval CONVERSIONS (operator ruling, 2026-07-27) ──
//
// "This is a units defect, not an experimental alternative."
//
// Two of the three structural axes are 0–100 database scores; the third is
// genuinely a unit interval. Clamping is only correct for the third. The ranges
// below are read from the SCHEMA, never from a comment — the previous comments
// are how the defect survived review:
//
//   standing   numeric(5,1) CHECK (standing >= 0 AND standing <= 100)
//              — supabase/migrations/20260703200000_invariant_substrate.sql
//   reach      numeric(5,1) CHECK (reach    >= 0 AND reach    <= 100)
//              — supabase/migrations/20260703230000_law_xii_truth_standing_reach.sql
//   confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1)
//              — the ONLY axis a bare clamp is correct for.
//
// The defect: `clamp01(standing)` mapped EVERY invariant with standing >= 1 to
// exactly 1.0, so the coordinate axis was flat where the standing axis is
// proportional. `projectionBridge` and `engine` both claim the two agree "by
// construction"; they could not, and `diverges` fired on a units mismatch
// rather than on the CCR research signal it is documented to measure.
//
// These are NAMED conversions, not inline arithmetic, so that deleting the
// scaling is a visible edit that a canary can kill (CB-5, CFS-053 §7).

/** The 0–100 span of the substrate's `standing` / `reach` score columns. */
const SUBSTRATE_SCORE_MAX = 100;

/** Convert a 0–100 `standing` score to the [0,1] evidenceDensity coordinate. */
export const normaliseStanding = (standing: number): number =>
  clamp01(standing / SUBSTRATE_SCORE_MAX);

/**
 * Convert a 0–100 `reach` score to the [0,1] adoption coordinate.
 *
 * The prior form was `reach / (reach + 5)`, justified by a comment calling reach
 * an "unbounded adoption count". It is not: `computeReachScore` (lifecycle.ts)
 * already returns `100 * base / (base + 40)` — a SATURATING transform of the
 * underlying counts, bounded 0–100 by the same CHECK constraint as standing.
 * The old form therefore applied a second saturation on top of the first, so
 * reach 20 read 0.80 and reach 50 read 0.91 — compressing the top of the range
 * into nothing. A bounded score converts by division, exactly like standing.
 */
export const normaliseReach = (reach: number): number => clamp01(reach / SUBSTRATE_SCORE_MAX);

/** Calibrate one slice item's structural coordinates from its seeded axes. Pure. */
export function calibrateStructural(item: {
  id: string;
  seedId: string | null;
  confidence: number;
  standing: number;
  reach: number;
}): InvariantCoordinates {
  return {
    invariantId: item.id,
    seedId: item.seedId,
    structural: {
      // Basis strings come from the Constitutional Coordinates Registry
      // (CFS-038) — the single provenance source, never an inline literal.
      // `confidence` is the one axis the substrate already stores in [0,1].
      verifiability: { value: clamp01(item.confidence), basis: basisFor('verifiability') },
      evidenceDensity: { value: normaliseStanding(item.standing), basis: basisFor('evidenceDensity') },
      adoption: { value: normaliseReach(item.reach), basis: basisFor('adoption') },
    },
    constitutional: null,
  };
}

/** Field-level operational coordinates from the resolution result. Pure. */
export function calibrateOperational(
  extraction: FieldExtraction,
  coordinates: InvariantCoordinates[],
): OperationalCoordinates {
  const n = coordinates.length;
  const meanStanding = n > 0 ? coordinates.reduce((s, c) => s + c.structural.evidenceDensity.value, 0) / n : 0;
  const coverage = clamp01(n / 8); // 8 = the default slice cap — full slice ⇒ full coverage
  return {
    knowledgeCoverage: { value: coverage, basis: basisFor('knowledgeCoverage') },
    reusePotential: { value: clamp01(meanStanding), basis: basisFor('reusePotential') },
    // Named proxy — canon that exists AND is earned collapses time (CRP-002).
    timeToValue: { value: clamp01(coverage * (0.5 + meanStanding / 2)), basis: basisFor('timeToValue') },
  };
}

/** Overall resolution confidence. Pure. */
export function resolutionConfidence(extraction: FieldExtraction, sliceSize: number): number {
  const groundingCoverage = clamp01(sliceSize / 8);
  // Perception confidence is crude (v0); weight grounding higher.
  return clamp01(0.3 * extraction.confidence + 0.7 * groundingCoverage);
}

// ─────────────────────────────────────────────────────────────────────────
// The engine — five phases composed
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve the constitutional field an intent requires (Phase 0, shadow).
 * Read-only; never gates. A DB failure degrades to a null-snapshot field with
 * the qualification intact (the perception guard pattern).
 */
export async function resolveConstitutionalField(
  intentText: string,
  extra?: Partial<GroundingContext>,
): Promise<ResolvedConstitutionalField> {
  // 1 Qualify (v0 — perception over the intent text)
  const extraction = extractField(intentText);
  const resolvedIntent: ResolvedIntent = {
    text: intentText.trim().slice(0, 600),
    extraction,
    objectives: null,
    constraints: null,
    successCriteria: null,
  };

  // 2 Resolve — the universal pass (proxy namespaces until the library seeds)
  let universal: FieldSnapshot | null = null;
  try {
    universal = await computeFieldSnapshot({ namespaces: UNIVERSAL_PROXY_NAMESPACES, limit: 6 });
  } catch {
    universal = null;
  }

  // 3 Expand — universal ∪ perceived domains (+ caller extras)
  //
  // Empty-perception discipline (IRV-001 shakedown finding, 2026-07-18): when
  // perception localizes NO domain and the caller supplies none, DO NOT ground
  // unscoped — an unscoped grounding returns the GLOBAL highest-standing slice,
  // which is dominated by high-standing engine-node invariants (e.g. the
  // discovery-ranking node) that are irrelevant to a domain-reasoning intent.
  // The honest fallback is the universal constitutional/epistemology baseline
  // (the same proxy namespaces the universal pass uses), NOT the global top.
  const callerDomains = Array.isArray(extra?.domains) && extra.domains.length > 0;
  const noDomainLocalized = extraction.empty && !callerDomains;
  let snapshot: FieldSnapshot | null = null;
  try {
    snapshot = await computeFieldSnapshot(
      noDomainLocalized
        ? { ...extra, namespaces: UNIVERSAL_PROXY_NAMESPACES, domains: undefined, limit: extra?.limit ?? 8 }
        : { ...extra, domains: extraction.empty ? extra?.domains : extraction.domains, limit: extra?.limit ?? 8 },
    );
  } catch {
    snapshot = null;
  }

  // 4 Calibrate — structural per-invariant + operational field-level
  const items = snapshot?.slice.items ?? [];
  const coordinates = items.map((i) =>
    calibrateStructural({ id: i.id, seedId: i.seedId, confidence: i.confidence, standing: i.standing, reach: i.reach }),
  );
  const operational = calibrateOperational(extraction, coordinates);

  // 5 Assemble
  const citedIds = [...new Set([...(universal?.citedIds ?? []), ...(snapshot?.citedIds ?? [])])];
  return {
    resolvedIntent,
    universal,
    snapshot,
    coordinates,
    operational,
    confidence: resolutionConfidence(extraction, items.length),
    citedIds,
    phase: 'p0-shadow',
  };
}

/** Compact trace line for pipeline/observability surfaces. Pure. */
export function describeResolvedField(field: ResolvedConstitutionalField): string {
  const d = field.resolvedIntent.extraction.domains;
  return (
    `IRE p0: ${field.coordinates.length} invariant(s) resolved` +
    (d.length ? ` [domains: ${d.join(', ')}]` : ' [unscoped]') +
    ` · coverage ${field.operational.knowledgeCoverage.value.toFixed(2)}` +
    ` · reuse ${field.operational.reusePotential.value.toFixed(2)}` +
    ` · confidence ${field.confidence.toFixed(2)}`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Citable-invariant projection — the minimal reusable grounding assembly.
//
// codex/chat (app/api/codex/chat/route.ts, SmartTriad Phase 2 block) resolves
// a message through resolveConstitutionalField and folds the top slice items
// into a "Governing platform invariants" system-prompt block, cited by seed
// id. That formatting was inlined in codex/chat's giant buildSystemPrompt —
// this is the same projection + formatting, factored out ONCE here so any
// new grounded copilot (e.g. MoneyPenny, app/api/moneypenny/chat/route.ts)
// reuses it instead of re-deriving or hand-copying the block (CLAUDE.md
// "Extend, Don't Duplicate" / inv.engineering.036/037).
// ─────────────────────────────────────────────────────────────────────────

/** A T1-safe, citable invariant — seed id + statement only. */
export interface CitableInvariant {
  seedId: string;
  statement: string;
}

/**
 * Resolve the message's constitutional field and project it into a compact,
 * citable list (seedId + statement) — the same shape codex/chat folds into
 * its system prompt. Read-only, best-effort: a resolution failure yields an
 * empty list rather than throwing, so a grounding hiccup never blocks the
 * chat turn it would otherwise ground.
 */
export async function resolveCitableInvariants(
  intentText: string,
  limit = 8,
  extra?: Partial<GroundingContext>,
): Promise<CitableInvariant[]> {
  if (!intentText || !intentText.trim()) return [];
  try {
    const field = await resolveConstitutionalField(intentText, extra);
    const items = (field.snapshot?.slice.items ?? []).slice(0, limit);
    if (items.length > 0) {
      return items.map((i) => ({ seedId: String(i.seedId ?? i.id), statement: String(i.statement) }));
    }
    // A scoped slice can come back thin/empty while the scoped library is
    // small (e.g. `finance` with only a handful of invariants) — fall back to
    // the unscoped resolution rather than showing no citations at all. Same
    // empty-perception discipline resolveConstitutionalField itself already
    // applies (line ~236) — never let a narrow scope produce a worse result
    // than no scope would have.
    //
    // This covers EVERY scoping signal, not just namespaces. `extra` is the
    // overlay (a cartridge, a domain, an ontology class); an overlay selects
    // WHICH invariants surface, it can never subtract the substrate. A domain-
    // scoped miss that returned [] would have made the common ground
    // conditional on the overlay — the exact category error this seam exists
    // to prevent.
    const isScoped = Boolean(
      extra?.namespaces?.length || extra?.domains?.length || extra?.ontologyClassIds?.length,
    );
    if (isScoped) {
      const unscoped = await resolveConstitutionalField(intentText);
      return (unscoped.snapshot?.slice.items ?? [])
        .slice(0, limit)
        .map((i) => ({ seedId: String(i.seedId ?? i.id), statement: String(i.statement) }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Format a citable-invariant list as the "cite by seed id" system-prompt
 * block (same convention as codex/chat's `platformInvariants` block). An
 * empty list yields an empty string — callers must never fabricate a block
 * when resolution found nothing relevant; honesty over completeness.
 */
export function formatCitableInvariantsBlock(invariants: CitableInvariant[]): string {
  if (invariants.length === 0) return '';
  const lines = invariants.map((inv) => `- [${inv.seedId}] ${inv.statement}`);
  return `### Governing platform invariants (IRE-resolved for this message — cite by seed id when they ground a claim)\n${lines.join('\n')}`;
}

/**
 * The invariant injection budget, in one place (PRD §5: "each copilot must
 * keep room for BOTH platform-wide and domain knowledge").
 *
 * These caps used to live as three bare literals at three independent
 * injection sites, so nothing bounded their SUM — the property the budgeting
 * rule is actually about. A fourth uncapped path would have crowded out the
 * cartridge corpus with no single place to notice.
 */
export const INVARIANT_BUDGET = {
  /** Invariants resolved from THIS message (the leading edge of the field). */
  currentTurn: 8,
  /** Ceiling after session memory tops up the current-turn resolution. */
  withSessionMemory: 12,
  /** Compiled partnership memory (CFS-045), injected alongside, not within. */
  partnershipMemory: 6,
} as const;

/**
 * Resolve the COMMON CONSTITUTIONAL GROUND for a turn — the L1 substrate every
 * copilot stands on, independent of which cartridge it is embedded in.
 *
 * The distinction this function exists to hold:
 *
 *   - The **substrate** is unconditional. Every copilot is one constitutional
 *     intelligence; absence of cartridge context does not subtract its ground.
 *   - The **overlay** (`overlay`) only ever narrows WHICH invariants surface.
 *     It never decides WHETHER the substrate exists, and a scoped miss falls
 *     back to the unscoped field rather than returning nothing.
 *
 * Callers must therefore invoke this for every turn and pass the overlay as an
 * argument — never guard the call itself on the overlay being present. Gating
 * resolution on `groundContext` (a cartridge signal) is the category error that
 * left the richest surfaces grounded on nothing.
 *
 * Best-effort by construction (inherits `resolveCitableInvariants`'s fail-open
 * contract): a resolution failure yields an empty list, never a thrown turn.
 */
export async function resolveCommonConstitutionalGround(
  intentText: string,
  overlay?: Partial<GroundingContext>,
  limit: number = INVARIANT_BUDGET.currentTurn,
): Promise<CitableInvariant[]> {
  const scoped = overlay && Object.keys(overlay).length > 0 ? overlay : undefined;
  return resolveCitableInvariants(intentText, limit, scoped);
}

// ─────────────────────────────────────────────────────────────────────────
// The grounding-surface classification register (operator ruling, 2026-07-27)
//
// "The seven reasoning surfaces bypassing IRE must then be classified one by
//  one: 1. GOVERNED reasoning surfaces must route through IRE before grounding.
//  2. A deliberately UNGOVERNED or diagnostic surface may remain direct only if
//  visibly classified as such. 3. Ungoverned surfaces must be EXCLUDED from
//  constitutional claims, Research Lab evidence and EXP-P1 instrument
//  calibration."
//
// "Visibly classified" has to mean *queryable*, or the classification is prose
// and prose is not a mechanism (CFS-053 CB-1). So the classification is DATA,
// here, next to the engine it classifies — a readiness check reads it, and
// `tests/instrument-engine-briefs.test.ts` binds every entry to the real call
// sites in the tree, so an unregistered or mis-registered surface fails the
// build rather than sitting in a document.
//
// This register does NOT decide what is governed. It RECORDS the decision and
// makes the consequence (exclusion from constitutional claims) mechanical.
// ─────────────────────────────────────────────────────────────────────────

export type GroundingSurfaceClass =
  /** Routes through the IRE (`resolveConstitutionalField` / `resolveCitable…` /
   *  `resolveCommonConstitutionalGround`) before it grounds. */
  | 'ire-governed'
  /** Governed reasoning that does NOT yet route through the IRE. Honestly
   *  named rather than half-routed; EXCLUDED from constitutional claims,
   *  Research Lab evidence and EXP-P1 calibration until it routes. */
  | 'governed-unrouted'
  /** Deliberately ungoverned — diagnostic, mechanical, or non-reasoning.
   *  May ground directly, permanently, and is excluded by design. */
  | 'diagnostic';

export interface GroundingSurface {
  /** Stable id — what a readiness check and a receipt refer to. */
  id: string;
  /** The module that grounds. One surface per module that calls a ground seam. */
  file: string;
  classification: GroundingSurfaceClass;
  /** What the surface does with the ground it obtains. */
  purpose: string;
  /**
   * For anything not `ire-governed`: what routing it through the IRE would
   * require. NULL only when the surface is already governed. A blank here on
   * an ungoverned surface is how "we'll do it later" becomes "nobody knows
   * what it would take" — the canary rejects it.
   */
  routingRequires: string | null;
}

export const GROUNDING_SURFACES: GroundingSurface[] = [
  // ── Governed: resolution precedes reasoning ─────────────────────────────
  {
    id: 'codex-chat',
    file: 'app/api/codex/chat/route.ts',
    classification: 'ire-governed',
    purpose: 'Copilot turn — the common constitutional ground injected into every system prompt.',
    routingRequires: null,
  },
  {
    id: 'moneypenny-chat',
    file: 'app/api/moneypenny/chat/route.ts',
    classification: 'ire-governed',
    purpose: 'Finance copilot turn — the FS invariant library resolved per message.',
    routingRequires: null,
  },
  {
    id: 'ask-agent',
    file: 'app/api/assistant/ask-agent/route.ts',
    classification: 'ire-governed',
    purpose: 'Specialist consultation packet — invariants cited by seed id to the specialist LLM.',
    routingRequires: null,
  },
  {
    id: 'nbe-llm-rerank',
    file: 'services/orchestration/nbeLlmRerank.ts',
    classification: 'ire-governed',
    purpose: 'Next-best-experience rerank — constitutional memory the rerank reasons against.',
    routingRequires: null,
  },
  {
    id: 'render-instrumentation',
    file: 'services/constitutional/renderInstrumentation.ts',
    classification: 'ire-governed',
    purpose: 'Plan render — the constitutional block, its Reach citations, and its receipt.',
    routingRequires: null,
  },
  {
    id: 'ontology-context-pack',
    file: 'services/constitutional/ontologyResolver.ts',
    classification: 'ire-governed',
    purpose: 'ContextPack for one reasoning call (CFS-015 principle 5 — resolution precedes reasoning).',
    routingRequires: null,
  },
  {
    id: 'constitutional-service-pipeline',
    file: 'services/constitutional/constitutionalServicePipeline.ts',
    classification: 'ire-governed',
    purpose:
      'The flagship delegated-service pipeline — the evidence its executor reasons from. Until 2026-07-27 the IRE produced only a TRACE STRING here while the evidence was grounded separately: the constitutional sequence appeared in the transcript and was absent from the computation.',
    routingRequires: null,
  },

  // ── Governed, NOT routed — recorded honestly, excluded until it routes ───
  {
    id: 'compose-artifact',
    file: 'services/composition/composeArtifact.ts',
    classification: 'governed-unrouted',
    purpose: 'Composition grounding — the invariant ids an artefact claims to be true to.',
    routingRequires:
      "CompositionRequest carries no intent text — only `grounding.domains` / `ontologyClassIds`. The IRE qualifies an INTENT, so routing needs either (a) an intent/brief field on CompositionRequest.grounding, or (b) the caller resolving the field and passing it in. Both change a public type with several call sites (app/api/composition/publish, services/artifact/compositionPublish, services/video/invariantVideoBrief), so it is recorded rather than half-done.",
  },
  {
    id: 'run-artifact',
    file: 'services/artifact/runArtifact.ts',
    classification: 'governed-unrouted',
    purpose: 'Artifact-run grounding — the invariant ids recorded on the artifact record.',
    routingRequires:
      "Its PRIMARY path already prefers composition-supplied ids (`input.result.grounded.invariantIds`), so routing `compose-artifact` upgrades this surface's main path for free. Only the `live` fallback grounds directly, and it has no intent text (ArtifactCompositionInput carries a compositionRef and a CompositionResult, no brief). Route compose-artifact first; then either drop the live fallback or give it the run's intent.",
  },
];

/** One surface by id. Pure. */
export function groundingSurface(id: string): GroundingSurface | null {
  return GROUNDING_SURFACES.find((s) => s.id === id) ?? null;
}

/**
 * The surfaces whose output MAY back a constitutional claim, Research Lab
 * evidence, or EXP-P1 instrument calibration — i.e. the governed ones only.
 * Clause 3 of the ruling, expressed as a function rather than a footnote.
 */
export function constitutionallyClaimableSurfaces(): GroundingSurface[] {
  return GROUNDING_SURFACES.filter((s) => s.classification === 'ire-governed');
}

/** The complement: surfaces excluded from those three uses. Pure. */
export function excludedFromConstitutionalClaims(): GroundingSurface[] {
  return GROUNDING_SURFACES.filter((s) => s.classification !== 'ire-governed');
}

export interface InstrumentReadiness {
  /** True only when NO governed surface is still unrouted. */
  ready: boolean;
  governed: number;
  total: number;
  /** The ids blocking readiness — governed reasoning that bypasses the IRE. */
  unrouted: string[];
  reason: string;
}

/**
 * The readiness verdict, computed rather than asserted.
 *
 * "Instrument readiness remains unready until all governed surfaces satisfy the
 *  sequence. The discovery that only two of nine currently do so is not a
 *  reason to weaken the invariant; it is precisely why the readiness verdict
 *  exists." — operator ruling, 2026-07-27.
 *
 * `diagnostic` surfaces do not block: they are excluded by design, and the
 * exclusion is the point. `governed-unrouted` surfaces DO block, permanently,
 * until they route — which is what stops the classification from becoming a
 * place to park work.
 */
export function instrumentReadiness(): InstrumentReadiness {
  const unrouted = GROUNDING_SURFACES.filter((s) => s.classification === 'governed-unrouted').map(
    (s) => s.id,
  );
  const governed = constitutionallyClaimableSurfaces().length;
  return {
    ready: unrouted.length === 0,
    governed,
    total: GROUNDING_SURFACES.length,
    unrouted,
    reason:
      unrouted.length === 0
        ? `all ${governed} governed grounding surfaces route through the IRE`
        : `${unrouted.length} governed surface(s) still ground without resolution: ${unrouted.join(', ')}`,
  };
}
