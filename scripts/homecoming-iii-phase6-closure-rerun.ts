/**
 * Homecoming III Phase 6 Closure — rerun of the UNALTERED Crystal 2.0 dogfood
 * intent (`scripts/homecoming-iii-phase6-dogfood.ts`) against the REPAIRED
 * `composeImplementationContext`. Every intent field, risk vector, and
 * discovery statement below is copied VERBATIM from the original script —
 * nothing about the acceptance task changed after seeing the prior result.
 * The only addition is the `CausalRelevanceContext` the repair consumes,
 * derived the same way any real caller would: from the intent's own text,
 * the envelope's unresolved questions, and `deriveRiskDrivenRefs` over the
 * REAL proofs of risk against the REAL current risk field.
 */

import { writeFileSync } from 'fs';
import { createDevLoopSession } from '../services/devCommandCenter/devLoop';
import { buildInvariantEnvelope, rankByMateriality } from '../services/devCommandCenter/invariantEnvelope';
import {
  buildInitialRiskField,
  discoverBearings,
  type BearingDiscoveryProvider,
  type DiscoveredCondition,
} from '../services/devCommandCenter/bearingDiscovery';
import { emitProofOfRisk, composeImplementationContext, deriveRiskDrivenRefs } from '../services/devCommandCenter/implementationContext';
import type { StructuredDevIntent } from '../types/devCommandCenter';
import type { RiskVectorRef } from '../types/invariantEnvelope';

const NOW = '2026-08-15T00:00:00.000Z';

// --- VERBATIM from scripts/homecoming-iii-phase6-dogfood.ts ---------------

const intent: StructuredDevIntent = {
  intentId: 'intent-phase6-crystal2-contextbinding-scope',
  rawInput:
    'Use DevOn to scope the first internal Crystal 2.0 implementation assignment: a contract-first ' +
    'type definition for the context-binding axis recorded as a design requirement in ' +
    'RES-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001, without implementing enforcement or wiring it ' +
    'to any live surface.',
  goal:
    'Scope and stub the first internal Crystal 2.0 implementation assignment: a contract-first type ' +
    'definition for the context-binding axis (platform / workspace / project / developer / ' +
    'principal-user / session-intent).',
  users: ['devon', 'future-context-binding-consumers'],
  constraints: [
    'Must not add personaId/rootDid/authProfileId/fioHandle/kybeAttestation or any other T0 identifier to the new contract',
    'Must not extend INVARIANT_SCOPES or otherwise represent context binding as a causal scope',
    'Must not wire the new contract into DevLoopState or any live runtime surface in this assignment',
    'Contract-first only — no enforcement runtime, no persistence mechanism, in this assignment',
  ],
  desiredOutcomes: [
    'A durable, reviewable type contract exists for the context-binding axis',
    'Future DevOn/Crystal work has a named place to attach authorized context binding without reopening Phase 1 contracts',
  ],
  successCriteria: [
    'types/contextBinding.ts exists with the six-rung axis pinned as data',
    'No T0-identifier-shaped field name appears in the new file',
    'A canary pins the six-rung order and the import-graph/adoption boundaries discovered this run',
    'npm run report:resolutions remains clear',
  ],
  relatedVentures: [],
  relatedCartridges: ['devon'],
  priority: 'medium',
  status: 'approved',
  createdAt: NOW,
  updatedAt: NOW,
};

async function main() {
  const session = createDevLoopSession();

  const envelope = await buildInvariantEnvelope(intent, session.sessionId, {
    domains: ['devon', 'agentic-development'],
    now: NOW,
  });

  const RV1: RiskVectorRef = {
    model: 'bootstrap-heuristic-v1',
    id: 'rv-scope-context-binding-reopen',
    label: 'Stubbing the axis re-litigates or blurs the just-ruled scope/context-binding boundary',
  };
  const RV2: RiskVectorRef = {
    model: 'bootstrap-heuristic-v1',
    id: 'rv-t0-identifier-leak',
    label: "A 'developer'/'principal-user' rung invites a raw T0 identifier field by convenience",
  };
  const RV3: RiskVectorRef = {
    model: 'bootstrap-heuristic-v1',
    id: 'rv-premature-wiring',
    label: 'The contract existing gets silently adopted by a live surface before authorization/enforcement exists',
  };

  const riskField = buildInitialRiskField({
    intentRef: intent.intentId,
    projected: [RV1, RV2, RV3],
    now: NOW,
  });

  const proofsOfRisk = [
    emitProofOfRisk({
      id: 'por-rv1',
      intentRef: intent.intentId,
      vector: RV1,
      origin: 'projected',
      initiatingCondition: 'The new contract is read alongside INVARIANT_SCOPES by a future agent',
      adverseConsequence: 'A future change couples or conflates the causal scope ladder with context binding',
      now: NOW,
    }),
    emitProofOfRisk({
      id: 'por-rv2',
      intentRef: intent.intentId,
      vector: RV2,
      origin: 'projected',
      initiatingCondition: 'A rung value or field is named for convenience without checking T0 discipline',
      adverseConsequence: 'A T0 identifier reaches a T2/T1-bound contract',
      now: NOW,
    }),
    emitProofOfRisk({
      id: 'por-rv3',
      intentRef: intent.intentId,
      vector: RV3,
      origin: 'projected',
      initiatingCondition: 'Another surface imports the new contract before enforcement exists',
      adverseConsequence: 'A recorded design requirement becomes live, unauthorized wiring without review',
      now: NOW,
    }),
  ];

  const provider: BearingDiscoveryProvider = {
    async positive(): Promise<DiscoveredCondition[]> {
      return [
        {
          statement:
            "The context-binding axis's six rungs exist as one pinned, ordered array of string " +
            'literals whose exact sequence a canary asserts — never a free-form string a caller could ' +
            'mistype.',
          searchDomain: 'devon',
        },
        {
          statement:
            'Every future reader of the context-binding contract can trace it back to the ruling that ' +
            'authorized it, via an in-file cross-reference to RES/CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001.',
          searchDomain: 'devon',
        },
        {
          statement:
            "The contract's schema version follows the repo's existing " +
            '`<kebab-domain-slug>/v<major>.<minor>` convention, so a future enforcement layer can extend ' +
            'it by version rather than by silent shape drift.',
          searchDomain: 'devon',
        },
      ];
    },
    async negative(input): Promise<DiscoveredCondition[]> {
      switch (input.vector.id) {
        case 'rv-scope-context-binding-reopen':
          return [
            {
              statement:
                "The context-binding module's import graph remains independent of " +
                "`types/invariantEnvelope.ts`'s `InvariantScope` export, so a change to either can never " +
                'silently couple to the other.',
              searchDomain: 'constitutional-computing',
              repairPath: 'A canary asserts the new file imports nothing from types/invariantEnvelope.ts',
            },
          ];
        case 'rv-t0-identifier-leak':
          return [
            {
              statement:
                'No field name or rung value in the context-binding contract lexically collides with any ' +
                'T0 key name already forbidden on DevLoopState, checked by the SAME predicate technique ' +
                '`findForbiddenStateKey` already applies rather than a second, independently-tuned check.',
              searchDomain: 'identity-spine',
              repairPath: "Reuse findForbiddenStateKey against the new file's own source text in a canary",
            },
          ];
        case 'rv-premature-wiring':
          return [
            {
              statement:
                'At the close of this assignment, zero non-test production module imports the ' +
                'context-binding contract — its existence is not yet its adoption.',
              searchDomain: 'repository',
              repairPath: 'A canary greps the repo for non-test importers of the new file and asserts none exist',
            },
          ];
        default:
          return [];
      }
    },
  };

  const vectorDomains: Record<string, string> = {
    'rv-scope-context-binding-reopen': 'constitutional-computing',
    'rv-t0-identifier-leak': 'identity-spine',
    'rv-premature-wiring': 'repository',
  };

  const discovery = await discoverBearings({
    intentText: intent.goal,
    intentDomain: 'devon',
    riskField,
    vectorDomains,
    known: envelope.invariants,
    provider,
    now: NOW,
  });

  const merged = rankByMateriality([...envelope.invariants, ...discovery.discovered]);

  // --- END VERBATIM ---------------------------------------------------------
  // NEW for the Closure: the causal-relevance context the repair consumes.

  const relevance = {
    intentText: `${intent.goal} ${intent.rawInput} ${intent.desiredOutcomes.join(' ')}`,
    unresolvedText: envelope.unresolvedQuestions.join(' '),
    riskDrivenRefs: deriveRiskDrivenRefs(proofsOfRisk, riskField),
  };

  const compressedBefore = composeImplementationContext(merged, envelope.unresolvedQuestions); // no context — reproduces the PRIOR (broken) run exactly
  const compressedAfter = composeImplementationContext(merged, envelope.unresolvedQuestions, undefined, relevance);

  const trace = {
    schemaVersion: 'homecoming-iii-phase6-closure-rerun-trace/v1.0',
    intent,
    beforeRepair: {
      carriedLiveDiscoveries: compressedBefore.carried['live-discoveries'],
      carriedSignals: compressedBefore.carried['candidate-and-risk-signals'],
      omittedRefs: compressedBefore.omittedRefs,
    },
    afterRepair: {
      carriedLiveDiscoveries: compressedAfter.carried['live-discoveries'],
      carriedSignals: compressedAfter.carried['candidate-and-risk-signals'],
      omittedRefs: compressedAfter.omittedRefs,
      text: compressedAfter.text,
    },
  };

  writeFileSync(
    'codexes/packs/agentiq/updates/2026-08-15_phase6-closure-rerun-trace.json',
    JSON.stringify(trace, null, 2) + '\n',
  );

  console.log('=== BEFORE REPAIR (no relevance context — reproduces the original Phase 6 run) ===');
  console.log('live-discoveries carried:', compressedBefore.carried['live-discoveries']);
  console.log('signals carried:', compressedBefore.carried['candidate-and-risk-signals']);
  console.log(
    'CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001 carried?',
    compressedBefore.carried['candidate-and-risk-signals'].includes('CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001'),
  );

  console.log('\n=== AFTER REPAIR (causal-relevance context supplied) ===');
  console.log('live-discoveries carried:', compressedAfter.carried['live-discoveries']);
  console.log('signals carried:', compressedAfter.carried['candidate-and-risk-signals']);
  console.log(
    'CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001 carried?',
    compressedAfter.carried['candidate-and-risk-signals'].includes('CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001'),
  );
  console.log('\n--- full compressed text after repair ---\n');
  console.log(compressedAfter.text);

  console.log('\nTrace written to codexes/packs/agentiq/updates/2026-08-15_phase6-closure-rerun-trace.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
