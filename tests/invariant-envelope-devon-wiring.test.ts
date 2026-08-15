/**
 * IDE 2.0 → DevOn wiring canaries (Homecoming III Phase 2).
 *
 * Run against the REAL candidate-invariant registry on disk — no fixtures, no
 * mocks. The `devon` projection channel is a filesystem read, so the acceptance
 * proof below exercises the actual 29 projected candidates rather than a
 * stand-in.
 *
 * THE ACCEPTANCE BAR (operator, 2026-08-15), quoted because it is easy to
 * under-meet: "Phase 2 acceptance should also prove that scope-aware retrieval
 * materially changes the resulting DevOn invariant envelope/compressed context
 * for the same intent where applicable; do not stop at proving the IRE function
 * was called."
 *
 * So the tests here assert CHANGES IN THE RESULT — different membership,
 * different ordering, a different compressed cut — for the same intent under
 * different scope conditions. A test that only asserted `resolveConstitutionalField`
 * was invoked would satisfy the letter of "wired" and none of the point.
 */

import { describe, it, expect } from 'vitest';
import {
  candidateScope,
  compressEnvelope,
  fromCandidate,
  loadDevonProjectedCandidates,
  partitionByEpistemicStanding,
  rankByMateriality,
} from '@/services/devCommandCenter/invariantEnvelope';
import { mayBeCitedAsEstablished, type EnvelopeInvariant } from '@/types/invariantEnvelope';
import { STAGE_PROPOSAL_KIND } from '@/services/devCommandCenter/stageOrchestrator';
import { STAGE_ORDER } from '@/services/devCommandCenter/devLoop';
import { readSource, stripComments } from './_lib/sourceAuthority';

const SERVICE_SRC = stripComments(readSource('services/devCommandCenter/invariantEnvelope.ts'));
const ORCHESTRATOR_SRC = stripComments(readSource('services/devCommandCenter/stageOrchestrator.ts'));

const REAL_CANDIDATES = loadDevonProjectedCandidates();

function envInv(over: Partial<EnvelopeInvariant> = {}): EnvelopeInvariant {
  return {
    ref: 'r',
    statement: 's',
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
// The devon projection channel — audited before use
// ───────────────────────────────────────────────────────────────────────────

describe('PROJECTION_TARGETS.devon — audited, lifecycle preserved', () => {
  it('the channel is non-trivial and dominated by NON-established material', () => {
    /*
     * The audit finding this canary exists to keep true. If this ever flips to
     * mostly-established, the compression ordering below stops being load
     * bearing and someone should notice deliberately rather than by accident.
     */
    expect(REAL_CANDIDATES.length).toBeGreaterThan(10);
    const established = REAL_CANDIDATES.filter((c) => c.status === 'ratified' || c.status === 'canonical');
    expect(established.length).toBeLessThan(REAL_CANDIDATES.length / 2);
  });

  it('EVERY projected candidate keeps its registry status — none is upgraded in transit', () => {
    for (const c of REAL_CANDIDATES) {
      const mapped = fromCandidate(c, candidateScope(c));
      expect(mapped.lifecycle).toEqual({ registry: 'resolution-records', status: c.status });
      expect(mapped.provenance).toBe('projection-devon');
    }
  });

  it('no candidate below ratified can be cited as established', () => {
    const leaked = REAL_CANDIDATES.filter((c) => c.status !== 'ratified' && c.status !== 'canonical')
      .map((c) => fromCandidate(c, candidateScope(c)))
      .filter((m) => mayBeCitedAsEstablished(m.lifecycle));
    expect(leaked.map((l) => l.ref), 'pending material must never present as validated Crystal memory').toEqual([]);
  });

  it('reads through the existing registry loader — no second reader', () => {
    // CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001: a consumer that
    // re-implements the query becomes a second, drifting answer.
    expect(SERVICE_SRC).toMatch(/import \{ loadRegistry \} from '@\/services\/invariants\/resolutionRecords'/);
    expect(SERVICE_SRC).not.toMatch(/readdirSync|readFileSync/);
  });

  it('composes the existing IRE rather than reimplementing retrieval', () => {
    expect(SERVICE_SRC).toMatch(/resolveConstitutionalField/);
    expect(SERVICE_SRC).toMatch(/buildInvariantSlice/);
    expect(SERVICE_SRC).toMatch(/INVARIANT_BUDGET/);
    // No new budget may be minted — the existing caps are the whole point.
    expect(SERVICE_SRC).not.toMatch(/const \w*BUDGET\w* =/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ACCEPTANCE — scope-aware retrieval materially changes the result
// ───────────────────────────────────────────────────────────────────────────

describe('ACCEPTANCE — scope changes the envelope, not just the call', () => {
  it('the same intent under two scope conditions yields DIFFERENT ranked membership', () => {
    /*
     * Real candidates, real mapper, real ranker. The two conditions differ only
     * in the scope each population is admitted at — which is precisely what
     * "scope-aware" has to mean if it means anything.
     */
    const asCrossDomain = REAL_CANDIDATES.map((c) => fromCandidate(c, 'cross-domain'));
    const asIntentScoped = REAL_CANDIDATES.map((c) => fromCandidate(c, 'intent'));

    const rankedBroad = rankByMateriality([
      ...asCrossDomain,
      envInv({ ref: 'substrate-1', scope: 'software-development' }),
    ]);
    const rankedNarrow = rankByMateriality([
      ...asIntentScoped,
      envInv({ ref: 'substrate-1', scope: 'software-development' }),
    ]);

    const orderBroad = rankedBroad.map((i) => i.ref);
    const orderNarrow = rankedNarrow.map((i) => i.ref);
    expect(orderBroad, 'scope must change the ranked order').not.toEqual(orderNarrow);

    // Concretely: the substrate member outranks cross-domain candidates but is
    // outranked by intent-scoped ones. Materiality, not taxonomy position.
    expect(orderBroad.indexOf('substrate-1')).toBeLessThan(orderBroad.length - 1);
    expect(orderNarrow.indexOf('substrate-1')).toBeGreaterThan(0);
  });

  it('the COMPRESSED context differs — the change survives the budget cut', () => {
    /*
     * Ranking differing is not enough: if compression discarded the difference,
     * the model would receive identical context either way and scope-awareness
     * would be decorative. This asserts the difference reaches the prompt.
     */
    const broad = compressEnvelope(
      rankByMateriality([
        ...REAL_CANDIDATES.map((c) => fromCandidate(c, 'cross-domain')),
        envInv({ ref: 'substrate-1', scope: 'software-development' }),
      ]),
      6,
    );
    const narrow = compressEnvelope(
      rankByMateriality([
        ...REAL_CANDIDATES.map((c) => fromCandidate(c, 'intent')),
        envInv({ ref: 'substrate-1', scope: 'software-development' }),
      ]),
      6,
    );

    expect(broad.items.map((i) => i.ref)).not.toEqual(narrow.items.map((i) => i.ref));
    expect(broad.block).not.toEqual(narrow.block);
    /*
     * DELIBERATELY NOT ASSERTED: that `omittedRefs` differs.
     *
     * It does not, and the reason is worth recording rather than papering
     * over. With the whole registry admitted at ONE uniform scope, every
     * non-established candidate scores identically, so the stable sort
     * preserves input order in both conditions and the same 24 members fall
     * outside the budget. Scope changed the ORDER of the surviving set, not
     * its MEMBERSHIP.
     *
     * Order change is material — it is literally different prompt text, which
     * is what the two assertions above pin. But membership change is the
     * stronger claim, so it gets its own test below rather than being smuggled
     * in on an assertion that happened to be false here.
     */
  });

  it('scope changes WHICH members survive the cut, not merely their order', () => {
    /*
     * The stronger form of the acceptance bar. Two real registry candidates,
     * both non-established, with their scopes swapped between conditions and a
     * budget that admits only one of them. If scope were decorative, the same
     * candidate would survive both times.
     */
    const nonEstablished = REAL_CANDIDATES.filter((c) => c.status !== 'ratified' && c.status !== 'canonical');
    expect(nonEstablished.length, 'need at least two non-established candidates').toBeGreaterThan(1);
    const [a, b] = nonEstablished;

    const conditionA = compressEnvelope(
      rankByMateriality([fromCandidate(a, 'intent'), fromCandidate(b, 'cross-domain')]),
      1,
    );
    const conditionB = compressEnvelope(
      rankByMateriality([fromCandidate(a, 'cross-domain'), fromCandidate(b, 'intent')]),
      1,
    );

    expect(conditionA.items).toHaveLength(1);
    expect(conditionB.items).toHaveLength(1);
    expect(conditionA.items[0].ref).toBe(a.candidateId);
    expect(conditionB.items[0].ref).toBe(b.candidateId);
    expect(
      conditionA.items[0].ref,
      'scope must decide WHICH invariant reaches the model, not just the order',
    ).not.toBe(conditionB.items[0].ref);
    // And the dropped member is named, differently, in each condition.
    expect(conditionA.omittedRefs).toEqual([b.candidateId]);
    expect(conditionB.omittedRefs).toEqual([a.candidateId]);
  });

  it('materiality outranks standing — a material candidate beats a barely-relevant canonical', () => {
    /*
     * The property that stops the envelope becoming a canon dump. If standing
     * dominated, every `canonical` member would precede every `candidate` one
     * regardless of relevance, and the compressed cut would carry the canon
     * instead of the causally determining set.
     */
    const materialCandidate = envInv({
      ref: 'material-candidate',
      scope: 'intent',
      provenance: 'projection-devon',
      lifecycle: { registry: 'resolution-records', status: 'candidate' },
    });
    const marginalCanonical = envInv({ ref: 'marginal-canonical', scope: 'cross-domain' });
    const ranked = rankByMateriality([marginalCanonical, materialCandidate]);
    expect(ranked[0].ref).toBe('material-candidate');
  });

  it('established standing breaks ties, and ONLY ties', () => {
    const a = envInv({ ref: 'candidate-same-scope', scope: 'repository', provenance: 'projection-devon', lifecycle: { registry: 'resolution-records', status: 'candidate' } });
    const b = envInv({ ref: 'canonical-same-scope', scope: 'repository' });
    // Same scope ⇒ same base score ⇒ the established one leads.
    expect(rankByMateriality([a, b])[0].ref).toBe('canonical-same-scope');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Epistemic separation survives compression
// ───────────────────────────────────────────────────────────────────────────

describe('epistemic separation through prompt composition', () => {
  it('partitions into established / signals / discoveries with nothing lost', () => {
    const items = [
      envInv({ ref: 'const-1', provenance: 'constitutional-substrate' }),
      envInv({ ref: 'cand-1', provenance: 'projection-devon', lifecycle: { registry: 'resolution-records', status: 'candidate' } }),
      envInv({ ref: 'live-1', provenance: 'live-discovery', lifecycle: { registry: 'none', status: 'unrecorded' } }),
    ];
    const p = partitionByEpistemicStanding(items);
    expect(p.established.map((i) => i.ref)).toEqual(['const-1']);
    expect(p.signals.map((i) => i.ref)).toEqual(['cand-1']);
    expect(p.discoveries.map((i) => i.ref)).toEqual(['live-1']);
    expect(p.established.length + p.signals.length + p.discoveries.length).toBe(items.length);
  });

  it('a live discovery is never established, even when its statement is compelling', () => {
    const live = envInv({
      ref: 'live-2',
      provenance: 'live-discovery',
      lifecycle: { registry: 'none', status: 'unrecorded' },
    });
    expect(partitionByEpistemicStanding([live]).established).toEqual([]);
  });

  it('established members are admitted FIRST, so candidates cannot crowd out the ground', () => {
    /*
     * The concrete risk the devon channel introduces: 26 of its 29 members are
     * non-established. A purely materiality-ranked cut at a small budget could
     * fill the prompt with candidates and drop the constitutional ground.
     */
    const manyCandidates = Array.from({ length: 20 }, (_, i) =>
      envInv({
        ref: `cand-${i}`,
        scope: 'intent',
        provenance: 'projection-devon',
        lifecycle: { registry: 'resolution-records', status: 'candidate' },
      }),
    );
    const ground = envInv({ ref: 'constitutional-1', scope: 'cross-domain', provenance: 'constitutional-substrate' });
    const compressed = compressEnvelope(rankByMateriality([...manyCandidates, ground]), 5);
    expect(compressed.items.map((i) => i.ref)).toContain('constitutional-1');
    expect(compressed.items[0].ref).toBe('constitutional-1');
  });

  it('every compressed line is epistemically marked, mixing four populations safely', () => {
    const compressed = compressEnvelope(
      rankByMateriality([
        envInv({ ref: 'const-1', provenance: 'constitutional-substrate' }),
        envInv({ ref: 'sub-1', provenance: 'crystal-substrate', lifecycle: { registry: 'invariant-substrate', status: 'proposed' } }),
        envInv({ ref: 'cand-1', provenance: 'projection-devon', lifecycle: { registry: 'resolution-records', status: 'candidate' } }),
        envInv({ ref: 'live-1', provenance: 'live-discovery', lifecycle: { registry: 'none', status: 'unrecorded' } }),
      ]),
    );
    for (const line of compressed.block.split('\n')) {
      expect(line, `unmarked line: ${line}`).toMatch(/\[[^\]]+\]/);
    }
    expect(compressed.block).toContain('[canonical]');
    expect(compressed.block).toContain('not established');
    expect(compressed.block).toContain('not yet validated');
    expect(compressed.block).toContain('unrecorded');
  });

  it('a member sharing a ref with a carried one is still named as omitted', () => {
    /*
     * REPRODUCES A REAL DEFECT found by re-reading the service (2026-08-15).
     *
     * `omittedRefs` was computed against a Set of CARRIED REFS. But a ref is
     * not unique within an envelope — the contract explicitly allows one
     * invariant to appear at two scopes, and this suite asserts that elsewhere.
     * When the constitutional-scoped copy was carried and the cross-domain copy
     * was cut, `kept.has(ref)` was true for both, so the cut copy disappeared
     * from `omittedRefs` entirely: dropped from the prompt, named nowhere.
     *
     * Silent omission is exactly what the field exists to prevent, so the bug
     * defeated the guarantee via the bookkeeping rather than via the budget.
     * Fixed by keying on object identity. Before the fix this test reports one
     * omitted ref; after it, two.
     */
    const carried = envInv({ ref: 'inv.shared', scope: 'constitutional' });
    const cut = envInv({ ref: 'inv.shared', scope: 'cross-domain' });
    const filler = envInv({ ref: 'inv.other', scope: 'cross-domain' });

    const compressed = compressEnvelope(rankByMateriality([carried, cut, filler]), 1);

    expect(compressed.items).toHaveLength(1);
    expect(compressed.items[0].scope).toBe('constitutional');
    expect(
      compressed.omittedRefs,
      'both cut members must be named, even though one shares a ref with the carried member',
    ).toHaveLength(2);
    expect(compressed.omittedRefs).toContain('inv.shared');
    expect(compressed.omittedRefs).toContain('inv.other');
  });

  it('compression names everything it dropped', () => {
    const items = Array.from({ length: 10 }, (_, i) => envInv({ ref: `x-${i}` }));
    const compressed = compressEnvelope(rankByMateriality(items), 4);
    expect(compressed.items).toHaveLength(4);
    expect(compressed.omittedRefs).toHaveLength(6);
    const seen = new Set([...compressed.items.map((i) => i.ref), ...compressed.omittedRefs]);
    expect(seen.size, 'every member is either carried or named as omitted').toBe(10);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Orchestrator map totality (operator ruling, 2026-08-15)
// ───────────────────────────────────────────────────────────────────────────

describe('orchestrator stage maps are TOTAL over DevLoopStage', () => {
  it('STAGE_PROPOSAL_KIND has an entry for every stage', () => {
    /*
     * The repaired defect: `constitutional_decision` joined STAGE_ORDER and two
     * Record<DevLoopStage, …> maps were never updated, so tsc reported the gap
     * and the stage had no proposal kind. This canary makes stage-definition
     * drift fail here instead of surfacing as a missing behaviour later.
     */
    for (const stage of STAGE_ORDER) {
      expect(Object.prototype.hasOwnProperty.call(STAGE_PROPOSAL_KIND, stage), `missing: ${stage}`).toBe(true);
    }
    expect(Object.keys(STAGE_PROPOSAL_KIND).sort()).toEqual([...STAGE_ORDER].sort());
  });

  it('STAGE_BEHAVIOR has an entry for every stage', () => {
    const block = ORCHESTRATOR_SRC.slice(ORCHESTRATOR_SRC.indexOf('const STAGE_BEHAVIOR'));
    for (const stage of STAGE_ORDER) {
      if (stage === 'complete') continue; // terminal, no behaviour narration
      expect(block, `STAGE_BEHAVIOR missing: ${stage}`).toMatch(new RegExp(`\\n\\s{2}${stage}:`));
    }
  });

  it('constitutional_decision produces NO proposal — it is decided by its own route', () => {
    // Null is the honest value, not a placeholder: the mechanism is chosen by
    // services/constitutional/constitutionalDecision.ts via
    // /api/constitutional/decision and folded onto the session there.
    expect(STAGE_PROPOSAL_KIND.constitutional_decision).toBeNull();
  });
});
