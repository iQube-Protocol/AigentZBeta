/**
 * resolution — the Invariant Resolution Engine, Phase 0 (CFS-037 / PRD-IRE-001,
 * RATIFIED 2026-07-17; operator: "Go straight into p0").
 *
 * The constitutional query planner: RESOLUTION PRECEDES REASONING. Given an
 * intent, construct the minimal Resolved Constitutional Field it requires —
 * BEFORE any iQube selection, agent assembly, or LLM call. The IRE resolves;
 * the Invariant Projection Engine (CFS-035, renamed) projects. The IPE never
 * resolves a field; it consumes one produced here.
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
import { computeFieldSnapshot, type FieldSnapshot } from './engine';
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
      verifiability: { value: clamp01(item.confidence), basis: basisFor('verifiability') },
      evidenceDensity: { value: clamp01(item.standing), basis: basisFor('evidenceDensity') },
      // Reach is unbounded adoption count — squash to [0,1) transparently.
      adoption: { value: clamp01(item.reach / (item.reach + 5)), basis: basisFor('adoption') },
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
