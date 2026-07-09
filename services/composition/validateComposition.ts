/**
 * Composition validation — reuse the gate, add only the composition laws
 * (CFS-022b §6).
 *
 * Two validators, composed. `validateInterpretation` (representationResolver.ts)
 * is reused VERBATIM — the plate inherits accessibility + coherence for free.
 * `validateComposition` adds the small, genuinely-new set of composition laws,
 * fail-closed like the coherence engine ("no score without validation", Law XII
 * honesty for unevaluatable dimensions).
 *
 * The CRUCIAL law is `law.compose.no-literal`: compose-not-generate is enforced
 * STRUCTURALLY, not by good intent. A field classified RETRIEVED that carries a
 * raw literal (a hex colour, a font string, a geometry constant) with NO asset
 * reference is a compose-violation that FAILS validation. A properly composed
 * retrieved field always carries a `sourceRef` naming the asset it flowed from —
 * that ref IS the proof the value was retrieved, not generated.
 *
 * Pure + server-safe: no clock, no randomness, no DB.
 */

import { FIELD_SECTORS, STANDING_LEVELS } from '@/types/representation';
import type { InvariantEdgeRecord } from '@/types/invariants';
import { meetsStanding } from './assetResolver';
import { BEARING_TRINITY } from './canonicalAssets';
import type {
  AtlasPlateDelta,
  ComposedArtefact,
  CompositionValidationResult,
  FieldBinding,
  GroundedComponent,
  RetrievedComponent,
} from '@/types/composition';

// ─────────────────────────────────────────────────────────────────────────
// Literal detection — the structural heart of compose-not-generate
// ─────────────────────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FONT_RE = /(serif|sans-serif|monospace|ui-monospace|system-ui)/i;
const GEOMETRY_RE = /^-?\d+(\.\d+)?(px|deg|em|rem|%)?$/;

/** Does this value look like a RAW look/geometry literal (a hex, a font stack,
 *  a geometry constant) — i.e. something that MUST come from an asset, never be
 *  inlined by the engine? Colour/font/geometry are the retrieved classes. */
export function isRawLiteral(value: string): boolean {
  const v = value.trim();
  if (HEX_RE.test(v)) return true;
  if (FONT_RE.test(v)) return true;
  if (GEOMETRY_RE.test(v)) return true;
  // A font stack with a comma (e.g. "Georgia, 'Times New Roman', serif").
  if (v.includes(',') && /[a-z]/i.test(v)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// The input
// ─────────────────────────────────────────────────────────────────────────

export interface ValidateCompositionInput {
  artefact: ComposedArtefact;
  retrieved: RetrievedComponent[];
  grounded: GroundedComponent;
  delta: AtlasPlateDelta;
  /** Contradiction edges among the grounded invariants (from graph.ts). Absent
   *  ⇒ the coherence law is a recommendation, never a false pass (Law XII). */
  groundedEdges?: InvariantEdgeRecord[];
}

// ─────────────────────────────────────────────────────────────────────────
// The laws
// ─────────────────────────────────────────────────────────────────────────

type Violation = CompositionValidationResult['violations'][number];

/** law.compose.no-literal — every RETRIEVED binding references an asset, not a
 *  raw literal. The structural compose-not-generate guard. */
function lawNoLiteral(bindings: FieldBinding[], retrieved: RetrievedComponent[]): Violation[] {
  const violations: Violation[] = [];
  const knownRefs = new Set(retrieved.map((r) => r.assetRef.ref));
  for (const b of bindings) {
    if (b.class !== 'retrieved') continue;
    const backed = b.sourceRef && knownRefs.has(b.sourceRef.ref);
    if (!backed) {
      const literal = isRawLiteral(b.value);
      violations.push({
        law: 'law.compose.no-literal',
        severity: 'error',
        message: literal
          ? `retrieved field "${b.key}" carries a raw literal ("${b.value}") instead of an asset reference — compose-violation`
          : `retrieved field "${b.key}" has no registered asset reference (sourceRef missing or unknown)`,
      });
    }
  }
  return violations;
}

/** law.compose.asset-standing — every retrieved asset meets its minStanding. */
function lawAssetStanding(retrieved: RetrievedComponent[]): Violation[] {
  const violations: Violation[] = [];
  for (const r of retrieved) {
    const floor = r.assetRef.minStanding ?? 'validated';
    if (!meetsStanding(r.standing, floor)) {
      violations.push({
        law: 'law.compose.asset-standing',
        severity: 'error',
        message: `asset "${r.assetRef.ref}" standing "${r.standing}" is below required "${floor}"`,
      });
    }
  }
  return violations;
}

/**
 * The pure coherence predicate — a bundle is coherent iff no `contradicts` edge
 * exists between two of its members. Ported from `checkCoherence`
 * (services/invariants/publish.ts:53) to keep this validator PURE: the engine's
 * validator must not import the DB-coupled invariant substrate. Same logic,
 * server/node-safe, no side effects.
 */
function contradictsAmong(
  memberIds: string[],
  edges: InvariantEdgeRecord[],
): { fromInvariantId: string; toInvariantId: string }[] {
  const members = new Set(memberIds);
  return edges
    .filter(
      (e) =>
        e.edgeType === 'contradicts' &&
        members.has(e.fromInvariantId) &&
        members.has(e.toInvariantId),
    )
    .map((e) => ({ fromInvariantId: e.fromInvariantId, toInvariantId: e.toInvariantId }));
}

/** law.compose.grounded-coherent — no `contradicts` edge among grounded
 *  invariants (mirrors checkCoherence, publish.ts §5 step 3). */
function lawGroundedCoherent(
  grounded: GroundedComponent,
  edges: InvariantEdgeRecord[] | undefined,
): { violations: Violation[]; recommendations: string[] } {
  if (!edges || edges.length === 0) {
    return {
      violations: [],
      recommendations: [
        'law.compose.grounded-coherent: no grounded edges supplied — coherence unevaluated (not a pass). Supply dependency edges to enforce.',
      ],
    };
  }
  const conflicts = contradictsAmong(grounded.invariantIds, edges);
  if (conflicts.length === 0) return { violations: [], recommendations: [] };
  return {
    violations: conflicts.map((c) => ({
      law: 'law.compose.grounded-coherent',
      severity: 'error' as const,
      message: `grounded invariants contradict: ${c.fromInvariantId} ↔ ${c.toInvariantId}`,
    })),
    recommendations: [],
  };
}

/** law.compose.delta-in-taxonomy — the delta stays inside the canon taxonomy,
 *  and the grounded Trinity labels match the Bearing's canonical octants. */
function lawDeltaInTaxonomy(delta: AtlasPlateDelta, bindings: FieldBinding[]): Violation[] {
  const violations: Violation[] = [];
  if (!FIELD_SECTORS.includes(delta.activeSector)) {
    violations.push({
      law: 'law.compose.delta-in-taxonomy',
      severity: 'error',
      message: `activeSector "${delta.activeSector}" is not a canonical field sector`,
    });
  }
  if (!STANDING_LEVELS.includes(delta.standing)) {
    violations.push({
      law: 'law.compose.delta-in-taxonomy',
      severity: 'error',
      message: `standing "${delta.standing}" is not a canonical standing level`,
    });
  }
  for (const s of delta.relatedSectors ?? []) {
    if (!FIELD_SECTORS.includes(s)) {
      violations.push({
        law: 'law.compose.delta-in-taxonomy',
        severity: 'error',
        message: `relatedSector "${s}" is not a canonical field sector`,
      });
    }
  }
  // Trinity grounded label integrity: if the artefact records the trinity, it
  // must equal the Bearing's canonical octants (retrieved, never re-labelled).
  const trinityBinding = bindings.find((b) => b.key === 'field-taxonomy.trinity');
  if (trinityBinding && trinityBinding.value !== BEARING_TRINITY.join(',')) {
    violations.push({
      law: 'law.compose.delta-in-taxonomy',
      severity: 'error',
      message: `trinity labels "${trinityBinding.value}" do not match the canonical Bearing octants "${BEARING_TRINITY.join(',')}"`,
    });
  }
  return violations;
}

/** law.compose.decomposable — the result decomposes back into retrieved ∪
 *  grounded ∪ generated with every artefact field covered. */
function lawDecomposable(bindings: FieldBinding[]): Violation[] {
  const violations: Violation[] = [];
  const classes = new Set(bindings.map((b) => b.class));
  if (!classes.has('retrieved')) {
    violations.push({
      law: 'law.compose.decomposable',
      severity: 'error',
      message: 'no retrieved components — a composed artefact must retrieve at least one canonical asset',
    });
  }
  if (!classes.has('generated')) {
    violations.push({
      law: 'law.compose.decomposable',
      severity: 'error',
      message: 'no generated delta — a composition with nothing novel is not a composition',
    });
  }
  for (const b of bindings) {
    if (!b.key || typeof b.value !== 'string') {
      violations.push({
        law: 'law.compose.decomposable',
        severity: 'error',
        message: 'a binding is missing a key or value — the decomposition does not round-trip',
      });
    }
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────────────────
// The composed validator
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validate a composition against the composition laws (CFS-022b §6). Fail-closed:
 * any `error` violation ⇒ `pass:false`. Unevaluatable dimensions return
 * recommendations, never a fabricated pass (Law XII honesty).
 */
export function validateComposition(input: ValidateCompositionInput): CompositionValidationResult {
  const { artefact, retrieved, grounded, delta, groundedEdges } = input;
  const violations: Violation[] = [];
  const recommendations: string[] = [];

  violations.push(...lawNoLiteral(artefact.bindings, retrieved));
  violations.push(...lawAssetStanding(retrieved));

  const coherent = lawGroundedCoherent(grounded, groundedEdges);
  violations.push(...coherent.violations);
  recommendations.push(...coherent.recommendations);

  violations.push(...lawDeltaInTaxonomy(delta, artefact.bindings));
  violations.push(...lawDecomposable(artefact.bindings));

  // law.compose.sequence — recommend-only in v1 (unevaluated, never a false pass).
  recommendations.push(
    'law.compose.sequence: field-arrangement sequence not evaluated in v1 — arrangement accepted as delta.',
  );

  const pass = violations.every((v) => v.severity !== 'error');
  return { pass, violations, recommendations };
}
