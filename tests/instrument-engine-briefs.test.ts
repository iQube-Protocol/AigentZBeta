/**
 * Canaries for the three research instruments — IDE · IRE · IPE.
 *
 * These enforce the invariants recorded in the three Constitutional Capability
 * Briefs authored 2026-07-27:
 *   codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-discovery-engine.md
 *   codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-resolution-engine.md
 *   codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-projection-engine.md
 *
 * SCOPE DISCIPLINE. This file began as a read-only audit pass, which is why
 * most assertions either (a) pin a property the code already had, or (b) pin
 * the SUBSTRATE AUTHORITY that a recorded violation turns on. The two live
 * violations of that pass — IRE-6's clamp and IPE-4's divergence signal — were
 * deliberately left uncanaried then, because a canary asserting the current
 * behaviour would have made the defect harder to fix.
 *
 * BOTH ARE NOW FIXED AND CANARIED (operator ruling, 2026-07-27: "This is a
 * units defect, not an experimental alternative. It should be corrected before
 * any further EXP-P1 Stage 0 run."). The IRE-6 block below now pins the
 * conversion behaviourally; the IPE-4 block pins that an unmatched slice cannot
 * report agreement. Nothing here pins a defect as though it were correct.
 *
 * CB-5 (CFS-053): every assertion here was mutation-tested — the mutation and
 * the failure it produced are recorded in the pass report. Assertions are
 * about behaviour wherever a pure function exists to call; where a property is
 * genuinely source-level (an import's type-only-ness, a route's receipt call)
 * the check goes through `stripComments` / `importAuthority` so a doc comment
 * naming the forbidden symbol cannot produce a false red or a false green.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

import { computeRecurrence, type EvidenceRow } from '@/services/invariants/discoveryEngine';
import {
  calibrateStructural,
  constitutionallyClaimableSurfaces,
  excludedFromConstitutionalClaims,
  formatCitableInvariantsBlock,
  groundingSurface,
  instrumentReadiness,
  normaliseReach,
  normaliseStanding,
  resolveCitableInvariants,
  GROUNDING_SURFACES,
  type GroundingSurfaceClass,
} from '@/services/invariants/resolution';
import { basisFor } from '@/services/invariants/coordinates';
import {
  deriveFromCoordinates,
  deriveFromStanding,
  deriveWeightsFromStanding,
  deriveWeightsFromCoordinates,
  type FieldSnapshot,
} from '@/services/invariants/engine';
import {
  CALIBRATION,
  compareProjection,
  describeProjection,
} from '@/services/invariants/projectionBridge';
import { isNodeAuthoritative } from '@/services/invariants/flipStore';
import type { ResolvedConstitutionalField } from '@/services/invariants/resolution';

// ───────────────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────────────

const evidence = (id: string, domain: string): EvidenceRow => ({
  id,
  domain,
  subDomain: null,
  title: `doc ${id}`,
  sourceKind: 'regulation',
  content: 'x',
  sourceRef: `ref-${id}`,
  createdAt: '2026-07-27T00:00:00.000Z',
});

type Dim = 'importance' | 'novelty' | 'trust' | 'need';
const SEED_MAP: Record<Dim, string> = {
  importance: 'inv.a',
  novelty: 'inv.b',
  trust: 'inv.c',
  need: 'inv.d',
};

/** A minimal FieldSnapshot carrying the four governing seeds at given standings. */
function snapshotWithStandings(standings: Record<Dim, number>): FieldSnapshot {
  const items = (Object.keys(SEED_MAP) as Dim[]).map((k, i) => ({
    id: `id-${i}`,
    seedId: SEED_MAP[k],
    statement: `statement ${k}`,
    standing: standings[k],
    reach: 0,
    confidence: 0.5,
  }));
  return {
    stampedAt: null,
    context: {},
    slice: { items, citedIds: items.map((i) => i.id), generatedAt: null },
    citedIds: items.map((i) => i.id),
  } as unknown as FieldSnapshot;
}

/** Coordinates carrying the given value on the evidenceDensity axis. */
function coordinatesWith(values: Record<Dim, number>) {
  return (Object.keys(SEED_MAP) as Dim[]).map((k) => ({
    seedId: SEED_MAP[k],
    structural: {
      verifiability: { value: 0 },
      evidenceDensity: { value: values[k] },
      adoption: { value: 0 },
    },
  }));
}

const ALL_ONE: Record<Dim, number> = { importance: 1, novelty: 1, trust: 1, need: 1 };

// ───────────────────────────────────────────────────────────────────────────
// IDE-5 — support signals are DERIVED from evidence, never stored
// ───────────────────────────────────────────────────────────────────────────

describe('IDE-5 — cross-domain recurrence is derived from evidence, never a stored score', () => {
  it('counts DISTINCT observed domains, and a stale evidence reference cannot inflate it', () => {
    const rows = [evidence('e1', 'financial-services'), evidence('e2', 'financial-services')];
    const r = computeRecurrence(['e1', 'e2', 'e-does-not-exist'], rows);
    expect(r.observedDomains).toEqual(['financial-services']);
    expect(r.recurrenceCount).toBe(1);
    expect(r.tier).toBe('single-domain');
  });

  it('a single observed domain MECHANICALLY caps classification and abstraction (Amendment D §D.4a)', () => {
    // The floor is not a matter of reviewer judgement: one domain is
    // `specialized`, never universal, and caps the ladder at L3.
    const one = computeRecurrence(['e1'], [evidence('e1', 'financial-services')]);
    expect(one.classificationFloor).toBe('specialized');
    expect(one.maxAbstractionLevel).toBe('L3');

    const two = computeRecurrence(
      ['e1', 'e2'],
      [evidence('e1', 'financial-services'), evidence('e2', 'human-mobility-services')],
    );
    expect(two.recurrenceCount).toBe(2);
    expect(two.classificationFloor).toBe('supported');
    expect(two.maxAbstractionLevel).toBe('L4');
  });

  it('recomputes from the evidence it is handed — the same candidate ids yield a DIFFERENT answer when the evidence changes', () => {
    // This is the property that makes it a query rather than a field: nothing
    // is memoised against the candidate, so reclassifying evidence changes the
    // answer immediately (inv.engineering.036).
    const ids = ['e1', 'e2'];
    const before = computeRecurrence(ids, [
      evidence('e1', 'financial-services'),
      evidence('e2', 'financial-services'),
    ]);
    const after = computeRecurrence(ids, [
      evidence('e1', 'financial-services'),
      evidence('e2', 'media'),
    ]);
    expect(before.recurrenceCount).toBe(1);
    expect(after.recurrenceCount).toBe(2);
    expect(before.classificationFloor).not.toBe(after.classificationFloor);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IRE-4 — resolution never fabricates
// ───────────────────────────────────────────────────────────────────────────

describe('IRE-4 — an empty resolution yields an empty block, never an invented one', () => {
  it('formats nothing as the empty string — no header, no scaffold', () => {
    expect(formatCitableInvariantsBlock([])).toBe('');
  });

  it('formats a real resolution as a block naming every seed id and statement', () => {
    const block = formatCitableInvariantsBlock([
      { seedId: 'inv.reasoning.334', statement: 'discovery is not generation' },
      { seedId: 'inv.reasoning.335', statement: 'evidence precedes provenance' },
    ]);
    expect(block).toContain('[inv.reasoning.334] discovery is not generation');
    expect(block).toContain('[inv.reasoning.335] evidence precedes provenance');
    // The block must be citable — it instructs the model to cite by seed id.
    expect(block).toMatch(/cite by seed id/i);
  });

  it('a blank intent resolves to nothing without reaching the substrate', async () => {
    await expect(resolveCitableInvariants('')).resolves.toEqual([]);
    await expect(resolveCitableInvariants('   \n  ')).resolves.toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IRE-5 — every coordinate carries its basis; what needs an actor is null
// ───────────────────────────────────────────────────────────────────────────

describe('IRE-5 — a coordinate carries its basis, and an actor-dependent coordinate is null', () => {
  const calibrated = calibrateStructural({
    id: 'id-1',
    seedId: 'inv.reasoning.334',
    confidence: 0.62,
    standing: 40,
    reach: 10,
  });

  it('constitutional-class coordinates are NULL, never estimated', () => {
    // authority / consent / delegability need actor context the engine does not
    // have. A zero, a default, or an empty object would all read as a measured
    // value; null is the only honest answer.
    expect(calibrated.constitutional).toBeNull();
  });

  it('every structural coordinate carries a non-empty basis string', () => {
    for (const [axis, coord] of Object.entries(calibrated.structural)) {
      expect(typeof coord.value, `${axis} has no numeric value`).toBe('number');
      expect(coord.basis.trim().length, `${axis} carries no basis`).toBeGreaterThan(0);
    }
  });

  it('the basis comes from the Constitutional Coordinates Registry, not an inline literal', () => {
    // A hardcoded basis string would be a second source of truth for a
    // provenance statement CFS-038 already owns.
    expect(calibrated.structural.verifiability.basis).toBe(basisFor('verifiability'));
    expect(calibrated.structural.evidenceDensity.basis).toBe(basisFor('evidenceDensity'));
    expect(calibrated.structural.adoption.basis).toBe(basisFor('adoption'));
    // Guard the guard: an unregistered key yields 'unregistered', so the three
    // above are only meaningful if they are registered.
    expect(basisFor('verifiability')).not.toBe('unregistered');
    expect(basisFor('evidenceDensity')).not.toBe('unregistered');
    expect(basisFor('adoption')).not.toBe('unregistered');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IRE-6 (substrate authority half) — the ranges a calibration must convert
// ───────────────────────────────────────────────────────────────────────────

describe('IRE-6 — the substrate axes a [0,1] calibration must CONVERT, not clamp', () => {
  // The violation this block recorded was CORRECTED on 2026-07-27 (operator
  // ruling: "This is a units defect, not an experimental alternative"). The
  // substrate-authority assertions below are unchanged — they are still the
  // authority the conversion is checked against — and the behavioural
  // assertions that pin the conversion itself now live alongside them.

  it('standing converts proportionally at the boundaries: 0 → 0, 50 → 0.5, 100 → 1', () => {
    expect(normaliseStanding(0)).toBe(0);
    expect(normaliseStanding(50)).toBeCloseTo(0.5, 12);
    expect(normaliseStanding(100)).toBe(1);
    // Out-of-range inputs still clamp — conversion first, clamp as a guard.
    expect(normaliseStanding(-10)).toBe(0);
    expect(normaliseStanding(140)).toBe(1);
  });

  it('standings above 1 DO NOT all collapse to 1 — the whole defect, stated as a test', () => {
    // `clamp01(standing)` mapped every invariant with standing >= 1 to exactly
    // 1.0, so the coordinate axis was FLAT where the standing axis is
    // proportional. Distinctness is the property; the exact values are pinned
    // above. A monotone, strictly-increasing, non-saturating map is required.
    const standings = [1, 5, 12.5, 40, 62.5, 88, 99.9];
    const values = standings.map(normaliseStanding);
    expect(new Set(values).size, 'two distinct standings produced the same coordinate').toBe(
      standings.length,
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `standing ${standings[i]} did not exceed ${standings[i - 1]}`).toBeGreaterThan(
        values[i - 1],
      );
    }
    // And none of the interior points may sit at the ceiling.
    for (const v of values.slice(0, -1)) expect(v).toBeLessThan(1);
  });

  it('the coordinate is PROPORTIONAL to standing, so the two projection paths can agree', () => {
    // projectionBridge + engine both claim the coordinate axis IS the standing
    // axis. That claim is only true if the conversion is linear: a ratio
    // between two standings must survive into the coordinates, or the
    // mean-normalised weights the two paths produce cannot match.
    expect(normaliseStanding(40) / normaliseStanding(10)).toBeCloseTo(40 / 10, 12);
    expect(normaliseStanding(75) / normaliseStanding(25)).toBeCloseTo(3, 12);
  });

  it('reach converts on the SAME 0-100 scale — it is not an unbounded count', () => {
    // The old form was `reach / (reach + 5)`, justified by a comment calling
    // reach "unbounded adoption count". computeReachScore already saturates it
    // into 0-100, so that form saturated an already-saturated value.
    expect(normaliseReach(0)).toBe(0);
    expect(normaliseReach(50)).toBeCloseTo(0.5, 12);
    expect(normaliseReach(100)).toBe(1);
    // The discriminator against the old squash: it returned 0.909 for reach 50.
    expect(normaliseReach(50)).not.toBeCloseTo(50 / 55, 3);
  });

  it('calibrateStructural applies the conversions — not just declares them', () => {
    // CB-7: a named helper that exists but is not called is the defect this
    // whole ruling is about. Assert the CALL through its observable effect.
    const c = calibrateStructural({
      id: 'id-1',
      seedId: 'inv.reasoning.334',
      confidence: 0.62,
      standing: 40,
      reach: 25,
    });
    expect(c.structural.evidenceDensity.value).toBeCloseTo(0.4, 12);
    expect(c.structural.adoption.value).toBeCloseTo(0.25, 12);
    // confidence is genuinely a unit interval — it passes through unscaled.
    expect(c.structural.verifiability.value).toBeCloseTo(0.62, 12);
  });

  it('the coordinate registry BASIS names the conversion, not merely the column', () => {
    // `basis: 'derived:standing'` is what let a bare clamp pass as a
    // conversion: the provenance string was true of both the correct and the
    // defective implementation, so it could not discriminate.
    expect(basisFor('evidenceDensity')).toContain('/100');
    expect(basisFor('adoption')).toContain('/100');
    expect(basisFor('adoption')).not.toContain('reach+5');
  });

  it('standing and reach are 0-100 scores, enforced by the database', () => {
    // This is the authority the IRE brief's IRE-6 violation turns on. It is
    // pinned here so that any future coordinate calibration has one place to
    // check itself against, and so that a silent widening of the substrate
    // range cannot make the recorded finding unverifiable.
    const substrate = stripComments(
      readSource('supabase/migrations/20260703200000_invariant_substrate.sql'),
    );
    expect(substrate).toMatch(/standing\s+numeric\(5,1\)[\s\S]{0,120}?CHECK\s*\(standing >= 0 AND standing <= 100\)/);

    const lawXii = stripComments(
      readSource('supabase/migrations/20260703230000_law_xii_truth_standing_reach.sql'),
    );
    expect(lawXii).toMatch(/reach\s+numeric\(5,1\)[\s\S]{0,120}?CHECK\s*\(reach >= 0 AND reach <= 100\)/);
  });

  it('confidence, by contrast, IS a unit-interval value — so only it may be clamped', () => {
    const substrate = stripComments(
      readSource('supabase/migrations/20260703200000_invariant_substrate.sql'),
    );
    expect(substrate).toMatch(/confidence\s+numeric\(4,3\)[\s\S]{0,120}?CHECK\s*\(confidence >= 0 AND confidence <= 1\)/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IRE-7 — the engine observes; it never writes
// ───────────────────────────────────────────────────────────────────────────

describe('IRE-7 — resolution is read-only', () => {
  it('the resolution module contains no write to the substrate', () => {
    const src = stripComments(readSource('services/invariants/resolution.ts'));
    for (const write of ['.insert(', '.update(', '.upsert(', '.delete(']) {
      expect(src, `resolution.ts performs a ${write} — the IRE must not write`).not.toContain(write);
    }
  });

  it('it binds no Supabase client and no receipt writer', () => {
    const authority = importAuthority(readSource('services/invariants/resolution.ts'));
    const specifiers = [
      ...authority.records.map((r) => r.specifier),
      ...authority.dynamicSpecifiers,
      ...authority.requireSpecifiers,
    ];
    for (const spec of specifiers) {
      expect(spec, `resolution.ts imports ${spec}`).not.toMatch(/supabase/i);
      expect(spec, `resolution.ts imports ${spec}`).not.toMatch(/receipt/i);
    }
    // Guard the guard: the module really does import something.
    expect(specifiers.length).toBeGreaterThan(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IPE-1 (bridge half) — the projector consumes a field, it never resolves one
// ───────────────────────────────────────────────────────────────────────────

describe('IPE-1 — the IRE→IPE bridge consumes a resolved field and constructs none', () => {
  const bridgeSrc = readSource('services/invariants/projectionBridge.ts');

  it('imports the resolver as a TYPE only — it can name a field but cannot build one', () => {
    const code = stripComments(bridgeSrc);
    expect(
      code,
      "projectionBridge.ts must import './resolution' with `import type` — a value import would let the projector resolve its own field",
    ).toMatch(/import\s+type\s*\{[^}]*ResolvedConstitutionalField[^}]*\}\s*from\s*'\.\/resolution'/);
    // And nothing else may come from the resolver at all.
    // `[^;]` keeps the match inside ONE import statement — a `[\s\S]*?` would
    // span from an earlier import and swallow the type keyword being checked.
    const resolutionImports = [...code.matchAll(/^\s*import\s+([^;]*?)\s*from\s*'\.\/resolution'/gm)].map(
      (m) => m[1],
    );
    expect(resolutionImports.length, 'no import from ./resolution parsed').toBe(1);
    expect(resolutionImports[0]).toMatch(/^\s*type\s/);
  });

  it('binds nothing that could read the substrate', () => {
    const authority = importAuthority(bridgeSrc);
    const specifiers = [
      ...authority.records.map((r) => r.specifier),
      ...authority.dynamicSpecifiers,
      ...authority.requireSpecifiers,
    ];
    expect(specifiers.sort()).toEqual(['./engine', './resolution']);
  });

  it('projects a field it was handed, synchronously and purely', () => {
    // A function that resolved anything would have to be async or hit a client.
    // Both derivations run over the SAME object the caller supplied.
    const field = {
      snapshot: snapshotWithStandings({ importance: 10, novelty: 10, trust: 10, need: 10 }),
      coordinates: coordinatesWith({ importance: 1, novelty: 1, trust: 1, need: 1 }),
    } as unknown as ResolvedConstitutionalField;
    const cmp = compareProjection(field, SEED_MAP);
    expect(cmp.standing).toEqual(ALL_ONE);
    expect(cmp.coordinates).toEqual(ALL_ONE);
    expect(cmp.meanAbsDelta).toBe(0);
    expect(cmp.diverges).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IPE-2 — absent inputs project faithfully; the two derivations are ONE formula
// ───────────────────────────────────────────────────────────────────────────

describe('IPE-2 — an absent or unearned input projects faithfully (all-1)', () => {
  it('the standing derivation is faithful with no snapshot, and with no earned standing', () => {
    expect(deriveWeightsFromStanding(null, SEED_MAP)).toEqual(ALL_ONE);
    expect(deriveWeightsFromStanding(undefined, SEED_MAP)).toEqual(ALL_ONE);
    expect(
      deriveWeightsFromStanding(
        snapshotWithStandings({ importance: 0, novelty: 0, trust: 0, need: 0 }),
        SEED_MAP,
      ),
    ).toEqual(ALL_ONE);
  });

  it('the coordinate derivation is faithful with null, empty, and all-zero coordinates', () => {
    expect(deriveWeightsFromCoordinates(null, SEED_MAP)).toEqual(ALL_ONE);
    expect(deriveWeightsFromCoordinates([], SEED_MAP)).toEqual(ALL_ONE);
    expect(
      deriveWeightsFromCoordinates(
        coordinatesWith({ importance: 0, novelty: 0, trust: 0, need: 0 }),
        SEED_MAP,
      ),
    ).toEqual(ALL_ONE);
  });

  it('faithful is a real BRANCH, not the only behaviour — unequal input re-balances', () => {
    // Without this the three assertions above would pass on a function that
    // returned all-1 unconditionally, which is the vacuous-canary shape.
    const w = deriveWeightsFromStanding(
      snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 }),
      SEED_MAP,
    );
    expect(w).not.toEqual(ALL_ONE);
    // Mean-normalised to 1: the weights sum to the number of dimensions.
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(4, 10);
    expect(w.importance).toBeGreaterThan(w.trust);
    expect(w.trust).toBeGreaterThan(w.novelty);
  });

  it('the two derivations are ONE formula — identical numbers in, identical weights out', () => {
    // This is the property the bridge's agreement claim actually rests on. It
    // holds for the FORMULAS; whether the two INPUTS are in the same units is a
    // separate question, and the answer today is no (IRE-6 / IPE-4). Pinning
    // the formula equivalence here means any future divergence must come from
    // the inputs, which is where the finding lives.
    const values: Record<Dim, number> = { importance: 40, novelty: 10, trust: 20, need: 10 };
    const byStanding = deriveWeightsFromStanding(snapshotWithStandings(values), SEED_MAP);
    const byCoordinates = deriveWeightsFromCoordinates(coordinatesWith(values), SEED_MAP);
    expect(byCoordinates).toEqual(byStanding);
  });

  it('a dimension whose governing invariant is absent from the input contributes nothing', () => {
    // The mirror-image inertness in IPE-4: when the resolved slice contains
    // none of the governing seeds, BOTH paths fall back to all-1 — see the
    // IPE-4 block below for why that must not read as agreement.
    const foreign = snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 });
    const unrelated = { importance: 'inv.x', novelty: 'inv.y', trust: 'inv.z', need: 'inv.w' };
    expect(deriveWeightsFromStanding(foreign, unrelated)).toEqual(ALL_ONE);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IPE-4 — a faithful default is not a measurement, and must never read as one
// ───────────────────────────────────────────────────────────────────────────

describe('IPE-4 — an unmatched or empty slice cannot report agreement nobody computed', () => {
  /** A field whose slice + coordinates contain NONE of the node's governing
   *  seeds — the live case when an intent-scoped resolution misses the node. */
  const unmatchedField = {
    snapshot: snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 }),
    coordinates: coordinatesWith({ importance: 0.4, novelty: 0.1, trust: 0.2, need: 0.1 }),
  } as unknown as ResolvedConstitutionalField;
  const FOREIGN_SEEDS: Record<Dim, string> = {
    importance: 'inv.x',
    novelty: 'inv.y',
    trust: 'inv.z',
    need: 'inv.w',
  };

  it('both paths default to all-1 — and the comparison refuses to call that agreement', () => {
    const cmp = compareProjection(unmatchedField, FOREIGN_SEEDS);
    // The numbers are identical…
    expect(cmp.standing).toEqual(ALL_ONE);
    expect(cmp.coordinates).toEqual(ALL_ONE);
    expect(cmp.meanAbsDelta).toBe(0);
    expect(cmp.diverges).toBe(false);
    // …and that is precisely why `diverges: false` may not be read alone.
    expect(cmp.comparable, 'two faithful defaults were reported as a comparison').toBe(false);
    expect(cmp.matched).toEqual({ standing: 0, coordinates: 0 });
  });

  it('an EMPTY field is likewise incomparable, not agreeing', () => {
    const empty = { snapshot: null, coordinates: [] } as unknown as ResolvedConstitutionalField;
    const cmp = compareProjection(empty, SEED_MAP);
    expect(cmp.diverges).toBe(false);
    expect(cmp.comparable).toBe(false);
  });

  it('ONE path defaulting is enough to make the comparison incomparable', () => {
    // The asymmetric case is the sneaky one: the standing path engages, the
    // coordinate path does not, meanAbsDelta is non-zero, and `diverges` fires
    // — a "divergence" produced entirely by one side having no input.
    const half = {
      snapshot: snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 }),
      coordinates: [],
    } as unknown as ResolvedConstitutionalField;
    const cmp = compareProjection(half, SEED_MAP);
    expect(cmp.diverges).toBe(true);
    expect(cmp.comparable, 'a one-sided default was reported as a real divergence').toBe(false);
    expect(cmp.matched.standing).toBeGreaterThan(0);
    expect(cmp.matched.coordinates).toBe(0);
  });

  it('comparable is a real BRANCH — a genuinely matched field reports true', () => {
    // Without this the three assertions above would pass on a `comparable`
    // that was hardcoded false. This is defect 7's lesson (a canary that
    // survives its own mutation) applied to the field being added here.
    const matchedField = {
      snapshot: snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 }),
      coordinates: coordinatesWith({ importance: 0.4, novelty: 0.1, trust: 0.2, need: 0.1 }),
    } as unknown as ResolvedConstitutionalField;
    const cmp = compareProjection(matchedField, SEED_MAP);
    expect(cmp.comparable).toBe(true);
    expect(cmp.matched).toEqual({ standing: 4, coordinates: 4 });
    // And the units fix is what makes these two agree: standing 40/10/20/10 and
    // coordinates 0.40/0.10/0.20/0.10 are the SAME field in the two scales.
    expect(cmp.diverges).toBe(false);
    expect(cmp.meanAbsDelta).toBeCloseTo(0, 12);
  });

  it('the trace line never prints "agrees" for an incomparable projection', () => {
    // The trace is what a reader — and an IPV result file — actually sees.
    const cmp = compareProjection(unmatchedField, FOREIGN_SEEDS);
    const line = describeProjection(cmp);
    expect(line).toMatch(/NOT COMPARABLE/);
    expect(line).not.toMatch(/\bagrees\b/);
    // Guard the guard: the same function DOES say "agrees" when it should.
    const matchedField = {
      snapshot: snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 }),
      coordinates: coordinatesWith({ importance: 0.4, novelty: 0.1, trust: 0.2, need: 0.1 }),
    } as unknown as ResolvedConstitutionalField;
    expect(describeProjection(compareProjection(matchedField, SEED_MAP))).toMatch(/\bagrees\b/);
  });

  it('every projection carries the calibration convention it was computed under', () => {
    // A stored Stage-0 result must not be silently comparable across a units
    // change. The stamp is what makes "pre-fix vs post-fix" checkable rather
    // than a matter of remembering when a run happened.
    const cmp = compareProjection(unmatchedField, SEED_MAP);
    expect(cmp.calibration).toBe(CALIBRATION);
    expect(CALIBRATION).toMatch(/^coordinates\/v\d/);
    expect(describeProjection(cmp)).toContain(CALIBRATION);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IPE-5 — authority is opt-in; the default is faithful; the flip is receipted
// ───────────────────────────────────────────────────────────────────────────

describe('IPE-5 — a node is not authoritative unless something says so', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('fails FAITHFUL when the substrate is unreachable, never authoritative', async () => {
    // The direction of the default is the whole safety property: an unreachable
    // flip store must serve the incumbent, not the projection.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    await expect(isNodeAuthoritative('discovery.ranking')).resolves.toBe(false);
    await expect(isNodeAuthoritative('nbe.ranking')).resolves.toBe(false);
    await expect(isNodeAuthoritative('no-such-node')).resolves.toBe(false);
  });

  it('the flip act emits an attributable receipt carrying a commitment, not a raw persona id', () => {
    // Source-level (tier 3): driving the route needs the spine. Read through
    // stripComments so the route header's own description of the boundary
    // cannot satisfy or break the check.
    const route = stripComments(readSource('app/api/invariants/flip/route.ts'));
    expect(route).toContain('createActivityReceipt(');
    expect(route).toMatch(/actionType:\s*'invariant_node_flipped'/);
    // A sha256 commitment of the flip act rides the summary.
    expect(route).toMatch(/createHash\('sha256'\)/);
    expect(route).toMatch(/commit:\$\{commitment/);
    // The client-safe flip projection never carries the T0 audit field.
    const store = stripComments(readSource('services/invariants/flipStore.ts'));
    expect(store).not.toMatch(/flippedByPersona/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CFS-039 / IPE-1 (engine half) — the projector cannot resolve its own field
//
// The bridge half of IPE-1 (above) was already clean. But CFS-039 designates
// `engine.ts` as the IPE, and until 2026-07-27 `engine.ts` exported
// computeFieldSnapshot / groundReasoning / getCachedFieldSnapshot — so every
// Invariant Decision Node weighted from a field the projector had resolved for
// ITSELF, while the comment on deriveWeightsFromCoordinates asserted the
// opposite. Reading "the IPE never resolves a field" as a claim about
// projectionBridge alone would have been a redefinition, not a fix.
// ───────────────────────────────────────────────────────────────────────────

describe('IPE-1 (engine half) — engine.ts consumes a field and can construct none', () => {
  const engineSrc = readSource('services/invariants/engine.ts');

  it('imports the Field Snapshot as a TYPE only — it can name a field, not build one', () => {
    const code = stripComments(engineSrc);
    expect(
      code,
      "engine.ts must import './grounding' with `import type` — a value import restores the ability to resolve",
    ).toMatch(/import\s+type\s*\{[^}]*FieldSnapshot[^}]*\}\s*from\s*'\.\/grounding'/);
    // And nothing else may come from the grounding module at all: one import
    // statement, and it must be type-only. `[^;]` keeps the match inside ONE
    // statement so an earlier import cannot lend it the `type` keyword.
    const groundingImports = [...code.matchAll(/^\s*import\s+([^;]*?)\s*from\s*'\.\/grounding'/gm)].map(
      (m) => m[1],
    );
    expect(groundingImports.length, 'no import from ./grounding parsed').toBe(1);
    expect(groundingImports[0]).toMatch(/^\s*type\s/);
  });

  it('binds nothing that could read the substrate', () => {
    const authority = importAuthority(engineSrc);
    const specifiers = [
      ...authority.records.map((r) => r.specifier),
      ...authority.dynamicSpecifiers,
      ...authority.requireSpecifiers,
    ];
    // observationStore is the shadow-loop's write-behind; grounding is type-only.
    expect(specifiers.sort()).toEqual(['./grounding', './observationStore']);
    // A dynamic import is the obvious way to smuggle resolution back in past a
    // static-import check. There must be none.
    expect(authority.dynamicSpecifiers).toEqual([]);
    expect(authority.requireSpecifiers).toEqual([]);
  });

  it('names no field-construction call ANYWHERE in its body', () => {
    // Import authority proves it cannot bind the constructors; this proves it
    // does not call them by some other route (a re-export, a global, a
    // reintroduced local copy). Comments are stripped, so this module's own
    // header — which NAMES all three functions to explain why they left — can
    // neither satisfy nor break the check.
    const code = stripComments(engineSrc);
    for (const ctor of ['computeFieldSnapshot(', 'buildInvariantSlice(', 'groundReasoning(', 'getCachedFieldSnapshot(']) {
      expect(code, `engine.ts (the IPE) calls ${ctor} — it is resolving its own field`).not.toContain(
        ctor,
      );
    }
  });

  it('has NO self-resolving fallback: an absent field is refused, never fetched', () => {
    // The forbidden implementation is "accept an injected field, resolve one
    // when it is absent". Such a fallback would have to be ASYNC — resolution
    // is DB-backed. Both derivations are synchronous, so the fallback cannot
    // exist inside them; and what they return for an absent field is a
    // FAITHFUL default that reports itself as such.
    const absent = deriveFromStanding(null, SEED_MAP);
    expect(absent, 'a derivation returned a Promise — it went and fetched something').not.toBeInstanceOf(
      Promise,
    );
    expect(absent.weights).toEqual(ALL_ONE);
    expect(absent.engaged, 'an absent field was reported as an engaged measurement').toBe(false);
    expect(absent.matched).toBe(0);

    const absentCoords = deriveFromCoordinates(null, SEED_MAP);
    expect(absentCoords).not.toBeInstanceOf(Promise);
    expect(absentCoords.engaged).toBe(false);

    // Guard the guard: `engaged` is a real branch, not a constant false.
    expect(
      deriveFromStanding(snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 }), SEED_MAP)
        .engaged,
    ).toBe(true);
  });

  it('the field constructors really do live in the resolution layer now', () => {
    // Guard the guard: the four assertions above would all pass on an engine
    // whose constructors had simply been DELETED. They must exist upstream.
    const grounding = stripComments(readSource('services/invariants/grounding.ts'));
    expect(grounding).toMatch(/export async function computeFieldSnapshot\(/);
    expect(grounding).toMatch(/export async function groundReasoning\(/);
    expect(grounding).toMatch(/export async function getCachedFieldSnapshot\(/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// IRE-8 — every grounding surface is classified, and the classification is
// bound to the real call sites rather than to a document
// ───────────────────────────────────────────────────────────────────────────

/**
 * Files that mention `needle` in CODE (comments stripped), found by `git grep`
 * rather than by walking the tree — same helper shape as
 * tests/governance-ratification.test.ts, which is the one home for this idiom.
 */
function filesCalling(needle: string): string[] {
  let hits: string[];
  try {
    hits = execFileSync(
      'git',
      [
        'grep', '-l', '--untracked', '--exclude-standard', '--fixed-strings', needle,
        '--', 'app', 'services', 'components', 'lib', 'utils',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
  } catch {
    return []; // git grep exits 1 on no match
  }
  return hits.filter((f) => {
    if (!/\.(ts|tsx)$/.test(f)) return false;
    try {
      return stripComments(readSource(f)).includes(needle);
    } catch {
      return true;
    }
  });
}

/** The IRE entrypoints. A surface routes through the IRE iff it calls one. */
const IRE_ENTRYPOINTS = [
  'resolveConstitutionalField(',
  'resolveCitableInvariants(',
  'resolveCommonConstitutionalGround(',
];

describe('IRE-8 — governed reasoning routes through the IRE; anything else is visibly classified', () => {
  it('the register is non-empty and every entry is well-formed', () => {
    // Vacuity guard: emptying the register must not turn every check below
    // into a pass over zero rows (CFS-053 M9's shape).
    expect(GROUNDING_SURFACES.length).toBeGreaterThanOrEqual(9);
    const ids = GROUNDING_SURFACES.map((s) => s.id);
    expect(new Set(ids).size, 'duplicate surface id').toBe(ids.length);
    for (const s of GROUNDING_SURFACES) {
      expect(s.purpose.trim().length, `${s.id} has no stated purpose`).toBeGreaterThan(20);
      expect(existsSync(join(process.cwd(), s.file)), `${s.id} names a file that does not exist: ${s.file}`).toBe(
        true,
      );
    }
  });

  it('EVERY module that grounds directly is registered — no unclassified surface', () => {
    // This is the binding (CB-1). The register cannot drift away from the tree:
    // a new surface that calls the raw seam without registering fails here,
    // which is the whole difference between a classification and a claim.
    const registered = new Set(GROUNDING_SURFACES.map((s) => s.file));
    const direct = filesCalling('groundReasoning(').filter(
      (f) => !f.startsWith('services/invariants/'), // the seam's own module + re-exports
    );
    for (const f of direct) {
      expect(registered.has(f), `${f} grounds directly but is not classified in GROUNDING_SURFACES`).toBe(
        true,
      );
    }
    // Guard the guard: the scan must actually find something, or an
    // always-empty `direct` would make this vacuous.
    expect(direct.length, 'the direct-grounding scan found nothing — the needle is wrong').toBeGreaterThan(
      0,
    );
  });

  it('an `ire-governed` surface CALLS an IRE entrypoint and does NOT ground directly', () => {
    // Asserting the CALL, not the presence of a symbol — CFS-053 defects 5/6.
    for (const s of constitutionallyClaimableSurfaces()) {
      const code = stripComments(readSource(s.file));
      const routes = IRE_ENTRYPOINTS.some((e) => code.includes(e));
      expect(routes, `${s.id} is classified ire-governed but calls no IRE entrypoint`).toBe(true);
      expect(
        code.includes('groundReasoning('),
        `${s.id} is classified ire-governed but still grounds directly`,
      ).toBe(false);
    }
    expect(constitutionallyClaimableSurfaces().length).toBeGreaterThan(0);
  });

  it('a surface that is NOT governed must say what routing it would require', () => {
    // "We'll route it later" with no note is how an honest classification
    // becomes a place to park work nobody can cost.
    const excluded = excludedFromConstitutionalClaims();
    for (const s of excluded) {
      expect(s.classification).not.toBe('ire-governed');
      expect(
        (s.routingRequires ?? '').trim().length,
        `${s.id} is unrouted but records no routing cost`,
      ).toBeGreaterThan(60);
    }
    // …and a governed surface must NOT carry one (it has nothing left to do).
    for (const s of constitutionallyClaimableSurfaces()) {
      expect(s.routingRequires, `${s.id} is governed yet still records a routing cost`).toBeNull();
    }
  });

  it('readiness is COMPUTED from the register, and reports unready while any governed surface is unrouted', () => {
    const r = instrumentReadiness();
    expect(r.total).toBe(GROUNDING_SURFACES.length);
    expect(r.governed).toBe(constitutionallyClaimableSurfaces().length);
    // The verdict must agree with the data it is derived from — not be a
    // separately-maintained boolean.
    const unrouted = GROUNDING_SURFACES.filter((s) => s.classification === 'governed-unrouted').map(
      (s) => s.id,
    );
    expect(r.unrouted).toEqual(unrouted);
    expect(r.ready).toBe(unrouted.length === 0);
    expect(r.reason.trim().length).toBeGreaterThan(20);
    // Every unrouted id must name a real entry, so the verdict cannot be
    // satisfied by a fictional one.
    for (const id of r.unrouted) expect(groundingSurface(id)).not.toBeNull();
  });

  it('readiness is a REAL BRANCH — it can say ready, and it can say unready', () => {
    // Without this, `ready` hardcoded either way would pass everything above.
    // The register is data, so the branch is exercised over synthetic rows
    // rather than by mutating the live one.
    const asIf = (classes: GroundingSurfaceClass[]) =>
      classes.filter((c) => c === 'governed-unrouted').length === 0;
    expect(asIf(['ire-governed', 'ire-governed'])).toBe(true);
    expect(asIf(['ire-governed', 'governed-unrouted'])).toBe(false);
    // A diagnostic surface is excluded BY DESIGN and must not block readiness.
    expect(asIf(['ire-governed', 'diagnostic'])).toBe(true);
    // And the live verdict must agree with that rule applied to the live rows.
    expect(instrumentReadiness().ready).toBe(
      asIf(GROUNDING_SURFACES.map((s) => s.classification)),
    );
  });

  it('an unrouted surface is EXCLUDED from the constitutionally-claimable set', () => {
    // Clause 3 of the ruling, as a partition rather than a footnote: the two
    // sets are disjoint and together cover the register.
    const claimable = constitutionallyClaimableSurfaces().map((s) => s.id);
    const excluded = excludedFromConstitutionalClaims().map((s) => s.id);
    expect(claimable.filter((id) => excluded.includes(id))).toEqual([]);
    expect([...claimable, ...excluded].sort()).toEqual(GROUNDING_SURFACES.map((s) => s.id).sort());
    // The two surfaces that could not be routed safely today are named, so a
    // reader of the register knows the honest state rather than an aspiration.
    expect(excluded).toContain('compose-artifact');
    expect(excluded).toContain('run-artifact');
  });
});
