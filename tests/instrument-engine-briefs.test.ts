/**
 * Canaries for the three research instruments — IDE · IRE · IPE.
 *
 * These enforce the invariants recorded in the three Constitutional Capability
 * Briefs authored 2026-07-27:
 *   codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-discovery-engine.md
 *   codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-resolution-engine.md
 *   codexes/packs/agentiq/updates/2026-07-27_ccb-invariant-projection-engine.md
 *
 * SCOPE DISCIPLINE. This file was written in a read-only audit pass: no engine
 * behaviour was changed. So every assertion below either (a) pins a property
 * the code already has, or (b) pins the SUBSTRATE AUTHORITY that a recorded
 * violation turns on. Nothing here pins a defect as though it were correct —
 * the two live violations (IRE-6's clamp, IPE-4's divergence signal) are
 * deliberately left uncanaried and escalated in the briefs instead, because a
 * canary asserting the current behaviour would make the defect harder to fix,
 * and one asserting the correct behaviour would fail the build on work that has
 * not been authorised.
 *
 * CB-5 (CFS-053): every assertion here was mutation-tested — the mutation and
 * the failure it produced are recorded in the pass report. Assertions are
 * about behaviour wherever a pure function exists to call; where a property is
 * genuinely source-level (an import's type-only-ness, a route's receipt call)
 * the check goes through `stripComments` / `importAuthority` so a doc comment
 * naming the forbidden symbol cannot produce a false red or a false green.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

import { computeRecurrence, type EvidenceRow } from '@/services/invariants/discoveryEngine';
import {
  calibrateStructural,
  formatCitableInvariantsBlock,
  resolveCitableInvariants,
} from '@/services/invariants/resolution';
import { basisFor } from '@/services/invariants/coordinates';
import {
  deriveWeightsFromStanding,
  deriveWeightsFromCoordinates,
  type FieldSnapshot,
} from '@/services/invariants/engine';
import { compareProjection } from '@/services/invariants/projectionBridge';
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
    // none of the governing seeds, BOTH paths fall back to all-1 and report
    // agreement that no one computed.
    const foreign = snapshotWithStandings({ importance: 40, novelty: 10, trust: 20, need: 10 });
    const unrelated = { importance: 'inv.x', novelty: 'inv.y', trust: 'inv.z', need: 'inv.w' };
    expect(deriveWeightsFromStanding(foreign, unrelated)).toEqual(ALL_ONE);
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
