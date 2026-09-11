/**
 * Homecoming III Phase 6 — post-implementation DCIR observation, consequence
 * validation, and the learning receipt. Continues
 * `scripts/homecoming-iii-phase6-dogfood.ts` after the real implementation
 * (types/contextBinding.ts + its 7-test canary, commit 4db726815) exists and
 * its tests were actually run.
 *
 * Every verdict below reflects the REAL test run (`npx vitest run
 * tests/context-binding-axis-scope.test.ts`, 7/7 passed) — not an assumed
 * outcome.
 */

import { writeFileSync, readFileSync } from 'fs';
import {
  classifyConsequenceEvidence,
  bindConsequenceEvidence,
  emitEvidenceEvents,
  withEmittedEventIds,
  applyEvidenceToProofsOfRisk,
  establishedRefsUnderChallenge,
} from '../services/devCommandCenter/invariantEvidence';
import {
  recordRiskObservation,
  assessRecurrencePortability,
  abstractCausalCandidate,
} from '../services/devCommandCenter/failureLearning';
import { buildLearningReceipt, validateLearningReceiptDraft } from '../services/devCommandCenter/learningReceipt';
import { newRiskObservationEvent } from '../services/dcir/eventStream';
import { bindFalsification } from '../services/devCommandCenter/implementationContext';
import type { ConsequenceCanvas, ConsequenceValidationReport } from '../types/devCommandCenter';
import type { ProofOfRisk } from '../types/invariantEnvelope';

const NOW = '2026-08-15T00:00:00.000Z';
const INTENT_ID = 'intent-phase6-crystal2-contextbinding-scope';
const SESSION_ID = 'dls-phase6-dogfood';

// ---------------------------------------------------------------------------
// Consequence canvas — the 3 negative-pass discoveries bound to falsifiers
// (positive-pass items are ordinary; they assert no causal proposition).
// ---------------------------------------------------------------------------

let canvas: ConsequenceCanvas = {
  intentId: INTENT_ID,
  shouldHappen: [
    { id: 'c-pinned-order', description: 'Six-rung order is pinned and canary-asserted', category: 'workflow', severity: 'medium' },
    { id: 'c-ruling-xref', description: 'File cross-references the authorizing ruling', category: 'governance', severity: 'low' },
    { id: 'c-schema-version', description: 'Schema version follows repo convention', category: 'workflow', severity: 'low' },
  ],
  shouldNeverHappen: [
    { id: 'c-import-coupling', description: 'Context-binding module imports from types/invariantEnvelope.ts', category: 'governance', severity: 'high' },
    { id: 'c-t0-leak', description: 'A T0-forbidden identifier key name appears in the contract', category: 'governance', severity: 'critical' },
    { id: 'c-premature-adoption', description: 'A non-test production module imports the new contract', category: 'governance', severity: 'medium' },
  ],
  workflowsActivated: ['devon-live-discovery'],
  systemsAffected: ['types/contextBinding.ts'],
  permissionsRequired: [],
  successState: 'The contract exists, is canary-protected, and is not yet adopted anywhere.',
  createdAt: NOW,
};

canvas = {
  ...canvas,
  shouldNeverHappen: canvas.shouldNeverHappen.map((entry) => {
    const bindingByRef: Record<string, { invariantRef: string; expectedConsequence: string; prohibitedConsequence: string; observableFalsifier: string; requiredEvidence: string[] }> = {
      'c-import-coupling': {
        invariantRef: 'neg-0',
        expectedConsequence: 'No import statement in types/contextBinding.ts references types/invariantEnvelope.ts or InvariantScope',
        prohibitedConsequence: 'An import statement couples the two ladders',
        observableFalsifier: 'grep for a line-anchored `import` statement naming invariantEnvelope or InvariantScope',
        requiredEvidence: ['tests/context-binding-axis-scope.test.ts'],
      },
      'c-t0-leak': {
        invariantRef: 'neg-1',
        expectedConsequence: 'findForbiddenStateKey returns null against the contract source',
        prohibitedConsequence: 'findForbiddenStateKey matches a forbidden T0 key name',
        observableFalsifier: 'run findForbiddenStateKey against the serialized contract source',
        requiredEvidence: ['tests/context-binding-axis-scope.test.ts'],
      },
      'c-premature-adoption': {
        invariantRef: 'neg-2',
        expectedConsequence: 'Zero non-test files under app/services/components/hooks/utils import the contract',
        prohibitedConsequence: 'A production module imports the contract',
        observableFalsifier: 'walk the repo and grep for an import of @/types/contextBinding',
        requiredEvidence: ['tests/context-binding-axis-scope.test.ts'],
      },
    };
    const b = bindingByRef[entry.id];
    return b ? bindFalsification(entry, b) : entry;
  }),
};

// ---------------------------------------------------------------------------
// Consequence validation — REAL verdicts from the REAL test run (7/7 passed)
// ---------------------------------------------------------------------------

const validationReport: ConsequenceValidationReport = {
  intentId: INTENT_ID,
  canvasId: 'canvas-phase6-dogfood',
  satisfied: [
    { consequenceId: 'c-pinned-order', description: canvas.shouldHappen[0].description, verdict: 'satisfied', evidence: 'tests/context-binding-axis-scope.test.ts — "pins the six-rung order exactly" passed', severity: 'medium' },
    { consequenceId: 'c-ruling-xref', description: canvas.shouldHappen[1].description, verdict: 'satisfied', evidence: 'tests/context-binding-axis-scope.test.ts — "cross-references the operator ruling" passed', severity: 'low' },
    { consequenceId: 'c-schema-version', description: canvas.shouldHappen[2].description, verdict: 'satisfied', evidence: 'tests/context-binding-axis-scope.test.ts — "schema version follows the repo convention" passed', severity: 'low' },
    { consequenceId: 'c-import-coupling', description: canvas.shouldNeverHappen[0].description, verdict: 'satisfied', evidence: 'tests/context-binding-axis-scope.test.ts — "does not import from types/invariantEnvelope.ts" passed', severity: 'high' },
    { consequenceId: 'c-t0-leak', description: canvas.shouldNeverHappen[1].description, verdict: 'satisfied', evidence: 'tests/context-binding-axis-scope.test.ts — "contains no T0-forbidden identifier key name" passed', severity: 'critical' },
    { consequenceId: 'c-premature-adoption', description: canvas.shouldNeverHappen[2].description, verdict: 'satisfied', evidence: 'tests/context-binding-axis-scope.test.ts — "has zero non-test production importers" passed', severity: 'medium' },
  ],
  unresolved: [],
  unintended: [],
  workflowImpacts: [],
  governanceImpacts: [],
  testingRequirements: [],
  overallVerdict: 'pass',
  validatedAt: NOW,
};

// ---------------------------------------------------------------------------
// Bind evidence back to the envelope (real invariantEvidence.ts functions)
// ---------------------------------------------------------------------------

const observations = bindConsequenceEvidence(validationReport, canvas, NOW);
const events = emitEvidenceEvents(observations);
const stampedObservations = withEmittedEventIds(observations, events);

const proofsOfRisk: ProofOfRisk[] = [
  { id: 'por-rv1', intentRef: INTENT_ID, riskVectorRef: { model: 'bootstrap-heuristic-v1', id: 'rv-scope-context-binding-reopen', label: 'reopen risk' }, origin: 'projected', invariantRefs: ['neg-0'], initiatingCondition: 'x', adverseConsequence: 'x', severity: 'unknown', probability: 'unknown', uncertainty: 'unknown', repairPath: null, reversibility: 'unknown', blastRadius: null, evidenceRefs: [], status: 'projected', createdAt: NOW },
  { id: 'por-rv2', intentRef: INTENT_ID, riskVectorRef: { model: 'bootstrap-heuristic-v1', id: 'rv-t0-identifier-leak', label: 't0 leak risk' }, origin: 'projected', invariantRefs: ['neg-1'], initiatingCondition: 'x', adverseConsequence: 'x', severity: 'unknown', probability: 'unknown', uncertainty: 'unknown', repairPath: null, reversibility: 'unknown', blastRadius: null, evidenceRefs: [], status: 'projected', createdAt: NOW },
  { id: 'por-rv3', intentRef: INTENT_ID, riskVectorRef: { model: 'bootstrap-heuristic-v1', id: 'rv-premature-wiring', label: 'premature wiring risk' }, origin: 'projected', invariantRefs: ['neg-2'], initiatingCondition: 'x', adverseConsequence: 'x', severity: 'unknown', probability: 'unknown', uncertainty: 'unknown', repairPath: null, reversibility: 'unknown', blastRadius: null, evidenceRefs: [], status: 'projected', createdAt: NOW },
];
const updatedProofs = applyEvidenceToProofsOfRisk(proofsOfRisk, stampedObservations);
const challenged = establishedRefsUnderChallenge(
  ['CI-2026-08-03-ACTOR-SUBJECT-OWNER-001', 'CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001', 'CI-2026-08-03-TTV-TTR-OBJECTIVE-001'],
  stampedObservations,
);

// ---------------------------------------------------------------------------
// The new risk observation — the compression crowding-out defect this run
// SURFACED, unprompted. This is the one genuinely new material finding.
// CANARY-05: a single occurrence NEVER auto-promotes to a candidate.
// ---------------------------------------------------------------------------

const riskObservation = recordRiskObservation({
  id: 'ro-phase6-compression-crowdout',
  intentRef: INTENT_ID,
  sessionRef: SESSION_ID,
  site: 'services/devCommandCenter/implementationContext.ts::composeImplementationContext (+ invariantEnvelope.ts::compressEnvelope)',
  description:
    'Live discovery (6/6 items) was entirely crowded out of the compressed implementation context, and the ' +
    'single most on-point registered candidate (CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001) was omitted while ' +
    'several unrelated (Pulse/P&L/RootDID) candidates were carried instead — observed live against the real, ' +
    '33-member devon-projected candidate registry.',
  initiatingCondition:
    'The devon-projected candidate population (33, all materiality "unknown") exceeds the non-established ' +
    'compression budget (9 remaining of 12 after 3 established) with no per-task relevance discount applied ' +
    'before the fixed established→signals→discoveries partition order allocates it.',
  adverseConsequence:
    'Genuinely relevant live discoveries and the single most relevant registered candidate are silently absent ' +
    'from the prompt that would reach an implementer, while less-relevant unrelated-subsystem candidates are ' +
    'carried in their place.',
  relatedRiskVectorId: null, // genuinely NEW — not one of this run's projected vectors
  evidenceRefs: ['codexes/packs/agentiq/updates/2026-08-15_phase6-dogfood-trace.json'],
  now: NOW,
});

const portability = assessRecurrencePortability(riskObservation, [], NOW); // first occurrence — no priors
const candidate = abstractCausalCandidate({
  candidateId: 'ro-phase6-compression-crowdout-candidate', // will be null: portability.portable is false
  observation: riskObservation,
  assessment: portability,
  causalStatement: 'n/a — not reached, portable is false',
  resolutionId: 'n/a',
});

// ---------------------------------------------------------------------------
// The learning receipt
// ---------------------------------------------------------------------------

const envelopeForReceipt = JSON.parse(
  readFileSync('codexes/packs/agentiq/updates/2026-08-15_phase6-dogfood-trace.json', 'utf-8'),
);

// The DCIR event for the new risk observation itself (requirement 1's fifth
// appended kind) — distinct from the four InvariantEvidenceKind emitters.
const newRiskEvent = newRiskObservationEvent(riskObservation.id, riskObservation.description);

const receipt = buildLearningReceipt({
  envelope: {
    schemaVersion: 'invariant-development-envelope/v1.0',
    intentRef: INTENT_ID,
    sessionRef: SESSION_ID,
    stageAtConstruction: 'intent_capture',
    scopesSearched: envelopeForReceipt.envelopeAsRetrieved.scopesSearched,
    invariants: [...envelopeForReceipt.envelopeAsRetrieved.invariants, ...envelopeForReceipt.discovery.discovered],
    riskField: envelopeForReceipt.riskField,
    proofsOfRisk: updatedProofs,
    expectedConsequences: [],
    falsifiers: [],
    unresolvedQuestions: [],
    compressed: null,
    generatedAt: NOW,
    updatedAt: NOW,
  },
  evidenceObservations: stampedObservations,
  riskObservations: [riskObservation],
  remediation: null,
  draftCandidateInvariants: candidate ? [candidate] : [],
  resolutionRecordMeta: {
    resolutionId: 'RES-2026-08-15-PHASE6-COMPRESSION-CROWDOUT-001',
    capability: 'Homecoming III — invariant-driven DevOn + IDE 2.0 kernel',
    milestone: 'Phase 6 — live dogfood',
    problem:
      'Live-model dogfood of the full retrieval→discovery→compression chain against the REAL, 33-member devon ' +
      'candidate registry found that live discovery and the single most relevant registered candidate are ' +
      'silently crowded out of the compressed implementation context by relevance-blind, fixed-priority budget allocation.',
    trigger: 'invariant-incomplete-or-misscoped',
    scope: 'local',
    date: '2026-08-15',
  },
  now: NOW,
});

const receiptValidation = validateLearningReceiptDraft(receipt);

writeFileSync(
  'codexes/packs/agentiq/updates/2026-08-15_phase6-learning-receipt.json',
  JSON.stringify(
    { receipt, riskObservation, portability, candidateProduced: candidate, challengedEstablishedRefs: challenged, receiptValidation, dcirEvents: [...events, newRiskEvent] },
    null,
    2,
  ) + '\n',
);

console.log('=== CONSEQUENCE EVIDENCE ===');
for (const o of stampedObservations) console.log(' -', o.kind, o.invariantRef, '::', o.basis.slice(0, 80));
console.log('\nchallenged established refs (should be empty — nothing challenged this run):', challenged);
console.log('\n=== RISK OBSERVATION (new, unprompted) ===');
console.log(riskObservation.description);
console.log('\nportability:', portability);
console.log('candidate produced (should be null — single occurrence, CANARY-05):', candidate);
console.log('\n=== LEARNING RECEIPT VALIDATION ===');
console.log(receiptValidation);
console.log('\nWritten to codexes/packs/agentiq/updates/2026-08-15_phase6-learning-receipt.json');
