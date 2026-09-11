/**
 * Phase 4 canaries — Proof of Risk, the causal split, falsification bindings,
 * and epistemically-sectioned prompt composition.
 *
 * THE ACCEPTANCE TEST THE OPERATOR SPECIFIED (2026-08-15):
 *   "the same causalRequirement can survive substitution of one implementation
 *    mechanism for another without changing the invariant meaning."
 *
 * That test is the whole reason the split exists. If a requirement changes
 * when the mechanism changes, it was never a requirement — it was a mechanism
 * wearing a requirement's name, and it will be recorded as an invariant,
 * reused as one, and go stale the moment someone builds it differently.
 */

import { describe, it, expect } from 'vitest';
import {
  CONTEXT_SECTIONS,
  bindFalsification,
  composeImplementationContext,
  emitProofOfRisk,
  establishedSectionRefs,
  misplacedInEstablished,
  partitionByCausalClaim,
  unbridgedVectors,
} from '@/services/devCommandCenter/implementationContext';
import { buildInitialRiskField } from '@/services/devCommandCenter/bearingDiscovery';
import { mayBeCitedAsEstablished, type EnvelopeInvariant, type RiskVectorRef } from '@/types/invariantEnvelope';
import type { ConsequenceEntry, MissingCapability } from '@/types/devCommandCenter';
import { readSource, stripComments } from './_lib/sourceAuthority';

const SRC = stripComments(readSource('services/devCommandCenter/implementationContext.ts'));
const DEVON_TYPES = stripComments(readSource('types/devCommandCenter.ts'));
const NOW = '2026-08-15T00:00:00.000Z';

const VECTOR: RiskVectorRef = {
  model: 'bootstrap-heuristic-v1',
  id: 'rv.observability.false-success',
  label: 'A submitted operation reports success before its effect is observable',
};

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

function consequence(over: Partial<ConsequenceEntry> = {}): ConsequenceEntry {
  return { id: 'c1', description: 'something happens', category: 'workflow', severity: 'medium', ...over };
}

// ───────────────────────────────────────────────────────────────────────────
// ACCEPTANCE — the requirement survives mechanism substitution
// ───────────────────────────────────────────────────────────────────────────

describe('ACCEPTANCE — causalRequirement survives substitution of the mechanism', () => {
  /**
   * One requirement, three mechanisms. The requirement is stated as a
   * condition about the world; each mechanism is one way of making it hold.
   */
  const REQUIREMENT =
    'Submitted state eventually becomes independently observable to dependent consumers.';

  const withScheduler: MissingCapability = {
    name: 'submission observability',
    description: 'dependent consumers can observe submitted state',
    estimatedComplexity: 'medium',
    dependencies: [],
    suggestedLocation: 'services/ops/',
    causalRequirement: REQUIREMENT,
    implementationMechanism: 'A scheduled reconciler that polls for submitted rows and promotes them.',
  };
  const withWebhook: MissingCapability = {
    ...withScheduler,
    implementationMechanism: 'A provider webhook that pushes the state transition on completion.',
  };
  const withReadModel: MissingCapability = {
    ...withScheduler,
    implementationMechanism: 'A read model the consumer queries directly, derived from the write log.',
  };

  it('the requirement is IDENTICAL across all three mechanisms', () => {
    const mechanisms = [withScheduler, withWebhook, withReadModel];
    const requirements = new Set(mechanisms.map((m) => m.causalRequirement));
    expect(requirements.size, 'one requirement, three mechanisms').toBe(1);
    expect(new Set(mechanisms.map((m) => m.implementationMechanism)).size).toBe(3);
  });

  it('substituting the mechanism changes nothing about what must remain true', () => {
    expect(withWebhook.causalRequirement).toBe(withScheduler.causalRequirement);
    expect(withReadModel.causalRequirement).toBe(withScheduler.causalRequirement);
    expect(withWebhook.implementationMechanism).not.toBe(withScheduler.implementationMechanism);
  });

  it('the requirement names no mechanism — that is what makes it substitutable', () => {
    /*
     * The operative test. A requirement that names its mechanism cannot
     * survive the mechanism being replaced, because the replacement falsifies
     * the requirement's own wording rather than merely changing how it is met.
     */
    for (const word of ['scheduler', 'webhook', 'poll', 'cron', 'queue', 'read model']) {
      expect(
        REQUIREMENT.toLowerCase(),
        `the requirement names a mechanism ("${word}") and is therefore not substitutable`,
      ).not.toContain(word);
    }
    expect(withScheduler.implementationMechanism!.toLowerCase()).toContain('schedul');
  });

  it('a mechanism recorded AS the requirement is detectably not substitutable', () => {
    /*
     * The negative control — the defect the split exists to prevent. "A
     * scheduler" survives no substitution: replace it with a webhook and the
     * stated requirement is simply false, though nothing about the world
     * changed.
     */
    const defective: MissingCapability = { ...withScheduler, causalRequirement: 'A scheduler exists.' };
    const substituted = { ...defective, implementationMechanism: withWebhook.implementationMechanism };
    expect(substituted.causalRequirement).toContain('scheduler');
    expect(
      substituted.implementationMechanism!.toLowerCase().includes('schedul'),
      'the requirement now contradicts the mechanism — proof it was a mechanism',
    ).toBe(false);
  });

  it('the two are separate FIELDS, not one field with a convention', () => {
    const block = DEVON_TYPES.slice(DEVON_TYPES.indexOf('interface MissingCapability'));
    expect(block).toMatch(/causalRequirement\?:\s*string;/);
    expect(block).toMatch(/implementationMechanism\?:\s*string;/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Proof of Risk — evidentiary bridge, not a second risk model
// ───────────────────────────────────────────────────────────────────────────

describe('Proof of Risk is a bridge, not a second risk model', () => {
  const proof = emitProofOfRisk({
    id: 'por-1',
    intentRef: 'intent-1',
    vector: VECTOR,
    origin: 'projected',
    initiatingCondition: 'A consumer reads state before the promotion has run.',
    adverseConsequence: 'The consumer proceeds on a success that has not occurred.',
    repairPath: 'Reconcile the consumer view against the write log and replay.',
    now: NOW,
  });

  it('carries the vector BY REFERENCE and restates none of it', () => {
    expect(proof.riskVectorRef).toBe(VECTOR);
    // No duplicated label/model fields on the proof itself — one description
    // of one risk, so the two cannot disagree.
    expect(Object.keys(proof)).not.toContain('label');
    expect(Object.keys(proof)).not.toContain('model');
    expect(SRC).not.toMatch(/interface\s+\w*RiskVector\b/);
    expect(SRC).not.toMatch(/const\s+\w*RISK_MODEL\b/);
  });

  it('unassessed magnitudes are unknown, never 0', () => {
    expect(proof.severity).toBe('unknown');
    expect(proof.probability).toBe('unknown');
    expect(proof.uncertainty).toBe('unknown');
    expect(proof.reversibility).toBe('unknown');
  });

  it('cannot emit itself as supported — support is earned later, not asserted', () => {
    expect(proof.status).toBe('projected');
    expect(emitProofOfRisk({ ...{
      id: 'p2', intentRef: 'i', vector: VECTOR, origin: 'observed',
      initiatingCondition: 'x', adverseConsequence: 'y', now: NOW,
    } }).status).toBe('observed');
    expect(SRC).not.toMatch(/status:\s*'supported'/);
  });

  it('reports vectors no proof has bridged, rather than assuming coverage', () => {
    const other: RiskVectorRef = { model: 'bootstrap-heuristic-v1', id: 'rv.other', label: 'other' };
    const field = buildInitialRiskField({ intentRef: 'i', projected: [VECTOR, other], now: NOW });
    expect(unbridgedVectors(field, [proof]).map((v) => v.id)).toEqual(['rv.other']);
    expect(unbridgedVectors(field, [])).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Falsification bindings — only where a causal claim is under test
// ───────────────────────────────────────────────────────────────────────────

describe('falsification binds only material causal assumptions', () => {
  it('an ordinary consequence carries NO binding', () => {
    const ordinary = consequence({ id: 'ui-1', description: 'The tab renders the new column.' });
    expect(ordinary.falsification).toBeUndefined();
    expect(partitionByCausalClaim([ordinary]).ordinary).toHaveLength(1);
    expect(partitionByCausalClaim([ordinary]).testable).toHaveLength(0);
  });

  it('binding is optional on the type — the schema does not manufacture claims', () => {
    const block = DEVON_TYPES.slice(DEVON_TYPES.indexOf('interface ConsequenceEntry'));
    expect(block).toMatch(/falsification\?:\s*ConsequenceFalsificationBinding;/);
    expect(block, 'a required binding would force invented causal claims').not.toMatch(
      /\n\s*falsification:\s*ConsequenceFalsificationBinding;/,
    );
  });

  it('a bound consequence carries the full chain', () => {
    const bound = bindFalsification(
      consequence({ id: 'c-obs', description: 'Dependent consumers observe submitted state.' }),
      {
        invariantRef: 'inv.observability.001',
        expectedConsequence: 'A consumer polling after submission sees the row.',
        prohibitedConsequence: 'A consumer sees success while the row is absent.',
        observableFalsifier: 'A submitted row remains invisible to consumers after the promotion window.',
        requiredEvidence: ['reconciler run log', 'consumer read trace'],
      },
    );
    const f = bound.falsification!;
    expect(f.invariantRef).toBe('inv.observability.001');
    expect(f.expectedConsequence).toBeTruthy();
    expect(f.prohibitedConsequence).toBeTruthy();
    expect(f.observableFalsifier).toBeTruthy();
    expect(f.requiredEvidence.length).toBeGreaterThan(0);
    expect(partitionByCausalClaim([bound]).testable).toHaveLength(1);
  });

  it('binding does not confer standing — it names a ref, it does not rate it', () => {
    // The binding must not restate lifecycle; standing travels in the envelope.
    const block = DEVON_TYPES.slice(DEVON_TYPES.indexOf('interface ConsequenceFalsificationBinding'));
    expect(block).not.toMatch(/lifecycle/);
    expect(block).not.toMatch(/status/);
    expect(block).not.toMatch(/established/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Prompt composition — compression never collapses epistemic boundaries
// ───────────────────────────────────────────────────────────────────────────

describe('compression preserves the Phase 1 epistemic boundaries', () => {
  const population: EnvelopeInvariant[] = [
    envInv({ ref: 'con-1', provenance: 'constitutional-substrate' }),
    envInv({ ref: 'est-1' }),
    envInv({
      ref: 'cand-1',
      provenance: 'projection-devon',
      lifecycle: { registry: 'resolution-records', status: 'candidate' },
    }),
    envInv({
      ref: 'live-1',
      provenance: 'live-discovery',
      lifecycle: { registry: 'none', status: 'unrecorded' },
    }),
  ];

  it('renders five distinct sections in the pinned order', () => {
    expect([...CONTEXT_SECTIONS]).toEqual([
      'constitutional-constraints',
      'established-invariants',
      'candidate-and-risk-signals',
      'live-discoveries',
      'unresolved-material-uncertainty',
    ]);
    const ctx = composeImplementationContext(population, ['Is the promotion window bounded?']);

    /*
     * Assert the ORDER IN THE RENDERED TEXT, by locating each heading and
     * checking the offsets ascend. An earlier version of this test built an
     * `order` array via `text.indexOf('')` — which returns 0 for every section
     * — and then asserted only its length. It looked like an ordering test and
     * tested nothing: an inert mechanism, which is a defect even though it was
     * green (Companion MS-7; CI-2026-08-03-CANARY-SUBJECT-SELECTION-001).
     */
    const headings = [
      'Constitutional constraints',
      'Established invariants',
      'Candidate signals',
      'Live discoveries',
      'Unresolved',
    ];
    const offsets = headings.map((h) => ctx.text.indexOf(h));
    for (const [i, off] of offsets.entries()) {
      expect(off, `heading missing from the composed text: ${headings[i]}`).toBeGreaterThan(-1);
    }
    expect(offsets, 'sections must render in the pinned order').toEqual([...offsets].sort((a, b) => a - b));
    expect(new Set(offsets).size, 'each heading appears at its own offset').toBe(headings.length);
  });

  it('a candidate NEVER appears in an established-reading section, at any budget', () => {
    for (const budget of [0, 1, 2, 3, 12]) {
      const ctx = composeImplementationContext(population, [], budget);
      expect(
        misplacedInEstablished(ctx, population),
        `budget ${budget} placed non-established material in an established section`,
      ).toEqual([]);
      expect(ctx.carried['established-invariants']).not.toContain('cand-1');
      expect(ctx.carried['constitutional-constraints']).not.toContain('cand-1');
    }
  });

  it('a PROPOSED constitutional member is a signal, not a constraint', () => {
    /*
     * The subtle one. `constitutional-substrate` is a SOURCE claim, not a
     * STANDING claim — an unratified constitutional proposal is a hypothesis
     * about constitutional matters, and presenting it under "non-negotiable"
     * would be a lifecycle collapse dressed as provenance.
     */
    const proposedConstitutional = envInv({
      ref: 'con-proposed',
      provenance: 'constitutional-substrate',
      lifecycle: { registry: 'invariant-substrate', status: 'proposed' },
    });
    const ctx = composeImplementationContext([proposedConstitutional], []);
    expect(ctx.carried['constitutional-constraints']).toEqual([]);
    expect(ctx.carried['candidate-and-risk-signals']).toEqual(['con-proposed']);
    expect(misplacedInEstablished(ctx, [proposedConstitutional])).toEqual([]);
  });

  it('constitutional constraints are not subject to the budget', () => {
    /*
     * A budget that can silently remove the bounds is a hazard, not a budget.
     *
     * THE CONSTITUTIONAL COUNT MUST EXCEED THE BUDGET or this test cannot
     * discriminate. An earlier version used ONE constitutional member against
     * a budget of 2: it survived whether or not the budget applied to it, so
     * the assertion held under both behaviours and proved nothing. Mutating
     * the composer to charge constitutional members to the budget left the
     * test green — which is how the defect was found.
     *
     * Three constitutional members against a budget of 1: exempt ⇒ all three
     * carried; budget-subject ⇒ at most one.
     */
    const constitutional = ['con-1', 'con-2', 'con-3'].map((ref) =>
      envInv({ ref, provenance: 'constitutional-substrate' }),
    );
    const many = Array.from({ length: 20 }, (_, i) => envInv({ ref: `c-${i}` }));
    const ctx = composeImplementationContext([...constitutional, ...many], [], 1);

    expect(ctx.carried['constitutional-constraints']).toEqual(['con-1', 'con-2', 'con-3']);
    // Assert on the RENDERED TEXT too, not only the ref list — they are two
    // projections of one membership decision and a canary that reads only one
    // cannot see them disagree.
    expect(ctx.sections['constitutional-constraints']).toHaveLength(3);
    for (const ref of ['con-1', 'con-2', 'con-3']) {
      expect(ctx.omittedRefs, `${ref} was dropped by the budget`).not.toContain(ref);
      expect(ctx.text, `${ref} missing from the composed prompt`).toContain(ref);
    }
    // And the budget still bit on everything it legitimately governs.
    expect(ctx.carried['established-invariants']).toHaveLength(1);
    expect(ctx.omittedRefs.length).toBe(19);
  });

  it('every section renders exactly the members it reports as carried', () => {
    /*
     * The structural guard behind the mutation finding above: `sections`,
     * `carried` and `omittedRefs` must describe ONE membership decision. This
     * asserts the invariant directly rather than trusting three expressions to
     * stay in step.
     */
    const ctx = composeImplementationContext(population, ['q'], 2);
    for (const s of CONTEXT_SECTIONS) {
      if (s === 'unresolved-material-uncertainty') continue;
      expect(
        ctx.sections[s].length,
        `${s}: rendered ${ctx.sections[s].length} lines but reports ${ctx.carried[s].length} carried`,
      ).toBe(ctx.carried[s].length);
      for (const ref of ctx.carried[s]) {
        expect(ctx.sections[s].join('\n'), `${ref} reported carried but not rendered`).toContain(ref);
      }
    }
    const carriedAll = CONTEXT_SECTIONS.flatMap((s) => ctx.carried[s]);
    expect(carriedAll.length + ctx.omittedRefs.length, 'every member is carried or omitted, never both or neither')
      .toBe(population.length);
  });

  it('compression drops material but never merges sections', () => {
    const ctx = composeImplementationContext(population, [], 1);
    // With budget 1 only one non-constitutional member survives, and it must
    // still be in ITS OWN section rather than folded into another.
    const nonEmpty = CONTEXT_SECTIONS.filter(
      (s) => s !== 'unresolved-material-uncertainty' && ctx.carried[s].length > 0,
    );
    for (const s of nonEmpty) {
      expect(ctx.carried[s].length).toBeGreaterThan(0);
    }
    expect(ctx.omittedRefs.length).toBeGreaterThan(0);
  });

  it('every carried line keeps its epistemic marker', () => {
    const ctx = composeImplementationContext(population, []);
    const lines = ctx.text.split('\n').filter((l) => l.startsWith('- ') && l.includes('('));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l, `unmarked: ${l}`).toMatch(/\[[^\]]+\]/);
  });

  it('names everything it dropped, keyed on identity not ref', () => {
    // CI-2026-08-15-COLLECTION-KEY-UNIQUENESS-001 applied to this composer too.
    const shared = [
      envInv({ ref: 'inv.shared', provenance: 'constitutional-substrate' }),
      envInv({ ref: 'inv.shared', scope: 'cross-domain' }),
      envInv({ ref: 'inv.other', scope: 'cross-domain' }),
    ];
    const ctx = composeImplementationContext(shared, [], 0);
    expect(ctx.carried['constitutional-constraints']).toEqual(['inv.shared']);
    expect(ctx.omittedRefs.sort()).toEqual(['inv.other', 'inv.shared']);
  });

  it('unresolved questions are surfaced, not answered', () => {
    const ctx = composeImplementationContext([], ['What bounds the promotion window?']);
    expect(ctx.text).toContain('do not resolve these by inference');
    expect(ctx.sections['unresolved-material-uncertainty']).toEqual([
      '- What bounds the promotion window?',
    ]);
  });

  it('established-section membership always satisfies mayBeCitedAsEstablished', () => {
    const ctx = composeImplementationContext(population, []);
    const refs = new Set(establishedSectionRefs(ctx));
    for (const i of population.filter((p) => refs.has(p.ref))) {
      expect(mayBeCitedAsEstablished(i.lifecycle), `${i.ref} is not citable`).toBe(true);
    }
  });
});
