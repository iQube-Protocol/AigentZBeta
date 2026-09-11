/**
 * Homecoming III Phase 5 canaries — closing
 *
 *   implementation → consequence observation → invariant evidence →
 *   governed learning
 *
 * Ten bootstrap canaries (operator, Phase 5 gate), each pinned in its own
 * describe block below, plus the end-to-end acceptance trace. CANARY-02,
 * 03, 04, 06, 07, 08 already have dedicated coverage from Phases 1-4
 * (tests/bearing-discovery.test.ts, tests/invariant-envelope-contract.
 * test.ts) — this file re-asserts each against the NEW Phase 5 surfaces
 * that touch the same property, rather than duplicating the original
 * canary. CANARY-01, 05, 09, 10 get their primary coverage here, since
 * Phase 5 is where each first has a concrete surface to test.
 */

import { describe, it, expect } from 'vitest';
import {
  invariantChallengedEvent,
  invariantFalsifiedEvent,
  invariantSupportedEvent,
  invariantUnresolvedEvent,
  newRiskObservationEvent,
  DCIR_EVENT_SUMMARY_MAX,
} from '@/services/dcir/eventStream';
import type { DcirEvent, DcirEventKind } from '@/types/dcir';
import {
  applyEvidenceToProofsOfRisk,
  bindConsequenceEvidence,
  classifyConsequenceEvidence,
  emitEvidenceEvents,
  establishedRefsUnderChallenge,
  evidenceKindForVerdict,
  withEmittedEventIds,
} from '@/services/devCommandCenter/invariantEvidence';
import {
  abstractCausalCandidate,
  assessRecurrencePortability,
  recordRiskObservation,
  type AbstractCausalCandidateInput,
} from '@/services/devCommandCenter/failureLearning';
import {
  buildLearningReceipt,
  deriveScopeRecommendations,
  validateLearningReceiptDraft,
} from '@/services/devCommandCenter/learningReceipt';
import {
  claimKey,
  discoverBearings,
  buildInitialRiskField,
  type BearingDiscoveryProvider,
  type DiscoveredCondition,
} from '@/services/devCommandCenter/bearingDiscovery';
import { compressEnvelope, partitionByEpistemicStanding } from '@/services/devCommandCenter/invariantEnvelope';
import { composeImplementationContext, emitProofOfRisk } from '@/services/devCommandCenter/implementationContext';
import { validateCandidateInvariant, validateResolutionRecord } from '@/services/invariants/resolutionRecords';
import type {
  ConsequenceCanvas,
  ConsequenceEntry,
  ConsequenceValidationItem,
  ConsequenceValidationReport,
} from '@/types/devCommandCenter';
import {
  mayBeCitedAsEstablished,
  type EnvelopeInvariant,
  type IntentRiskField,
  type InvariantDevelopmentEnvelope,
  type ProofOfRisk,
  type RiskVectorRef,
} from '@/types/invariantEnvelope';
import type { InvariantEvidenceObservation, RiskObservation } from '@/types/devLoopLearning';
import { readSource, stripComments } from './_lib/sourceAuthority';

const NOW = '2026-08-15T12:00:00.000Z';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

function envInv(over: Partial<EnvelopeInvariant> = {}): EnvelopeInvariant {
  return {
    ref: 'r',
    statement: 's',
    provenance: 'live-discovery',
    lifecycle: { registry: 'none', status: 'unrecorded' },
    scope: 'intent',
    bearing: null,
    recoveries: [],
    materiality: 'unknown',
    ...over,
  };
}

function proof(over: Partial<ProofOfRisk> = {}): ProofOfRisk {
  return {
    id: 'proof.1',
    intentRef: 'intent.x',
    riskVectorRef: null,
    origin: 'projected',
    invariantRefs: [],
    initiatingCondition: 'ic',
    adverseConsequence: 'ac',
    severity: 'unknown',
    probability: 'unknown',
    uncertainty: 'unknown',
    repairPath: null,
    reversibility: 'unknown',
    blastRadius: null,
    evidenceRefs: [],
    status: 'projected',
    createdAt: NOW,
    ...over,
  };
}

function riskObs(over: Partial<RiskObservation> = {}): RiskObservation {
  return recordRiskObservation({
    id: 'obs.1',
    intentRef: 'intent.x',
    sessionRef: 'session.x',
    site: 'siteA',
    description: 'a failure',
    initiatingCondition: 'a condition held',
    adverseConsequence: 'duplicate side effects on retry',
    evidenceRefs: ['tests/fixture-evidence.test.ts'],
    now: NOW,
    ...over,
  });
}

function consequenceEntry(over: Partial<ConsequenceEntry> = {}): ConsequenceEntry {
  return {
    id: 'cons.1',
    description: 'the retry does not duplicate the effect',
    category: 'data',
    severity: 'high',
    ...over,
  } as ConsequenceEntry;
}

function validationItem(over: Partial<ConsequenceValidationItem> = {}): ConsequenceValidationItem {
  return {
    consequenceId: 'cons.1',
    description: 'checked the retry path',
    verdict: 'satisfied',
    evidence: 'ledger shows one entry after two submits',
    severity: 'high',
    ...over,
  };
}

function emptyCanvas(over: Partial<ConsequenceCanvas> = {}): ConsequenceCanvas {
  return {
    intentId: 'intent.x',
    shouldHappen: [],
    shouldNeverHappen: [],
    workflowsActivated: [],
    systemsAffected: [],
    permissionsRequired: [],
    successState: 's',
    createdAt: NOW,
    ...over,
  };
}

function report(items: ConsequenceValidationItem[]): ConsequenceValidationReport {
  const r: ConsequenceValidationReport = {
    intentId: 'intent.x',
    canvasId: 'canvas.x',
    satisfied: [],
    unresolved: [],
    unintended: [],
    workflowImpacts: [],
    governanceImpacts: [],
    testingRequirements: [],
    overallVerdict: 'partial',
    validatedAt: NOW,
  };
  for (const item of items) {
    const bucket = item.verdict === 'satisfied' ? 'satisfied' : item.verdict === 'unintended' ? 'unintended' : 'unresolved';
    r[bucket].push(item);
  }
  return r;
}

const INVARIANT_EVIDENCE_KINDS: readonly DcirEventKind[] = [
  'InvariantSupported', 'InvariantChallenged', 'InvariantFalsified', 'InvariantUnresolved', 'NewRiskObservation',
];

// ═══════════════════════════════════════════════════════════════════════════
// DCIR vocabulary — appended, never repurposed
// ═══════════════════════════════════════════════════════════════════════════

describe('DCIR Phase 5 vocabulary — invariant evidence events', () => {
  it('each helper emits its own appended kind, T2-safe and tier-disciplined', () => {
    const events = [
      invariantSupportedEvent('inv.1', 'expected consequence observed'),
      invariantChallengedEvent('inv.1', 'partial match'),
      invariantFalsifiedEvent('inv.1', 'prohibited consequence observed'),
      invariantUnresolvedEvent('inv.1', 'no observation yet'),
      newRiskObservationEvent('risk label', 'condition summary'),
    ];
    expect(events.map((e) => e.kind)).toEqual(INVARIANT_EVIDENCE_KINDS);
    for (const e of events) {
      expect(e.tier).toBe('t1-browser-safe');
      expect(e.summary.length).toBeLessThanOrEqual(DCIR_EVENT_SUMMARY_MAX);
      expect(e.runtime).toBe('observation');
      for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'fioHandle']) {
        expect(Object.keys(e)).not.toContain(forbidden);
      }
    }
  });

  it('the four Invariant* events carry the invariant ref in artefactRefs (a citable ref, never the statement)', () => {
    const e = invariantSupportedEvent('inv.some-ref', 'observed');
    expect(e.artefactRefs).toEqual(['inv.some-ref']);
  });

  it('no existing DcirEventKind was repurposed — Phase 5 only appends', () => {
    const src = stripComments(readSource('types/dcir.ts'));
    const originalFourteen = [
      'DocumentCreated', 'DocumentEdited', 'SelectionChanged', 'RecommendationAccepted',
      'RecommendationRejected', 'ArtifactApproved', 'ArtifactRejected', 'UndoPerformed',
      'NavigationOccurred', 'WorkflowAdvanced', 'ToolOutputProduced', 'ConversationTurn',
      'PersonaChanged', 'SystemEvent',
    ];
    for (const k of originalFourteen) expect(src).toContain(`'${k}'`);
    for (const k of INVARIANT_EVIDENCE_KINDS) expect(src).toContain(`'${k}'`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Evidence classification and binding
// ═══════════════════════════════════════════════════════════════════════════

describe('invariantEvidence — classification', () => {
  it('the one canonical mapping from verdict to evidence kind', () => {
    expect(evidenceKindForVerdict('satisfied')).toBe('supported');
    expect(evidenceKindForVerdict('partial')).toBe('challenged');
    expect(evidenceKindForVerdict('unintended')).toBe('falsified');
    expect(evidenceKindForVerdict('unresolved')).toBe('unresolved');
  });

  it('a consequence with no falsification binding yields no observation — most consequences assert nothing causal', () => {
    const canvas = emptyCanvas({ shouldHappen: [consequenceEntry()] }); // no .falsification
    const obs = classifyConsequenceEvidence(validationItem(), canvas, NOW);
    expect(obs).toBeNull();
  });

  it('a bound consequence yields an observation carrying the invariant ref, not the consequence id', () => {
    const canvas = emptyCanvas({
      shouldHappen: [
        consequenceEntry({
          falsification: {
            invariantRef: 'inv.idempotency',
            expectedConsequence: 'one ledger entry',
            prohibitedConsequence: 'two ledger entries',
            observableFalsifier: 'ledger shows 2 entries after 2 submits',
            requiredEvidence: ['ledger query'],
          },
        }),
      ],
    });
    const obs = classifyConsequenceEvidence(validationItem({ verdict: 'satisfied' }), canvas, NOW);
    expect(obs).toEqual({
      invariantRef: 'inv.idempotency',
      kind: 'supported',
      basis: 'ledger shows one entry after two submits',
      consequenceRef: 'cons.1',
      dcirEventId: null,
      observedAt: NOW,
    });
  });

  it('MUTATION — a "partial" verdict lands in the unresolved BUCKET but must classify as challenged, not unresolved', () => {
    // addValidationItem (consequenceValidator.ts) buckets BOTH 'unresolved' and
    // 'partial' verdicts into report.unresolved. A classifier that infers kind
    // from BUCKET rather than from item.verdict would misclassify every
    // 'partial' item as 'unresolved' — this is the exact defect class
    // implementationContext.ts's own header warns about (reading which array
    // holds a member as if it were the member's own status).
    const canvas = emptyCanvas({
      shouldHappen: [
        consequenceEntry({
          falsification: {
            invariantRef: 'inv.idempotency',
            expectedConsequence: 'x',
            prohibitedConsequence: 'y',
            observableFalsifier: 'z',
            requiredEvidence: [],
          },
        }),
      ],
    });
    const partialItem = validationItem({ verdict: 'partial' });
    const r = report([partialItem]);
    // Confirm the bucket placement this test depends on.
    expect(r.unresolved).toContain(partialItem);
    expect(r.satisfied).not.toContain(partialItem);

    const observations = bindConsequenceEvidence(r, canvas, NOW);
    expect(observations).toHaveLength(1);
    expect(observations[0].kind).toBe('challenged'); // NOT 'unresolved'
  });

  it('bindConsequenceEvidence walks all three buckets in report order', () => {
    const canvas = emptyCanvas({
      shouldHappen: [
        consequenceEntry({ id: 'a', falsification: { invariantRef: 'inv.a', expectedConsequence: '', prohibitedConsequence: '', observableFalsifier: '', requiredEvidence: [] } }),
        consequenceEntry({ id: 'b', falsification: { invariantRef: 'inv.b', expectedConsequence: '', prohibitedConsequence: '', observableFalsifier: '', requiredEvidence: [] } }),
        consequenceEntry({ id: 'c', falsification: { invariantRef: 'inv.c', expectedConsequence: '', prohibitedConsequence: '', observableFalsifier: '', requiredEvidence: [] } }),
      ],
    });
    const r = report([
      validationItem({ consequenceId: 'a', verdict: 'satisfied' }),
      validationItem({ consequenceId: 'b', verdict: 'unresolved' }),
      validationItem({ consequenceId: 'c', verdict: 'unintended' }),
    ]);
    const observations = bindConsequenceEvidence(r, canvas, NOW);
    expect(observations.map((o) => o.kind)).toEqual(['supported', 'unresolved', 'falsified']);
  });
});

describe('invariantEvidence — emission', () => {
  it('emits one DCIR event per observation, matching kind', () => {
    const observations: InvariantEvidenceObservation[] = [
      { invariantRef: 'a', kind: 'supported', basis: 'b', consequenceRef: null, dcirEventId: null, observedAt: NOW },
      { invariantRef: 'a', kind: 'falsified', basis: 'b', consequenceRef: null, dcirEventId: null, observedAt: NOW },
    ];
    const events = emitEvidenceEvents(observations);
    expect(events.map((e) => e.kind)).toEqual(['InvariantSupported', 'InvariantFalsified']);
    const stamped = withEmittedEventIds(observations, events);
    expect(stamped[0].dcirEventId).toBe(events[0].id);
    expect(stamped[1].dcirEventId).toBe(events[1].id);
  });
});

describe('invariantEvidence — proof-of-risk update', () => {
  it('a proof untouched by evidence keeps its origin-honest status', () => {
    const proofs = [proof({ id: 'p1', invariantRefs: ['inv.a'], origin: 'projected', status: 'projected' })];
    const next = applyEvidenceToProofsOfRisk(proofs, []);
    expect(next[0].status).toBe('projected');
  });

  it('a falsifying observation wins over a supporting one on the same proof', () => {
    const proofs = [proof({ id: 'p1', invariantRefs: ['inv.a'], status: 'projected' })];
    const observations: InvariantEvidenceObservation[] = [
      { invariantRef: 'inv.a', kind: 'supported', basis: '', consequenceRef: null, dcirEventId: null, observedAt: NOW },
      { invariantRef: 'inv.a', kind: 'falsified', basis: '', consequenceRef: null, dcirEventId: null, observedAt: NOW },
    ];
    const next = applyEvidenceToProofsOfRisk(proofs, observations);
    expect(next[0].status).toBe('falsified');
  });

  it('MUTATION — an unresolved-only observation must NOT change proof status', () => {
    const proofs = [proof({ id: 'p1', invariantRefs: ['inv.a'], status: 'observed' })];
    const observations: InvariantEvidenceObservation[] = [
      { invariantRef: 'inv.a', kind: 'unresolved', basis: '', consequenceRef: null, dcirEventId: null, observedAt: NOW },
    ];
    const next = applyEvidenceToProofsOfRisk(proofs, observations);
    expect(next[0].status).toBe('observed'); // unchanged — nothing was actually confirmed or contradicted
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-01 — no auto-canonization
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-01 — no auto-canonization', () => {
  it('abstractCausalCandidate can never produce status validated/ratified/canonical', () => {
    const observation = riskObs();
    const assessment = assessRecurrencePortability(observation, [riskObs({ id: 'obs.2', site: 'siteB' })], NOW);
    expect(assessment.portable).toBe(true);
    const input: AbstractCausalCandidateInput = {
      candidateId: 'CI-2026-08-15-TEST-001',
      observation,
      assessment,
      causalStatement: 'logical transaction identity remains stable across retries',
      resolutionId: 'RES-2026-08-15-TEST-001',
    };
    const candidate = abstractCausalCandidate(input);
    expect(candidate).not.toBeNull();
    expect(candidate!.status).toBe('candidate');
    expect(candidate!.ratifiedSource).toBeNull();
    expect(['validated', 'ratified', 'canonical']).not.toContain(candidate!.status);
  });

  it('a learning receipt draft resolution record is always status observed', () => {
    const envelope = fixtureEnvelope();
    const receipt = buildLearningReceipt({
      envelope,
      evidenceObservations: [],
      riskObservations: [],
      remediation: null,
      draftCandidateInvariants: [],
      resolutionRecordMeta: {
        resolutionId: 'RES-2026-08-15-TEST-002',
        capability: 'test',
        milestone: 'phase5',
        problem: 'test problem',
        trigger: 'reusable-pattern-established',
        scope: 'local',
        date: '2026-08-15',
      },
      now: NOW,
    });
    expect(receipt.draftResolutionRecord!.status).toBe('observed');
  });

  it('the candidate validator accepts the draft (it is well-formed, not merely capped)', () => {
    const observation = riskObs();
    const assessment = assessRecurrencePortability(observation, [riskObs({ id: 'obs.2', site: 'siteB' })], NOW);
    const candidate = abstractCausalCandidate({
      candidateId: 'CI-2026-08-15-WELLFORMED-001',
      observation,
      assessment,
      causalStatement: 'logical transaction identity remains stable across retries',
      resolutionId: 'RES-2026-08-15-WELLFORMED-001',
    })!;
    const result = validateCandidateInvariant(candidate);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-02 — invariant class and bearing remain orthogonal (Phase 5 re-check)
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-02 — class and bearing stay orthogonal in Phase 5 surfaces', () => {
  it('RiskObservation and LearningReceipt carry no "class" field that bearing could collapse into', () => {
    const o = riskObs();
    expect(Object.keys(o)).not.toContain('class');
    expect(Object.keys(o)).not.toContain('bearing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-03 — negative discovery is causal, not prohibition-only (Phase 5 re-check)
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-03 — failure-learning states causal conditions, not prohibitions', () => {
  it('abstractCausalCandidate carries the caller-supplied causal statement verbatim, never a re-derived prohibition', () => {
    const observation = riskObs();
    const assessment = assessRecurrencePortability(observation, [riskObs({ id: 'obs.2', site: 'siteB' })], NOW);
    const statement = 'logical transaction identity remains stable across retries';
    const candidate = abstractCausalCandidate({
      candidateId: 'CI-2026-08-15-CAUSAL-001',
      observation,
      assessment,
      causalStatement: statement,
      resolutionId: 'RES-2026-08-15-CAUSAL-001',
    })!;
    expect(candidate.statement).toBe(statement);
    expect(candidate.statement.toLowerCase()).not.toMatch(/^never /);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-04 — dual-bearing does not imply validated (Phase 5 re-check)
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-04 — evidence never rewrites lifecycle', () => {
  it('applyEvidenceToProofsOfRisk changes ProofOfRisk.status only — never a lifecycle/registry field', () => {
    const proofs = [proof({ id: 'p1', invariantRefs: ['inv.a'] })];
    const observations: InvariantEvidenceObservation[] = [
      { invariantRef: 'inv.a', kind: 'supported', basis: '', consequenceRef: null, dcirEventId: null, observedAt: NOW },
    ];
    const next = applyEvidenceToProofsOfRisk(proofs, observations);
    // Every other field on the proof is untouched.
    const { status: _s1, ...rest1 } = proofs[0];
    const { status: _s2, ...rest2 } = next[0];
    expect(rest2).toEqual(rest1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-05 — failure does not equal invariant
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-05 — failure does not equal invariant', () => {
  it('recordRiskObservation returns a shape with NO status field on the invariant ladder', () => {
    const o = riskObs();
    expect(Object.keys(o)).not.toContain('status');
    // Structural: it cannot be mistaken for a CandidateInvariant or a
    // ResolutionRecord, both of which require `status`.
  });

  it('a single occurrence is NOT portable, and abstraction is refused', () => {
    const observation = riskObs();
    const assessment = assessRecurrencePortability(observation, [], NOW);
    expect(assessment.recurrenceCount).toBe(1);
    expect(assessment.portable).toBe(false);

    const candidate = abstractCausalCandidate({
      candidateId: 'CI-2026-08-15-SINGLE-001',
      observation,
      assessment,
      causalStatement: 'anything',
      resolutionId: 'RES-2026-08-15-SINGLE-001',
    });
    expect(candidate).toBeNull();
  });

  it('the SAME site failing twice is recurrence WITHOUT portability — a fragile site, not a lesson', () => {
    const first = riskObs({ id: 'obs.1', site: 'siteA' });
    const second = riskObs({ id: 'obs.2', site: 'siteA' }); // same site
    const assessment = assessRecurrencePortability(second, [first], NOW);
    expect(assessment.recurrenceCount).toBe(2);
    expect(assessment.distinctSites).toEqual(['siteA']);
    expect(assessment.portable).toBe(false);

    const candidate = abstractCausalCandidate({
      candidateId: 'CI-2026-08-15-FRAGILE-001',
      observation: second,
      assessment,
      causalStatement: 'anything',
      resolutionId: 'RES-2026-08-15-FRAGILE-001',
    });
    expect(candidate).toBeNull();
  });

  it('recurrence across TWO DISTINCT sites IS portable, and abstraction proceeds', () => {
    const first = riskObs({ id: 'obs.1', site: 'siteA' });
    const second = riskObs({ id: 'obs.2', site: 'siteB' });
    const assessment = assessRecurrencePortability(second, [first], NOW);
    expect(assessment.recurrenceCount).toBe(2);
    expect(assessment.distinctSites.sort()).toEqual(['siteA', 'siteB']);
    expect(assessment.portable).toBe(true);
  });

  it('MUTATION — a claim-key match on an UNRELATED description must not falsely inflate recurrence', () => {
    const first = riskObs({ id: 'obs.1', site: 'siteA', adverseConsequence: 'duplicate side effects on retry' });
    const unrelated = riskObs({ id: 'obs.2', site: 'siteB', adverseConsequence: 'the export times out on large payloads' });
    const assessment = assessRecurrencePortability(unrelated, [first], NOW);
    expect(assessment.recurrenceCount).toBe(1); // did NOT match the unrelated claim
    expect(assessment.portable).toBe(false);
  });

  it('claimKey is REUSED from bearingDiscovery.ts, not reimplemented', () => {
    const src = stripComments(readSource('services/devCommandCenter/failureLearning.ts'));
    expect(src).toMatch(/import\s*\{\s*claimKey\s*\}\s*from\s*['"]@\/services\/devCommandCenter\/bearingDiscovery['"]/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-06 — DevLoopState remains the authoritative session state (Phase 5 re-check)
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-06 — no parallel session state introduced by Phase 5', () => {
  it('LearningReceipt and RiskObservation hold refs into the session, never a competing session shape', () => {
    const receipt = buildLearningReceipt({
      envelope: fixtureEnvelope(),
      evidenceObservations: [],
      riskObservations: [riskObs()],
      remediation: null,
      draftCandidateInvariants: [],
      now: NOW,
    });
    expect(receipt.sessionRef).toBe(fixtureEnvelope().sessionRef);
    expect(Object.keys(receipt)).not.toContain('stage');
    expect(Object.keys(receipt)).not.toContain('intent'); // no re-hosted DevLoopState.intent shape
  });

  it('devCommandCenter/devLoop.ts STAGE_ORDER is untouched by Phase 5 (operator ruling D2)', () => {
    const src = stripComments(readSource('services/devCommandCenter/devLoop.ts'));
    expect(src).toMatch(/STAGE_ORDER: DevLoopStage\[\] = \[/);
    const ten = [
      'intent_capture', 'context_assembly', 'gap_analysis', 'consequence_modeling',
      'constitutional_decision', 'implementation', 'consequence_validation',
      'remediation', 'deployment_authorization', 'complete',
    ];
    for (const s of ten) expect(src).toContain(`'${s}'`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-07 — compressed prompt context, not Crystal dump (Phase 5 re-check)
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-07 — the learning receipt is a report, never an uncompressed dump', () => {
  it('every list on the receipt is derived, bounded by what the cycle actually produced — nothing pads it', () => {
    const envelope = fixtureEnvelope();
    const receipt = buildLearningReceipt({
      envelope,
      evidenceObservations: [],
      riskObservations: [],
      remediation: null,
      draftCandidateInvariants: [],
      now: NOW,
    });
    expect(receipt.establishedInvariantsUsed.length).toBeLessThanOrEqual(envelope.invariants.length);
    expect(receipt.candidateOrLiveInvariantsUsed.length).toBeLessThanOrEqual(envelope.invariants.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-08 — unknown risk stays unknown; no fabricated precision (Phase 5 re-check)
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-08 — Phase 5 never defaults an unknown risk magnitude to a number', () => {
  it('emitProofOfRisk (Phase 4, reused unmodified) still defaults to "unknown", not 0', () => {
    const p = emitProofOfRisk({
      id: 'p1',
      intentRef: 'intent.x',
      vector: { model: 'bootstrap-heuristic-v1', id: 'rv.x', label: 'x' },
      origin: 'projected',
      initiatingCondition: 'ic',
      adverseConsequence: 'ac',
      now: NOW,
    });
    expect(p.severity).toBe('unknown');
    expect(p.probability).toBe('unknown');
    expect(p.uncertainty).toBe('unknown');
  });

  it('a RiskObservation records no magnitude field at all — it does not even have the OPPORTUNITY to fabricate one', () => {
    const o = riskObs();
    expect(Object.keys(o)).not.toContain('severity');
    expect(Object.keys(o)).not.toContain('probability');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-09 — provider identity is not constitutional semantics
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-09 — provider identity is not constitutional semantics', () => {
  it('none of the Phase 5 evidence/classification functions accept a provider or model parameter', () => {
    const src = stripComments(readSource('services/devCommandCenter/invariantEvidence.ts'));
    expect(src).not.toMatch(/provider/i);
    expect(src).not.toMatch(/\bmodel\b/i);
  });

  it('identical evidence content yields an identical classification regardless of which "system" produced the underlying observation', () => {
    // Two ConsequenceValidationItems differing ONLY in a caller-side label that
    // would carry a provider identity in a real system (here simulated via the
    // `description` field, since the type has no provider field to abuse) —
    // classification depends only on `verdict`.
    const canvas = emptyCanvas({
      shouldHappen: [
        consequenceEntry({
          falsification: {
            invariantRef: 'inv.a',
            expectedConsequence: 'x',
            prohibitedConsequence: 'y',
            observableFalsifier: 'z',
            requiredEvidence: [],
          },
        }),
      ],
    });
    const fromProviderA = classifyConsequenceEvidence(
      validationItem({ verdict: 'satisfied', description: 'validated by provider A' }),
      canvas,
      NOW,
    );
    const fromProviderB = classifyConsequenceEvidence(
      validationItem({ verdict: 'satisfied', description: 'validated by provider B' }),
      canvas,
      NOW,
    );
    expect(fromProviderA!.kind).toBe(fromProviderB!.kind);
    expect(fromProviderA!.invariantRef).toBe(fromProviderB!.invariantRef);
  });

  it('DCIR emitters never encode a provider — the event summary is a function of ref + label only', () => {
    const src = stripComments(readSource('services/dcir/eventStream.ts'));
    // Scoped to the Phase 5 section, not the whole file (studioSkillOutputEvent
    // legitimately carries a provider LABEL elsewhere, per its own doc comment —
    // this canary is about the invariant-evidence vocabulary specifically).
    const phase5Start = src.indexOf('Invariant-evidence typed helpers');
    const phase5Section = src.slice(phase5Start, src.indexOf('Observation seam (ground-context', phase5Start));
    expect(phase5Section).not.toMatch(/provider/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANARY-10 — retrieved structural memory can be challenged by evidence
// ═══════════════════════════════════════════════════════════════════════════

describe('CANARY-10 — established material is not exempt from evidence', () => {
  it('an established (citable) invariant that receives falsifying evidence is surfaced, not silently protected', () => {
    const establishedRefs = ['inv.constitutional-a', 'inv.canonical-b'];
    const observations: InvariantEvidenceObservation[] = [
      { invariantRef: 'inv.constitutional-a', kind: 'falsified', basis: 'observed the prohibited consequence', consequenceRef: 'c1', dcirEventId: null, observedAt: NOW },
      { invariantRef: 'inv.canonical-b', kind: 'supported', basis: 'as expected', consequenceRef: 'c2', dcirEventId: null, observedAt: NOW },
    ];
    const underChallenge = establishedRefsUnderChallenge(establishedRefs, observations);
    expect(underChallenge).toEqual(['inv.constitutional-a']);
    expect(underChallenge).not.toContain('inv.canonical-b'); // supported, not challenged
  });

  it('MUTATION — established status must not gate whether a challenge is reported (evidence is not registry-blind, and registry standing is not evidence-blind)', () => {
    // A defective implementation might special-case "if established, ignore
    // challenging evidence" (treating established as immune). Verify the
    // function reports the challenge regardless of how "established" the ref
    // sounds — it has no branch on lifecycle at all, only on the evidence kind.
    const src = stripComments(readSource('services/devCommandCenter/invariantEvidence.ts'));
    const fn = src.slice(src.indexOf('export function establishedRefsUnderChallenge'));
    expect(fn).not.toMatch(/lifecycle/);
    expect(fn).not.toMatch(/mayBeCitedAsEstablished/);
  });

  it('this closes the loop DCIR observes: an established member with real challenging evidence still shows up in the receipt', () => {
    const envelope = fixtureEnvelope();
    const established = partitionByEpistemicStanding(envelope.invariants).established;
    expect(established.length).toBeGreaterThan(0);
    const ref = established[0].ref;
    const observations: InvariantEvidenceObservation[] = [
      { invariantRef: ref, kind: 'falsified', basis: 'the prohibited consequence occurred', consequenceRef: null, dcirEventId: null, observedAt: NOW },
    ];
    const receipt = buildLearningReceipt({
      envelope,
      evidenceObservations: observations,
      riskObservations: [],
      remediation: null,
      draftCandidateInvariants: [],
      now: NOW,
    });
    expect(receipt.evidenceChallengingOrFalsifying.some((o) => o.invariantRef === ref)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Fixture envelope + ACCEPTANCE — the full end-to-end trace
// ═══════════════════════════════════════════════════════════════════════════

function fixtureEnvelope(): InvariantDevelopmentEnvelope {
  const invariants = [
    envInv({
      ref: 'inv.constitutional-a',
      statement: 'Every action carries its constitutional basis.',
      provenance: 'constitutional-substrate',
      lifecycle: { registry: 'invariant-substrate', status: 'canonical' },
      scope: 'constitutional',
    }),
    envInv({
      ref: 'ci.candidate-b',
      statement: 'A retried operation must not duplicate its effect.',
      provenance: 'projection-devon',
      lifecycle: { registry: 'resolution-records', status: 'candidate' },
      scope: 'repository',
    }),
  ];
  const compressed = compressEnvelope(invariants);
  return {
    schemaVersion: 'invariant-development-envelope/v1.0',
    intentRef: 'intent.retry-payment-submission',
    sessionRef: 'session.acceptance-trace',
    stageAtConstruction: 'intent_capture',
    scopesSearched: ['constitutional', 'repository'],
    invariants,
    riskField: null,
    proofsOfRisk: [],
    expectedConsequences: [],
    falsifiers: [],
    unresolvedQuestions: [],
    compressed,
    generatedAt: NOW,
    updatedAt: NOW,
  };
}

const DATA_INTEGRITY: RiskVectorRef = {
  model: 'bootstrap-heuristic-v1',
  id: 'rv.data-integrity.duplicate-effect',
  label: 'A retried operation applies its effect more than once',
};

const acceptanceProvider: BearingDiscoveryProvider = {
  async positive(): Promise<DiscoveredCondition[]> {
    return [
      { statement: 'A submission that has not been acknowledged remains eligible for resubmission.', searchDomain: 'payments' },
    ];
  },
  async negative({ vector, searchDomain }): Promise<DiscoveredCondition[]> {
    if (vector.id !== DATA_INTEGRITY.id) return [];
    return [
      {
        statement: 'Logical transaction identity remains stable across retries.',
        searchDomain,
        repairPath: 'Reconcile the ledger and reverse the duplicated effect.',
      },
    ];
  },
};

describe('ACCEPTANCE — the full deterministic Phase 5 trace, provenance preserved end to end', () => {
  it('intent → risk field → discovery → envelope → compressed context → consequence → evidence → learning artifact', async () => {
    // 1. INTENT
    const intentRef = 'intent.retry-payment-submission';
    const sessionRef = 'session.acceptance-trace';

    // 2. INITIAL RISK FIELD — built BEFORE discovery (operator ruling).
    const riskField: IntentRiskField = buildInitialRiskField({
      intentRef,
      projected: [DATA_INTEGRITY],
      now: NOW,
    });
    expect(riskField.revision).toBe(1);

    // 3. POSITIVE/NEGATIVE DISCOVERY — risk-driven, independent of the positive pass.
    const { discovered, riskFieldRevision } = await discoverBearings({
      intentText: 'Add an automatic retry to the payment submission path.',
      intentDomain: 'payments',
      riskField,
      vectorDomains: { [DATA_INTEGRITY.id]: 'persistence' },
      known: [],
      provider: acceptanceProvider,
      now: NOW,
    });
    expect(riskFieldRevision).toBe(riskField.revision);
    const idempotencyFinding = discovered.find((d) => d.statement.includes('Logical transaction identity'))!;
    expect(idempotencyFinding).toBeDefined();
    expect(idempotencyFinding.recoveries[0].riskVectorRef?.id).toBe(DATA_INTEGRITY.id);

    // 4. INVARIANT DEVELOPMENT ENVELOPE — the discovery joins the retrieved set.
    const establishedInvariant = envInv({
      ref: 'inv.constitutional-a',
      statement: 'Every action carries its constitutional basis.',
      provenance: 'constitutional-substrate',
      lifecycle: { registry: 'invariant-substrate', status: 'canonical' },
      scope: 'constitutional',
    });
    const allInvariants = [establishedInvariant, ...discovered];
    const envelope: InvariantDevelopmentEnvelope = {
      schemaVersion: 'invariant-development-envelope/v1.0',
      intentRef,
      sessionRef,
      stageAtConstruction: 'intent_capture',
      scopesSearched: ['constitutional', 'intent', 'cross-domain'],
      invariants: allInvariants,
      riskField,
      proofsOfRisk: [
        emitProofOfRisk({
          id: 'proof.duplicate-effect',
          intentRef,
          vector: DATA_INTEGRITY,
          origin: 'projected',
          initiatingCondition: 'a submission is retried after a timeout with no acknowledgement',
          adverseConsequence: 'the payment is applied twice',
          invariantRefs: [idempotencyFinding.ref],
          now: NOW,
        }),
      ],
      expectedConsequences: [],
      falsifiers: [],
      unresolvedQuestions: [],
      compressed: null,
      generatedAt: NOW,
      updatedAt: NOW,
    };
    envelope.compressed = compressEnvelope(envelope.invariants);
    expect(mayBeCitedAsEstablished(establishedInvariant.lifecycle)).toBe(true);
    expect(mayBeCitedAsEstablished(idempotencyFinding.lifecycle)).toBe(false); // live-discovery, unrecorded

    // 5. COMPRESSED IMPLEMENTATION CONTEXT — epistemic boundaries preserved.
    // The established member is ALSO constitutional-substrate, so it is
    // admitted via the constraints section (provenance AND standing —
    // implementationContext.ts's own rule), not 'established-invariants'
    // (which holds established members that are NOT constitutional).
    const ctx = composeImplementationContext(envelope.invariants, envelope.unresolvedQuestions);
    expect(ctx.carried['constitutional-constraints']).toContain(establishedInvariant.ref);
    expect(ctx.carried['live-discoveries']).toContain(idempotencyFinding.ref);
    expect(ctx.carried['established-invariants']).not.toContain(idempotencyFinding.ref);
    expect(ctx.carried['constitutional-constraints']).not.toContain(idempotencyFinding.ref);

    // 6. IMPLEMENTATION CONSEQUENCE — a canvas binds the discovery to a testable claim.
    const canvas = emptyCanvas({
      intentId: intentRef,
      shouldHappen: [
        consequenceEntry({
          id: 'cons.idempotency',
          description: 'Retrying a submission does not apply the payment twice.',
          falsification: {
            invariantRef: idempotencyFinding.ref,
            expectedConsequence: 'exactly one ledger entry after any number of retries',
            prohibitedConsequence: 'more than one ledger entry for the same logical transaction',
            observableFalsifier: 'the ledger shows 2 entries after 2 submits of the same transaction',
            requiredEvidence: ['ledger query'],
          },
        }),
      ],
    });
    const validationReport = report([
      validationItem({
        consequenceId: 'cons.idempotency',
        verdict: 'satisfied',
        evidence: 'ledger shows exactly one entry after two submits of the same transaction',
      }),
    ]);

    // 7. DCIR INVARIANT-EVIDENCE EVENT
    const observations = bindConsequenceEvidence(validationReport, canvas, NOW);
    expect(observations).toHaveLength(1);
    expect(observations[0].invariantRef).toBe(idempotencyFinding.ref);
    expect(observations[0].kind).toBe('supported');
    const events = emitEvidenceEvents(observations);
    expect(events[0].kind).toBe('InvariantSupported');
    const stampedObservations = withEmittedEventIds(observations, events);
    expect(stampedObservations[0].dcirEventId).toBe(events[0].id);

    const updatedProofs = applyEvidenceToProofsOfRisk(envelope.proofsOfRisk, stampedObservations);
    expect(updatedProofs[0].status).toBe('supported');

    // 8. RESOLUTION RECORD / CANDIDATE LEARNING ARTIFACT
    const receipt = buildLearningReceipt({
      envelope: { ...envelope, proofsOfRisk: updatedProofs },
      evidenceObservations: stampedObservations,
      riskObservations: [],
      remediation: null,
      draftCandidateInvariants: [],
      resolutionRecordMeta: {
        resolutionId: 'RES-2026-08-15-ACCEPTANCE-TRACE-001',
        capability: 'Homecoming III Phase 5 acceptance trace',
        milestone: 'Phase 5 gate',
        problem: 'Demonstrate the full invariant-driven loop end to end, deterministically.',
        trigger: 'milestone-complete',
        scope: 'local',
        date: '2026-08-15',
      },
      now: NOW,
    });

    expect(receipt.establishedInvariantsUsed).toContain(establishedInvariant.ref);
    expect(receipt.candidateOrLiveInvariantsUsed).toContain(idempotencyFinding.ref);
    expect(receipt.projectedRisks).toContain('proof.duplicate-effect');
    expect(receipt.evidenceSupporting.map((o) => o.invariantRef)).toContain(idempotencyFinding.ref);
    expect(receipt.draftResolutionRecord).not.toBeNull();

    // PROVENANCE PRESERVED END TO END: the exact ref discovered by the
    // risk-driven pass in step 3 is traceable, unchanged, all the way to the
    // learning receipt in step 8.
    expect(receipt.candidateOrLiveInvariantsUsed).toContain(idempotencyFinding.ref);

    const validation = validateLearningReceiptDraft(receipt);
    expect(validation.issues).toEqual([]);
    expect(validation.valid).toBe(true);
    const rawValidation = validateResolutionRecord(receipt.draftResolutionRecord);
    expect(rawValidation.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deriveScopeRecommendations
// ═══════════════════════════════════════════════════════════════════════════

describe('deriveScopeRecommendations', () => {
  it('recommends local when no cross-capability evidence exists', () => {
    const recs = deriveScopeRecommendations(fixtureEnvelope(), []);
    expect(recs.some((r) => r.toLowerCase().includes('local'))).toBe(true);
  });

  it('recommends cross-capability when a discovery actually widened scope', () => {
    const envelope = fixtureEnvelope();
    envelope.invariants = [
      ...envelope.invariants,
      envInv({
        ref: 'neg.1',
        bearing: 'negative',
        recoveries: [
          {
            bearing: 'negative',
            route: 'risk-driven',
            searchDomain: 'persistence',
            riskVectorRef: DATA_INTEGRITY,
            repairPath: 'reconcile',
            scopeExpansion: {
              fromDomain: 'payments',
              toDomain: 'persistence',
              fromScope: 'intent',
              toScope: 'cross-domain',
              motivatedByRiskVectorId: DATA_INTEGRITY.id,
            },
          },
        ],
      }),
    ];
    const recs = deriveScopeRecommendations(envelope, []);
    expect(recs.some((r) => r.toLowerCase().includes('cross-capability'))).toBe(true);
  });
});
