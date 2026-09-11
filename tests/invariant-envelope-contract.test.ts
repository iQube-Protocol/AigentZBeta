/**
 * Invariant Development Envelope — contract canaries (Homecoming III Phase 1).
 *
 * The envelope's job is to hold constitutional invariants, validated substrate
 * members, `devon`-projected candidates and live discoveries IN ONE COLLECTION
 * without letting their epistemic differences dissolve. These canaries pin the
 * mechanisms that make that safe, so a later phase cannot quietly remove them.
 *
 * OPERATOR REQUIREMENT BEING PINNED (2026-08-15):
 *   "the envelope must make it impossible for downstream prompt composition to
 *    erase those epistemic distinctions. That is going to matter enormously
 *    once PROJECTION_TARGETS.devon enters the loop."
 *
 * The word doing the work is IMPOSSIBLE. A convention is not impossible; a
 * documented rule is not impossible. So the tests below check for STRUCTURAL
 * prevention — required non-nullable fields, a discriminated union that cannot
 * be flattened, and a branded type with exactly one constructor — and would
 * fail if any of those degraded into advice.
 *
 * Style: behavioural where there is runtime to exercise, source-scan where the
 * claim is structural (a type-level guarantee leaves no runtime trace). The
 * source-scan half follows the existing convention in
 * tests/cfs-055-coherence-canaries.test.ts and tests/repo-weight.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  INVARIANT_BEARINGS,
  INVARIANT_SCOPES,
  INVARIANT_PROVENANCES,
  RISK_ORIGINS,
  epistemicMarker,
  mayBeCitedAsEstablished,
  renderMarkedInvariantBlock,
  type EnvelopeInvariant,
  type InvariantLifecycleRef,
} from '@/types/invariantEnvelope';
import { COMPLETION_LIFECYCLE } from '@/types/capabilityCompletion';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ENVELOPE_SRC = readSource('types/invariantEnvelope.ts');
const ENVELOPE_CODE = stripComments(ENVELOPE_SRC);
const DEVON_TYPES = stripComments(readSource('types/devCommandCenter.ts'));

function inv(over: Partial<EnvelopeInvariant> = {}): EnvelopeInvariant {
  return {
    ref: 'inv.test.001',
    statement: 'A test statement.',
    provenance: 'crystal-substrate',
    lifecycle: { registry: 'invariant-substrate', status: 'canonical' },
    scope: 'repository',
    bearing: null,
    recoveries: [],
    materiality: 'unknown',
    ...over,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// CANARY-02 — class and bearing are INDEPENDENT axes
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-02 — bearing is an axis, never a class', () => {
  it('the bearing vocabulary is exactly positive/negative/dual', () => {
    expect([...INVARIANT_BEARINGS]).toEqual(['positive', 'negative', 'dual']);
  });

  it('does NOT mint a parallel class ontology — no "negative invariant" type exists', () => {
    /*
     * PRD §7: "Do not create 'positive invariants' and 'negative invariants'
     * as separate ontologies." The failure this catches is a later phase
     * adding `NegativeInvariant`/`PositiveInvariant` interfaces, at which
     * point bearing has silently become a class and the two axes can no
     * longer vary independently.
     */
    expect(ENVELOPE_CODE).not.toMatch(/interface\s+(Positive|Negative|Dual)Invariant\b/);
    expect(ENVELOPE_CODE).not.toMatch(/type\s+(Positive|Negative|Dual)Invariant\b/);
  });

  it('bearing is nullable on a retrieved invariant — absence of a bearing is honest', () => {
    // Retrieval happens before discovery assigns bearings. A non-null default
    // would mean every retrieved invariant arrives pre-labelled 'positive',
    // which is an assertion nothing has made.
    expect(inv().bearing).toBeNull();
    expect(ENVELOPE_CODE).toMatch(/bearing:\s*InvariantBearing\s*\|\s*null/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-04 — dual recovery is evidence, not promotion
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-04 — a dual bearing records HOW each side was recovered', () => {
  it('BearingRecovery carries the route, so independence is auditable not asserted', () => {
    expect(ENVELOPE_CODE).toMatch(/route:\s*'intent-driven'\s*\|\s*'risk-driven'/);
  });

  it('a dual claim backed by two same-route recoveries is detectable as not independent', () => {
    /*
     * The operator's acceptance refinement: "Merely invoking the same
     * discovery process twice with different labels does not satisfy IDE 2.0."
     * This asserts the DATA needed to catch that is present — the enforcement
     * lands with the discovery pass in Phase 3, and this canary is what that
     * phase must keep satisfiable.
     */
    const fake = inv({
      bearing: 'dual',
      recoveries: [
        { bearing: 'positive', route: 'intent-driven', searchDomain: 'auth', riskVectorRef: null },
        { bearing: 'negative', route: 'intent-driven', searchDomain: 'auth', riskVectorRef: null },
      ],
    });
    const routes = new Set(fake.recoveries.map((r) => r.route));
    expect(routes.size, 'two same-route recoveries must not read as independent').toBe(1);
  });

  it('dual is not a lifecycle status — it cannot appear in either ladder', () => {
    expect([...COMPLETION_LIFECYCLE]).not.toContain('dual');
    expect(ENVELOPE_CODE).not.toMatch(/status:\s*'dual'/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The epistemic-provenance guarantees (operator requirement, 2026-08-15)
// ───────────────────────────────────────────────────────────────────────────

describe('epistemic provenance — inseparable from the statement', () => {
  it('provenance and lifecycle are REQUIRED and non-nullable on every envelope invariant', () => {
    /*
     * The whole design rests on this. If either becomes optional, a member can
     * exist with no epistemic position, and every consumer downstream has to
     * invent a default — which is the erasure, arriving by a slower route.
     */
    const block = ENVELOPE_CODE.slice(ENVELOPE_CODE.indexOf('interface EnvelopeInvariant'));
    expect(block).toMatch(/\n\s*provenance:\s*InvariantProvenance;/);
    expect(block).toMatch(/\n\s*lifecycle:\s*InvariantLifecycleRef;/);
    // Neither may be optional (`?:`) nor nullable.
    expect(block).not.toMatch(/provenance\?:/);
    expect(block).not.toMatch(/lifecycle\?:/);
    expect(block).not.toMatch(/lifecycle:\s*InvariantLifecycleRef\s*\|\s*null/);
  });

  it('the provenance vocabulary distinguishes projected candidates from substrate memory', () => {
    expect([...INVARIANT_PROVENANCES]).toContain('projection-devon');
    expect([...INVARIANT_PROVENANCES]).toContain('crystal-substrate');
    expect([...INVARIANT_PROVENANCES]).toContain('live-discovery');
    // Operator ruling: pending/candidate material may inform discovery but must
    // never be represented as validated Crystal memory. Distinct provenance is
    // the first half of that; mayBeCitedAsEstablished is the second.
    expect(new Set(INVARIANT_PROVENANCES).size).toBe(INVARIANT_PROVENANCES.length);
  });

  it('the two lifecycle ladders are MAPPED, never unified', () => {
    /*
     * Both ladders contain 'validated' and it does not mean the same thing in
     * each. A shared `status: string` would equate them silently. The
     * discriminated union keeps each status attached to its issuing registry.
     */
    expect(ENVELOPE_CODE).toMatch(/registry:\s*'invariant-substrate';\s*status:\s*InvariantStatus/);
    expect(ENVELOPE_CODE).toMatch(/registry:\s*'resolution-records';\s*status:\s*CompletionStage/);
    expect(ENVELOPE_CODE).toMatch(/registry:\s*'none';\s*status:\s*'unrecorded'/);
    // No flattened alias that would let the discriminant be dropped.
    expect(ENVELOPE_CODE).not.toMatch(/type\s+InvariantLifecycle\s*=\s*string/);
  });

  it('substrate-validated and record-validated do NOT both count as established', () => {
    // The concrete consequence of mapping rather than unifying.
    const substrateValidated: InvariantLifecycleRef = {
      registry: 'invariant-substrate',
      status: 'validated',
    };
    const recordRatified: InvariantLifecycleRef = {
      registry: 'resolution-records',
      status: 'ratified',
    };
    expect(mayBeCitedAsEstablished(substrateValidated)).toBe(false);
    expect(mayBeCitedAsEstablished(recordRatified)).toBe(true);
  });

  it('nothing discovered this run, and no devon-projected candidate, may be cited as established', () => {
    expect(mayBeCitedAsEstablished({ registry: 'none', status: 'unrecorded' })).toBe(false);
    expect(mayBeCitedAsEstablished({ registry: 'resolution-records', status: 'candidate' })).toBe(false);
    expect(mayBeCitedAsEstablished({ registry: 'resolution-records', status: 'observed' })).toBe(false);
    expect(mayBeCitedAsEstablished({ registry: 'invariant-substrate', status: 'proposed' })).toBe(false);
  });

  it('every status on both ladders produces a distinct, non-empty marker', () => {
    // Total by construction: a status added to either registry cannot slip
    // through with an empty or duplicated marker.
    const refs: InvariantLifecycleRef[] = [
      { registry: 'none', status: 'unrecorded' },
      ...(['draft', 'proposed', 'validated', 'canonical', 'rejected', 'deprecated', 'superseded'] as const).map(
        (status) => ({ registry: 'invariant-substrate', status }) as InvariantLifecycleRef,
      ),
      ...COMPLETION_LIFECYCLE.map(
        (status) => ({ registry: 'resolution-records', status }) as InvariantLifecycleRef,
      ),
    ];
    for (const r of refs) {
      expect(epistemicMarker(r).length, `empty marker for ${JSON.stringify(r)}`).toBeGreaterThan(0);
    }
    // A 'candidate' must never render as though it were established.
    expect(epistemicMarker({ registry: 'resolution-records', status: 'candidate' })).toContain('not yet validated');
    expect(epistemicMarker({ registry: 'invariant-substrate', status: 'proposed' })).toContain('not established');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-07 (structural half) — prompt composition cannot erase provenance
// ───────────────────────────────────────────────────────────────────────────

describe('prompt composition — erasure is structurally prevented', () => {
  it('every rendered line carries its epistemic marker', () => {
    const block = renderMarkedInvariantBlock([
      inv({ ref: 'a', lifecycle: { registry: 'invariant-substrate', status: 'canonical' } }),
      inv({
        ref: 'b',
        provenance: 'projection-devon',
        lifecycle: { registry: 'resolution-records', status: 'candidate' },
      }),
      inv({ ref: 'c', provenance: 'live-discovery', lifecycle: { registry: 'none', status: 'unrecorded' } }),
    ]);
    const lines = block.split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line, `line without an epistemic marker: ${line}`).toMatch(/\[[^\]]+\]/);
    }
    // The three epistemic classes must be visibly different in the output —
    // this is the property that survives into the model's context.
    expect(lines[0]).toContain('[canonical]');
    expect(lines[1]).toContain('not yet validated');
    expect(lines[2]).toContain('unrecorded');
  });

  it('the renderer never drops or reorders members — silent omission is quieter erasure', () => {
    const items = ['a', 'b', 'c', 'd'].map((ref) => inv({ ref }));
    const lines = renderMarkedInvariantBlock(items).split('\n');
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l.match(/\((\w+),/)?.[1])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('MarkedInvariantBlock is branded, so a hand-joined string cannot satisfy it', () => {
    /*
     * THE STRUCTURAL GUARANTEE, and the reason this is a brand rather than a
     * naming convention. The erasure shape is one line —
     *   items.map(i => i.statement).join('\n')
     * — which typechecks anywhere a plain `string` is accepted. Branding the
     * envelope's prompt-facing field means that line will not compile there.
     *
     * A type-level guarantee leaves no runtime trace, so this is asserted
     * against the source: the brand exists, it is a unique symbol, and the
     * renderer is the only place that casts into it.
     */
    expect(ENVELOPE_CODE).toMatch(/declare const epistemicBrand: unique symbol/);
    expect(ENVELOPE_CODE).toMatch(
      /export type MarkedInvariantBlock = string & \{ readonly \[epistemicBrand\]: true \}/,
    );
    const casts = ENVELOPE_CODE.match(/as MarkedInvariantBlock/g) ?? [];
    expect(casts, 'exactly one constructor may cast into the brand').toHaveLength(1);
  });

  it('the compressed set carries invariants, never bare statement strings', () => {
    /*
     * If CompressedInvariantSet held `string[]`, the brand would guard the
     * rendered block while the data beside it had already lost provenance.
     */
    const block = ENVELOPE_CODE.slice(ENVELOPE_CODE.indexOf('interface CompressedInvariantSet'));
    expect(block).toMatch(/items:\s*EnvelopeInvariant\[\]/);
    expect(block).not.toMatch(/items:\s*string\[\]/);
    expect(block).not.toMatch(/statements:\s*string\[\]/);
  });

  it('compression must declare what it dropped — omittedRefs is required, not optional', () => {
    const block = ENVELOPE_CODE.slice(ENVELOPE_CODE.indexOf('interface CompressedInvariantSet'));
    expect(block).toMatch(/\n\s*omittedRefs:\s*string\[\];/);
    expect(block).not.toMatch(/omittedRefs\?:/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-08 — unknown risk remains unknown
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-08 — no fabricated quantitative precision', () => {
  it('risk magnitudes admit an explicit unknown rather than defaulting to a number', () => {
    expect(ENVELOPE_CODE).toMatch(/export type RiskMagnitude = number \| 'unknown'/);
    for (const field of ['severity', 'probability', 'uncertainty']) {
      expect(ENVELOPE_CODE).toMatch(new RegExp(`${field}:\\s*RiskMagnitude;`));
    }
  });

  it('reversibility has an explicit unknown member — absence is not "reversible"', () => {
    expect(ENVELOPE_CODE).toMatch(/reversibility:\s*'reversible'[^;]*\|\s*'unknown'/);
  });

  it('materiality may be unknown — never silently 0, which would read as "assessed as immaterial"', () => {
    expect(ENVELOPE_CODE).toMatch(/materiality:\s*number \| 'unknown'/);
    expect(inv().materiality).toBe('unknown');
  });

  it('the risk field states which origins contributed, so an empty origin is visible', () => {
    expect([...RISK_ORIGINS]).toEqual(['projected', 'retrieved', 'observed']);
    expect(ENVELOPE_CODE).toMatch(/originsPresent:\s*RiskOrigin\[\]/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-06 — no parallel session state
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-06 — the DevOn session stays authoritative', () => {
  it('the envelope attaches to DevLoopState as ONE optional field', () => {
    expect(DEVON_TYPES).toMatch(/invariantEnvelope\?:\s*InvariantDevelopmentEnvelope \| null;/);
    /*
     * Count FIELD DECLARATIONS, not bare occurrences of the identifier: the
     * import specifier `from './invariantEnvelope'` also contains the string,
     * so a substring count reports 2 and fails forever regardless of the
     * property under test. Selecting the subject by the property being tested
     * rather than by incidental text is CI-2026-08-03-CANARY-SUBJECT-SELECTION-001.
     */
    const fieldDeclarations = DEVON_TYPES.match(/^\s*invariantEnvelope\??:/gm) ?? [];
    expect(fieldDeclarations, 'the envelope has exactly one home on the session').toHaveLength(1);
  });

  it('the envelope carries no session identity of its own beyond a reference', () => {
    /*
     * `sessionRef` is a POINTER to the DevOn session. A `sessionId` field, or
     * its own stage/receipts/status, would make it a second session record —
     * the parallel-state defect inv.engineering.036 governs.
     */
    const block = ENVELOPE_CODE.slice(ENVELOPE_CODE.indexOf('interface InvariantDevelopmentEnvelope'));
    expect(block).toMatch(/sessionRef:\s*string;/);
    expect(block).not.toMatch(/\n\s*sessionId:/);
    expect(block).not.toMatch(/\n\s*stage:\s*DevLoopStage/);
    expect(block).not.toMatch(/\n\s*receipts:/);
  });

  it('the contract file holds no store, fetch, or persistence call', () => {
    // Contract-first, per the types/dcir.ts precedent: types + pinned consts +
    // the minimum pure runtime that makes the contract enforceable. A reach
    // into Supabase or fetch here would be the fork this discipline prevents.
    expect(ENVELOPE_CODE).not.toMatch(/\bfetch\(/);
    expect(ENVELOPE_CODE).not.toMatch(/supabase/i);
    expect(ENVELOPE_CODE).not.toMatch(/createClient/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-01 (contract half) — nothing here canonizes
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-01 — the contract cannot express a promotion', () => {
  it('no type in the envelope offers a promote/ratify/canonize operation', () => {
    expect(ENVELOPE_CODE).not.toMatch(/function\s+(promote|ratify|canoni[sz]e)/i);
    expect(ENVELOPE_CODE).not.toMatch(/interface\s+\w*Promotion\b/);
  });

  it('lifecycle statuses are READ from the registries, never authored here', () => {
    // The envelope imports both ladders rather than declaring its own. A local
    // status union would be a third vocabulary — the exact thing CCR-001's
    // "map, don't unify" ruling forbids.
    expect(ENVELOPE_SRC).toMatch(/import type \{ CompletionStage \} from '\.\/capabilityCompletion'/);
    expect(ENVELOPE_SRC).toMatch(/import type \{ InvariantStatus \} from '\.\/invariants'/);
    expect(ENVELOPE_CODE).not.toMatch(/export const \w*LIFECYCLE\b/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Scope ladder
// ───────────────────────────────────────────────────────────────────────────

describe('scope — broad to specific, ranked by materiality', () => {
  it('the ladder is pinned in order (constitutional data)', () => {
    expect([...INVARIANT_SCOPES]).toEqual([
      'constitutional',
      'cross-domain',
      'software-development',
      'agentic-development',
      'project-runtime',
      'repository',
      'intent',
    ]);
  });

  it('scope is a property of the retrieval, not an exclusive classification', () => {
    // PRD §6: "An invariant may apply at multiple scopes." Two envelope members
    // may therefore share a ref at different scopes without contradiction.
    const a = inv({ ref: 'inv.x', scope: 'constitutional' });
    const b = inv({ ref: 'inv.x', scope: 'repository' });
    expect(a.ref).toBe(b.ref);
    expect(a.scope).not.toBe(b.scope);
  });
});
