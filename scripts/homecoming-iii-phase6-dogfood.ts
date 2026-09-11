/**
 * Homecoming III Phase 6 — live dogfood trace.
 *
 * Runs the REAL, unmodified Phase 1-5 production functions, in the required
 * order, to scope the first internal Crystal 2.0 implementation assignment
 * (the context-binding axis type contract):
 *
 *   Intent → grounded context → established invariant retrieval →
 *   initial Intent Risk Field → positive-bearing discovery →
 *   risk-informed negative-bearing discovery → convergence handling →
 *   Invariant Development Envelope → compressed implementation context
 *
 * ── The one seam this script fills itself ──────────────────────────────────
 *
 * `bearingDiscovery.ts` deliberately leaves `BearingDiscoveryProvider.positive`/
 * `.negative` as a seam for a live reasoner (see that file's header: "the
 * provider is not a stand-in for the thing under test, it is the boundary of
 * it"). This script's `provider` answers that seam with this session's own
 * live reasoning about the actual task — produced fresh for this run, not a
 * fixture reverse-engineered from the acceptance criteria. Every other
 * function called below is the real, unmodified production code; nothing is
 * mocked, stubbed, or duplicated.
 *
 * ── Known environmental limitation, stated up front ────────────────────────
 *
 * This sandbox has no Supabase credentials (verified: no .env.local, no
 * SUPABASE_* in process.env). `resolveConstitutionalField` and
 * `buildInvariantSlice` are DB-backed and will fail; `buildInvariantEnvelope`
 * catches that per its own documented fail-open contract, so the
 * constitutional and crystal-substrate legs come back empty. The `devon`
 * projection leg is filesystem-backed (the real on-disk resolution-record
 * registry) and DOES run for real. This is reported plainly in the trace
 * output rather than routed around with a mocked DB.
 *
 * Run with: npx tsx scripts/homecoming-iii-phase6-dogfood.ts
 */

import { writeFileSync } from 'fs';
import { createDevLoopSession } from '../services/devCommandCenter/devLoop';
import {
  buildInvariantEnvelope,
  rankByMateriality,
} from '../services/devCommandCenter/invariantEnvelope';
import {
  buildInitialRiskField,
  discoverBearings,
  type BearingDiscoveryProvider,
  type DiscoveredCondition,
} from '../services/devCommandCenter/bearingDiscovery';
import { emitProofOfRisk } from '../services/devCommandCenter/implementationContext';
import { composeImplementationContext } from '../services/devCommandCenter/implementationContext';
import type { StructuredDevIntent } from '../types/devCommandCenter';
import type { RiskVectorRef } from '../types/invariantEnvelope';

const NOW = '2026-08-15T00:00:00.000Z'; // stamped, not read from the clock — script convention

// ---------------------------------------------------------------------------
// 1 — INTENT
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 2 — GROUNDED CONTEXT / ESTABLISHED INVARIANT RETRIEVAL (real I/O attempt)
// ---------------------------------------------------------------------------

async function main() {
  const session = createDevLoopSession();

  const envelope = await buildInvariantEnvelope(intent, session.sessionId, {
    domains: ['devon', 'agentic-development'],
    now: NOW,
  });

  // -------------------------------------------------------------------------
  // 3 — INITIAL INTENT RISK FIELD (genuine, projected from reasoning about
  //     THIS specific assignment — not retrieved, not observed, this run)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // 4/5 — POSITIVE + RISK-INFORMED NEGATIVE BEARING DISCOVERY
  //       This is the live-model seam. Every DiscoveredCondition below is
  //       this session's own genuine reasoning about the actual task, stated
  //       causally per CAUSAL_ABSTRACTION_CONTRACT, not a restatement of the
  //       positive pass on the negative side.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // 6 — MERGE + RE-RANK (real rankByMateriality, no bespoke ranking)
  // -------------------------------------------------------------------------

  const merged = rankByMateriality([...envelope.invariants, ...discovery.discovered]);

  const enrichedEnvelope = {
    ...envelope,
    invariants: merged,
    riskField,
    proofsOfRisk,
  };

  // -------------------------------------------------------------------------
  // 7 — COMPRESSED IMPLEMENTATION CONTEXT (real composeImplementationContext)
  // -------------------------------------------------------------------------

  const compressed = composeImplementationContext(merged, envelope.unresolvedQuestions);

  const trace = {
    schemaVersion: 'homecoming-iii-phase6-dogfood-trace/v1.0',
    intent,
    envelopeAsRetrieved: {
      scopesSearched: envelope.scopesSearched,
      invariantCount: envelope.invariants.length,
      invariants: envelope.invariants,
      note:
        envelope.scopesSearched.includes('constitutional') || envelope.scopesSearched.includes('software-development')
          ? 'DB-backed legs returned data — unexpected in this sandbox, verify credentials.'
          : 'DB-backed legs (constitutional-substrate, crystal-substrate) returned EMPTY — no Supabase ' +
            'credentials in this sandbox (verified: no .env.local, no SUPABASE_* env vars). Fail-open per ' +
            "buildInvariantEnvelope's documented contract. The devon-projection leg (filesystem-backed) ran for real.",
    },
    riskField,
    proofsOfRisk,
    discovery: {
      passOrder: discovery.passOrder,
      riskFieldRevision: discovery.riskFieldRevision,
      discovered: discovery.discovered,
    },
    mergedInvariantCount: merged.length,
    compressedImplementationContext: compressed,
  };

  writeFileSync(
    'codexes/packs/agentiq/updates/2026-08-15_phase6-dogfood-trace.json',
    JSON.stringify(trace, null, 2) + '\n',
  );

  console.log('=== ENVELOPE (as retrieved) ===');
  console.log('scopesSearched:', envelope.scopesSearched);
  console.log('invariants retrieved:', envelope.invariants.length);
  for (const i of envelope.invariants) console.log(' -', i.provenance, i.lifecycle, '::', i.statement.slice(0, 100));

  console.log('\n=== DISCOVERY ===');
  console.log('passOrder:', discovery.passOrder);
  console.log('riskFieldRevision:', discovery.riskFieldRevision);
  for (const d of discovery.discovered) {
    console.log(' -', d.bearing, '|', d.scope, '|', d.ref, '::', d.statement.slice(0, 120));
  }

  console.log('\n=== COMPRESSED IMPLEMENTATION CONTEXT ===');
  console.log(compressed.text);
  console.log('\nomittedRefs:', compressed.omittedRefs);

  console.log('\nTrace written to codexes/packs/agentiq/updates/2026-08-15_phase6-dogfood-trace.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
