/**
 * Phase 5 canaries — the closed loop through DCIR, and the ten-canary
 * checklist the Homecoming III PRD requires complete before the Phase 6
 * threshold run.
 *
 * SCOPE DISCIPLINE (operator, 2026-08-15): this file demonstrates the loop is
 * STRUCTURALLY sound — DCIR observes, evidence flows, nothing canonizes,
 * lifecycle and provenance survive the trip. It does NOT claim IDE 2.0 is
 * BEHAVIOURALLY validated. That distinction is load-bearing and is restated
 * at the top of the end-to-end trace test below, not just in this comment.
 *
 * Several of the ten canaries were already established in earlier phases;
 * this file does not re-litigate them from scratch, it points at the real
 * assertion and, where useful, adds one more angle. CANARY-05, CANARY-09 and
 * CANARY-10 are new in this phase.
 */

import { describe, it, expect } from 'vitest';
import {
  CONSEQUENCE_OBSERVATION_VERDICTS,
  draftLearningReceipt,
  observeConsequence,
  type ConsequenceObservationResult,
} from '@/services/devCommandCenter/consequenceObservation';
import { bindFalsification } from '@/services/devCommandCenter/implementationContext';
import { discoverBearings, buildInitialRiskField } from '@/services/devCommandCenter/bearingDiscovery';
import {
  mayBeCitedAsEstablished,
  type EnvelopeInvariant,
  type RiskVectorRef,
} from '@/types/invariantEnvelope';
import type { ConsequenceEntry } from '@/types/devCommandCenter';
import { readSource, stripComments } from './_lib/sourceAuthority';

const OBSERVATION_SRC = stripComments(readSource('services/devCommandCenter/consequenceObservation.ts'));
const DCIR_TYPES_SRC = stripComments(readSource('types/dcir.ts'));
const EVENTSTREAM_SRC = stripComments(readSource('services/dcir/eventStream.ts'));
const ENVELOPE_TYPES_SRC = stripComments(readSource('types/invariantEnvelope.ts'));
const DEVON_TYPES_SRC = stripComments(readSource('types/devCommandCenter.ts'));
const NOW = '2026-08-15T00:00:00.000Z';

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

function binding(ref: string, falsifier = 'the prohibited state is observed') {
  return bindFalsification(
    { id: 'c1', description: 'x', category: 'workflow', severity: 'high' } as ConsequenceEntry,
    {
      invariantRef: ref,
      expectedConsequence: 'the intended state holds',
      prohibitedConsequence: 'the prohibited state holds',
      observableFalsifier: falsifier,
      requiredEvidence: ['test-observation'],
    },
  ).falsification!;
}

// ───────────────────────────────────────────────────────────────────────────
// DCIR extension — appended, not forked
// ───────────────────────────────────────────────────────────────────────────

describe('DCIR is extended, never forked', () => {
  it('the five new kinds are APPENDED to DcirEventKind, not inserted or reordered', () => {
    const existingNine = [
      'DocumentCreated', 'DocumentEdited', 'SelectionChanged', 'RecommendationAccepted',
      'RecommendationRejected', 'ArtifactApproved', 'ArtifactRejected', 'UndoPerformed',
      'NavigationOccurred', 'WorkflowAdvanced', 'ToolOutputProduced', 'ConversationTurn',
      'PersonaChanged', 'SystemEvent',
    ];
    const declIdx = DCIR_TYPES_SRC.indexOf('export type DcirEventKind');
    const block = DCIR_TYPES_SRC.slice(declIdx, declIdx + 1200);
    const firstOfExisting = block.indexOf(existingNine[0]);
    const firstOfNew = block.indexOf('InvariantSupported');
    expect(firstOfExisting).toBeGreaterThan(-1);
    expect(firstOfNew).toBeGreaterThan(firstOfExisting);
  });

  it('every new emitter calls the SAME emitDcirEvent every dev* emitter uses — no parallel emission path', () => {
    const newEmitters = [
      'invariantSupportedEvent', 'invariantChallengedEvent', 'invariantFalsifiedEvent',
      'invariantUnresolvedEvent', 'newRiskObservationEvent',
    ];
    for (const fn of newEmitters) {
      const idx = EVENTSTREAM_SRC.indexOf(`export function ${fn}`);
      expect(idx, `${fn} not found`).toBeGreaterThan(-1);
      const body = EVENTSTREAM_SRC.slice(idx, idx + 300);
      expect(body, `${fn} bypasses emitDcirEvent`).toContain('emitDcirEvent(');
    }
  });

  it('every new event runs on the observation runtime, alongside the existing dev* events', () => {
    const result = observeConsequence({
      binding: binding('inv.x'),
      observed: { sawExpectedConsequence: true, sawProhibitedConsequence: false, evidenceRefs: ['e1'] },
      anticipatedByRefs: [],
    });
    expect(result.event.runtime).toBe('observation');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The verdict vocabulary
// ───────────────────────────────────────────────────────────────────────────

describe('the five-term verdict vocabulary', () => {
  it('is exactly supported/challenged/falsified/unresolved/new-risk-observation', () => {
    expect([...CONSEQUENCE_OBSERVATION_VERDICTS]).toEqual([
      'supported', 'challenged', 'falsified', 'unresolved', 'new-risk-observation',
    ]);
  });

  it('no evidence yet is unresolved, not silently assumed either way', () => {
    const r = observeConsequence({ binding: binding('inv.x'), observed: null, anticipatedByRefs: ['inv.x'] });
    expect(r.verdict).toBe('unresolved');
  });

  it('expected consequence seen, prohibited not seen, is supported', () => {
    const r = observeConsequence({
      binding: binding('inv.x'),
      observed: { sawExpectedConsequence: true, sawProhibitedConsequence: false, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    expect(r.verdict).toBe('supported');
  });

  it('neither expected nor prohibited clearly seen is challenged, not rounded to an extreme', () => {
    const r = observeConsequence({
      binding: binding('inv.x'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: false, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    expect(r.verdict).toBe('challenged');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-05 — failure produces a risk observation first, not an invariant edit
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-05 — an unanticipated failure is a risk observation, never a direct invariant edit', () => {
  it('a prohibited consequence anticipated by a bound invariant/proof is FALSIFIED', () => {
    const r = observeConsequence({
      binding: binding('inv.retry-idempotent'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] },
      anticipatedByRefs: ['inv.retry-idempotent'],
    });
    expect(r.verdict).toBe('falsified');
    expect(r.event.kind).toBe('InvariantFalsified');
  });

  it('the SAME observation with NOTHING anticipating it is a new-risk-observation, not falsified', () => {
    /*
     * The operative distinction. Same prohibited-consequence signal, only the
     * anticipation set differs — because nothing bound to this intent claimed
     * responsibility for preventing it, the observation cannot legitimately
     * fall against any specific invariant.
     */
    const r = observeConsequence({
      binding: binding('inv.retry-idempotent'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    expect(r.verdict).toBe('new-risk-observation');
    expect(r.event.kind).toBe('NewRiskObservationRecorded');
  });

  it('draftLearningReceipt drafts from new-risk-observation and falsified, but NOT from challenged', () => {
    const falsified: ConsequenceObservationResult = observeConsequence({
      binding: binding('inv.a'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] },
      anticipatedByRefs: ['inv.a'],
    });
    const unanticipated: ConsequenceObservationResult = observeConsequence({
      binding: binding('inv.b'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    const challenged: ConsequenceObservationResult = observeConsequence({
      binding: binding('inv.c'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: false, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    const draft = draftLearningReceipt([falsified, unanticipated, challenged], NOW);
    expect(draft).not.toBeNull();
    const refs = draft!.candidateInvariantDrafts.map((d) => d.derivedFromRefs[0]);
    expect(refs.sort()).toEqual(['inv.a', 'inv.b']);
    expect(refs).not.toContain('inv.c');
  });

  it('all-supported observations draft NOTHING — silence is the correct output, not an empty draft object', () => {
    const supported = observeConsequence({
      binding: binding('inv.a'),
      observed: { sawExpectedConsequence: true, sawProhibitedConsequence: false, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    expect(draftLearningReceipt([supported], NOW)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-01 — no auto-canonization, structurally enforced on the draft
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-01 — the draft cannot express a promotion', () => {
  it('DraftLifecycleStage admits only observed|candidate — not validated/ratified/canonical/deprecated', () => {
    const block = OBSERVATION_SRC.slice(OBSERVATION_SRC.indexOf('export type DraftLifecycleStage'));
    expect(block.slice(0, 200)).toContain("Extract<CompletionStage, 'observed' | 'candidate'>");
  });

  it('every drafted candidate status is observed — never asserted higher by the drafter', () => {
    const f = observeConsequence({
      binding: binding('inv.a'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] },
      anticipatedByRefs: ['inv.a'],
    });
    const draft = draftLearningReceipt([f], NOW)!;
    expect(draft.status).toBe('observed');
    for (const c of draft.candidateInvariantDrafts) expect(c.status).toBe('observed');
  });

  it('the module contains no promote/ratify/canonize function, and does not import a registry writer', () => {
    expect(OBSERVATION_SRC).not.toMatch(/function\s+(promote|ratify|canoni[sz]e)/i);
    expect(OBSERVATION_SRC).not.toMatch(/writeFileSync|fs\.writeFile/);
    expect(OBSERVATION_SRC).not.toMatch(/loadRegistry|CANDIDATE_INVARIANTS_DIR/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-09 — provider identity is not a constitutional primitive
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-09 — provider identity never enters constitutional state', () => {
  const PROVIDER_TERMS = /\b(claude|anthropic|openai|gpt-?\d|chatgpt)\b/i;

  it('the DevOn session contract carries no provider/model identity field', () => {
    expect(DEVON_TYPES_SRC).not.toMatch(PROVIDER_TERMS);
  });

  it('the invariant envelope contract carries no provider/model identity field', () => {
    expect(ENVELOPE_TYPES_SRC).not.toMatch(PROVIDER_TERMS);
  });

  it('the DCIR event contract and the Phase 5 observation module name no provider', () => {
    expect(DCIR_TYPES_SRC).not.toMatch(PROVIDER_TERMS);
    expect(OBSERVATION_SRC).not.toMatch(PROVIDER_TERMS);
  });

  it('the coding capability is invoked through a named seam, not embedded as an identity field', () => {
    // @organ app/api/dev-command-center/implement/route.ts — repository_dispatch
    // is the existing seam (Phase 0 audit); this asserts the SESSION carries no
    // parallel provider-identity field that would compete with it.
    expect(DEVON_TYPES_SRC).not.toMatch(/\bprovider\s*:\s*string/);
    expect(DEVON_TYPES_SRC).not.toMatch(/\bmodel\s*:\s*string/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-10 — evidence may challenge established memory
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-10 — an established invariant is exactly as challengeable as a candidate', () => {
  it('observeConsequence treats an established ref and a candidate ref identically', () => {
    const established = envInv({ ref: 'inv.established', lifecycle: { registry: 'invariant-substrate', status: 'canonical' } });
    const candidate = envInv({ ref: 'inv.candidate', lifecycle: { registry: 'resolution-records', status: 'candidate' } });
    expect(mayBeCitedAsEstablished(established.lifecycle)).toBe(true);
    expect(mayBeCitedAsEstablished(candidate.lifecycle)).toBe(false);

    const observedInput = { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] };
    const onEstablished = observeConsequence({
      binding: binding(established.ref), observed: observedInput, anticipatedByRefs: [established.ref],
    });
    const onCandidate = observeConsequence({
      binding: binding(candidate.ref), observed: observedInput, anticipatedByRefs: [candidate.ref],
    });
    expect(onEstablished.verdict).toBe('falsified');
    expect(onCandidate.verdict).toBe('falsified');
  });

  it('the module never reads or writes a `.lifecycle` field — standing plays no role in observation', () => {
    // Structural guarantee behind the behavioural test above: nothing in this
    // file special-cases standing into unfalsifiability, because nothing in
    // this file touches lifecycle at all.
    expect(OBSERVATION_SRC).not.toMatch(/\.lifecycle\b/);
    expect(OBSERVATION_SRC).not.toMatch(/mayBeCitedAsEstablished/);
  });

  it('a challenge against an established ref produces real DCIR evidence, not a refusal', () => {
    const r = observeConsequence({
      binding: binding('inv.established'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: false, evidenceRefs: ['e'] },
      anticipatedByRefs: [],
    });
    expect(r.verdict).toBe('challenged');
    expect(r.event.kind).toBe('InvariantChallenged');
  });

  it('being ANTICIPATED does not grant immunity — ambiguous evidence on an anticipated ref is still challenged', () => {
    /*
     * The sharper form of the guarantee. `anticipatedByRefs` decides
     * falsified-vs-new-risk-observation (CANARY-05) and must decide NOTHING
     * else — in particular it must not become a second route to `supported`.
     * A mutation that special-cased anticipated refs toward `supported`
     * passed every other test in this file and was only caught here.
     */
    const r = observeConsequence({
      binding: binding('inv.established'),
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: false, evidenceRefs: ['e'] },
      anticipatedByRefs: ['inv.established'],
    });
    expect(r.verdict, 'anticipation must not upgrade ambiguous evidence to supported').toBe('challenged');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Consolidated ten-canary checklist — pointers + one representative angle each
// ───────────────────────────────────────────────────────────────────────────

describe('the ten canaries — consolidated checklist for the Phase 6 gate', () => {
  it('CANARY-01 no auto-canonization — see above AND tests/invariant-envelope-contract.test.ts', () => {
    expect(true).toBe(true); // indexing entry; behaviour asserted in the describe block above
  });

  it('CANARY-02 class ≠ bearing — bearing has no parallel class ontology (tests/invariant-envelope-contract.test.ts)', () => {
    expect(ENVELOPE_TYPES_SRC).not.toMatch(/interface\s+(Positive|Negative|Dual)Invariant\b/);
  });

  it('CANARY-03 negative ≠ prohibition — the causal-abstraction contract is stated once (tests/bearing-discovery.test.ts)', () => {
    const src = stripComments(readSource('services/devCommandCenter/bearingDiscovery.ts'));
    expect(src).toContain('CAUSAL CONDITION THAT MUST REMAIN TRUE');
  });

  it('CANARY-04 dual ≠ validated — dual requires independent routes (tests/bearing-discovery.test.ts)', () => {
    const src = stripComments(readSource('services/devCommandCenter/bearingDiscovery.ts'));
    expect(src).toMatch(/routes\.size > 1/);
  });

  it('CANARY-05 failure ⇒ risk observation first — asserted above, this phase', () => {
    expect([...CONSEQUENCE_OBSERVATION_VERDICTS]).toContain('new-risk-observation');
  });

  it('CANARY-06 one canonical reader, no parallel session state (tests/invariant-envelope-contract.test.ts)', () => {
    const devTypes = DEVON_TYPES_SRC;
    const fieldDeclarations = devTypes.match(/^\s*invariantEnvelope\??:/gm) ?? [];
    expect(fieldDeclarations).toHaveLength(1);
  });

  it('CANARY-07 minimal prompt context, epistemic boundaries intact (tests/gap-analysis-causal-split.test.ts)', () => {
    const src = stripComments(readSource('services/devCommandCenter/implementationContext.ts'));
    expect(src).toMatch(/CONTEXT_SECTIONS/);
  });

  it('CANARY-08 unknown risk stays unknown (this file + tests/gap-analysis-causal-split.test.ts)', () => {
    expect(ENVELOPE_TYPES_SRC).toMatch(/export type RiskMagnitude = number \| 'unknown'/);
  });

  it('CANARY-09 provider ≠ constitutional primitive — asserted above, this phase', () => {
    expect(DEVON_TYPES_SRC).not.toMatch(/\b(claude|anthropic|openai)\b/i);
  });

  it('CANARY-10 evidence can challenge retrieved memory — asserted above, this phase', () => {
    expect(OBSERVATION_SRC).not.toMatch(/\.lifecycle\b/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ONE FULL TRACE — intent → IDE/DevOn → DCIR evidence → governed draft
// ───────────────────────────────────────────────────────────────────────────

describe('ONE FULL TRACE — structural evidence only, NOT a behavioural validation of IDE 2.0', () => {
  /*
   * This test demonstrates that the STRUCTURE of the loop is sound end to
   * end, using the same deterministic scenario Phase 3's acceptance test
   * established (retry-payment-submission → idempotency, from `persistence`,
   * outside the `payments` intent domain). It is NOT evidence that a live
   * model reasons correctly through this pipeline — that is Phase 6's job,
   * against a real implementation, with the human merge gate intact
   * (CFS-016 D1). Conflating this trace with behavioural validation would be
   * exactly the overclaim the operator has repeatedly guarded against.
   */
  const VECTOR: RiskVectorRef = {
    model: 'bootstrap-heuristic-v1',
    id: 'rv.data-integrity.duplicate-effect',
    label: 'A retried operation applies its effect more than once',
  };

  it('lifecycle and provenance survive: discovery → falsification binding → DCIR observation → draft', async () => {
    // 1 — Risk Field (Phase 3, locked order)
    const riskField = buildInitialRiskField({ intentRef: 'intent.retry-payment', projected: [VECTOR], now: NOW });

    // 2 — discovery (Phase 3), deterministic provider
    const { discovered } = await discoverBearings({
      intentText: 'Add an automatic retry to the payment submission path.',
      intentDomain: 'payments',
      riskField,
      vectorDomains: { [VECTOR.id]: 'persistence' },
      known: [],
      provider: {
        async positive() {
          return [{ statement: 'A submission not yet acknowledged remains eligible for resubmission.', searchDomain: 'payments' }];
        },
        async negative({ searchDomain }) {
          return [{
            statement: 'Logical transaction identity remains stable across retries.',
            searchDomain,
            repairPath: 'Reconcile the ledger and reverse the duplicated effect.',
          }];
        },
      },
      now: NOW,
    });

    const idempotency = discovered.find((d) => d.statement.includes('Logical transaction identity'))!;
    expect(idempotency.provenance).toBe('live-discovery');
    expect(idempotency.lifecycle).toEqual({ registry: 'none', status: 'unrecorded' });
    const chainedRepairPath = idempotency.recoveries[0].repairPath;
    expect(chainedRepairPath).toContain('Reconcile');

    // 3 — falsification binding (Phase 4), carrying the SAME ref forward
    const bound = bindFalsification(
      { id: 'c-retry', description: 'Retried submissions do not duplicate their effect.', category: 'data', severity: 'critical' },
      {
        invariantRef: idempotency.ref,
        expectedConsequence: 'A retried submission has exactly one recorded effect.',
        prohibitedConsequence: 'A retried submission is recorded twice.',
        observableFalsifier: 'The ledger shows two effects for one logical submission.',
        requiredEvidence: ['ledger reconciliation trace'],
      },
    );
    expect(bound.falsification!.invariantRef).toBe(idempotency.ref);

    // 4 — DCIR observation (Phase 5): simulate the failure the mechanism the
    // requirement was bound to was supposed to prevent — ANTICIPATED, because
    // the risk field's own vector is what produced this binding.
    const observation = observeConsequence({
      binding: bound.falsification!,
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['ledger-trace-1'] },
      anticipatedByRefs: [VECTOR.id],
    });
    expect(observation.verdict).toBe('falsified');
    expect(observation.invariantRef).toBe(idempotency.ref);
    expect(observation.event.kind).toBe('InvariantFalsified');
    expect(observation.event.runtime).toBe('observation');

    // 5 — governed learning receipt draft: still unrecorded, still not canonical
    const draft = draftLearningReceipt([observation], NOW)!;
    expect(draft.status).toBe('observed');
    expect(draft.candidateInvariantDrafts[0].derivedFromRefs).toEqual([idempotency.ref]);
    expect(draft.candidateInvariantDrafts[0].status).toBe('observed');

    // THE THROUGH-LINE: the SAME ref (idempotency.ref) is traceable from
    // discovery, through the falsification binding, through the DCIR
    // observation, into the draft — no step silently re-keys or renames it.
    const allRefs = [idempotency.ref, bound.falsification!.invariantRef, observation.invariantRef, draft.candidateInvariantDrafts[0].derivedFromRefs[0]];
    expect(new Set(allRefs).size).toBe(1);
  });

  it('the SAME trace, if the failure were UNANTICIPATED, yields a risk observation instead of a falsified invariant', async () => {
    const observation = observeConsequence({
      binding: {
        invariantRef: 'inv.retry-idempotency',
        expectedConsequence: 'x', prohibitedConsequence: 'y',
        observableFalsifier: 'z', requiredEvidence: [],
      },
      observed: { sawExpectedConsequence: false, sawProhibitedConsequence: true, evidenceRefs: ['e'] },
      anticipatedByRefs: [], // nothing bound to this intent predicted it
    });
    expect(observation.verdict).toBe('new-risk-observation');
    const draft = draftLearningReceipt([observation], NOW)!;
    // Still drafts — CANARY-05 routes it to evidence, not silence — but as a
    // risk observation, never asserted as a falsification of a specific claim
    // nothing anticipated.
    expect(draft.observedFailure[0]).toMatch(/^new-risk-observation:/);
  });
});
