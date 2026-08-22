/**
 * VELA-001 Slice 2G — LIVE proof of the full downstream chain, per operator
 * instruction (2026-08-22, "Prove: ACTIVE Authority -> CFS-006a public
 * projection -> live Vela confidential projection -> unified
 * ConsequenceProjection -> ActionAuthorisation -> bindExecution() -> bounded
 * test execution -> ObservedConsequence -> ConsequenceValidation ->
 * causalChain -> commerce receipts").
 *
 * Three required cases, run against the REAL running local Vela stack:
 *
 *   1. MATCHED_PROJECTION      — live ACCEPTABLE verdict, observed ACCEPTABLE
 *   2. DIVERGED_FROM_PROJECTION — SAME live ACCEPTABLE verdict, observed
 *      UNACCEPTABLE (the mismatch is on the OBSERVATION side — this phase has
 *      no production execution, so "what actually happened" is supplied by
 *      the caller, exactly as it would be by real settlement telemetry; the
 *      one live confidential projection is reused for both case 1 and case 2
 *      since both start from the identical projected disposition and differ
 *      only in what is later observed)
 *   3. REQUIRED confidential absent -> UNRESOLVED -> ZERO execution — no live
 *      Vela call at all; this case proves the fail-closed path, not the
 *      enclave
 *
 * Gate 2 (services/registry/capabilityInvocationGates.ts's
 * `evaluateCapabilityAndRuntimeGate`) is called DIRECTLY, exactly as
 * `tests/vela-slice2f-capability-invocation.test.ts`'s "Gate 2, in isolation"
 * block already does — the SAME frozen function, no new authorisation path.
 * The full `invokeCapability()` gateway additionally resolves the capability
 * PROVIDER from a live Supabase-backed registry (Gate 1), which is a real,
 * already-documented gap in this sandbox (no Supabase credentials exist here
 * — see the Slice 2F session doc's "What remains explicitly out of scope").
 * This script proves the part that is actually live-provable end to end
 * without a DB: the confidential enclave, the composition, Gate 2's
 * consequence-projection exception, and everything downstream of it.
 *
 * bindExecution() only BINDS an intent (it never confirms on-chain settlement
 * — `transactionRef` stays absent by construction); ObservedConsequence's
 * `observedState` (what was reported to have happened) and its
 * `validationState` (the computed MATCHED_PROJECTION / DIVERGED_FROM_PROJECTION
 * / UNRESOLVED comparison) are kept as two distinct fields, never collapsed.
 *
 * No live Supabase credentials exist in this sandbox. Receipt call sites are
 * exercised for real (proving they run without throwing, per their
 * best-effort contract), but the actual Supabase persistence cannot be
 * independently confirmed here — the complete reference chain is instead
 * persisted to a JSON evidence file on disk, printed at the end of this
 * script.
 *
 * Usage:
 *   npx tsx scripts/vela-slice2g-live-proof.ts --app <applicationId> \
 *     [--evm-key <hex>] [--out <path>]
 *
 * `--evm-key` defaults to the vela-starterkit's own documented Anvil Account
 * #0 dev key (funded, non-secret — see dockerfiles/.env.dev in the starter
 * kit; this is a public local-dev-only key, never a production secret). The
 * P-521 confidential-channel key is generated fresh each run and
 * self-registers via an ASSOCIATEKEY request before use (an ephemeral
 * per-request identity, not a persistent credential — ProcessorEndpoint
 * requires every requester's P-521 key be associated on-chain before any
 * PROCESS request from it can be decrypted; root-caused live against this
 * exact script, not guessed — see `docs/3_typescript-client.md`'s
 * "Registering Your Key" section, verified against the real error
 * `errorCode 9 "no Secp521r1_PubKey found"`).
 */

import { createECDH } from 'crypto';
import { writeFileSync } from 'fs';
import { JsonRpcProvider, Wallet, Contract, Interface } from 'ethers';
import { VelaConfidentialProjectionProvider } from '../services/vela/velaProjectionProvider';
import { VelaClientAdapter, velaCryptoSelfTest } from '../services/vela/velaClientAdapter';
import { VELA_LOCAL_DEPLOYMENT } from '../services/vela/velaConfig';
import { forecastConsequences } from '../services/consequence/stages';
import { composeUnifiedConsequenceProjection } from '../services/constitutionalCommerce/unifiedConsequenceProjection';
import { deriveActionAuthorisation } from '../services/constitutionalCommerce/actionAuthorisation';
import { bindExecution } from '../services/constitutionalCommerce/boundedExecution';
import { recordObservedConsequence } from '../services/constitutionalCommerce/observedConsequence';
import { assembleCausalChain } from '../services/constitutionalCommerce/causalChain';
import {
  emitActionAuthorisationReceipt,
  emitExecutionReceipt,
  emitConsequenceReceipt,
} from '../services/constitutionalCommerce/commerceReceipts';
import { evaluateCapabilityAndRuntimeGate } from '../services/registry/capabilityInvocationGates';
import type { ConsequenceForecast } from '../types/consequence';
import type {
  ConstitutionalAuthority,
  ProposedAction,
  ProjectionDisposition,
  ConsequenceProjection,
} from '../types/constitutionalCommerce';
import type { CapabilityInvocation, InvocationDecision } from '../types/capabilityInvocation';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required argument --${name}`);
}

// Anvil Account #0 — documented dev key from vela-starterkit/dockerfiles/.env.dev
// (DEPLOYER_PRIVATE_KEY). Public, local-dev-only, funded by the local chain's
// genesis allocation. Never used for anything but this local stack.
const DEFAULT_DEV_EVM_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const APP_ID = arg('app');
const EVM_KEY = arg('evm-key', DEFAULT_DEV_EVM_KEY);
const OUT_PATH = arg('out', `${process.cwd()}/scratchpad/vela-slice2g-live-proof-evidence.json`);

function freshP521PrivateKeyHex(): string {
  const ecdh = createECDH('secp521r1');
  ecdh.generateKeys();
  return ecdh.getPrivateKey('hex');
}

/** ASSOCIATEKEY (RequestType=3) — must complete before any PROCESS request
 *  from this requester/app pair will decrypt. ABI verified directly against
 *  the pinned v0.2.0 source (ProcessorEndpoint.sol / its Go binding). */
async function associateP521Key(evmKey: string, p521PrivHex: string, appId: string): Promise<void> {
  const ABI = [
    'function submitRequest(uint8 protocolVersion, uint64 applicationId, uint8 requestType, bytes payload, address tokenAddress, uint256 assetAmount, uint256 maxFeeValue) payable returns (bytes32)',
    'function minFeePerRequest() view returns (uint256)',
    'event RequestSubmitted(uint64 indexed applicationId, bytes32 indexed requestId, address indexed sender, address facilitator)',
    'event RequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
  ];
  const provider = new JsonRpcProvider(VELA_LOCAL_DEPLOYMENT.rpcUrl);
  const wallet = new Wallet(evmKey, provider);
  const processor = new Contract(VELA_LOCAL_DEPLOYMENT.processorEndpointAddress, ABI, wallet);

  const ecdh = createECDH('secp521r1');
  ecdh.setPrivateKey(Buffer.from(p521PrivHex, 'hex'));
  const pubKey = ecdh.getPublicKey();

  const minFee: bigint = await processor.minFeePerRequest();
  const maxFee = minFee > 1_000_000n ? minFee : 1_000_000n;
  const tx = await processor.submitRequest(
    0,
    BigInt(appId),
    3, // ASSOCIATEKEY
    pubKey,
    '0x0000000000000000000000000000000000000000',
    0n,
    maxFee,
    { value: maxFee },
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error('associateP521Key: no receipt');
  const iface = new Interface(ABI);
  let requestId: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'RequestSubmitted') requestId = parsed.args.requestId as string;
    } catch {
      /* not ours */
    }
  }
  if (!requestId) throw new Error('associateP521Key: RequestSubmitted not found');
  for (let i = 0; i < 30; i++) {
    const events = await processor.queryFilter(
      processor.filters.RequestCompleted(BigInt(appId), requestId),
      receipt.blockNumber,
    );
    if (events.length > 0) {
      const ev = events[0] as unknown as { args: { errorCode: number; errorMessage: string } };
      if (Number(ev.args.errorCode) !== 0) {
        throw new Error(`associateP521Key failed: errorCode ${ev.args.errorCode} — ${ev.args.errorMessage}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('associateP521Key: timed out waiting for RequestCompleted');
}

const CONTEXT_REF = 'ctx-slice2g-live-proof';

const ACTIVE_AUTHORITY: ConstitutionalAuthority = {
  principalRef: 'polref-live-slice2g',
  actorRef: 'aigent-moneypenny',
  authoritySource: 'passport+standing',
  mandateRef: 'mandate-fs-live-slice2g',
  state: 'ACTIVE',
};

// The same fixture shape tests/vela-slice2f-capability-invocation.test.ts and
// tests/vela-slice2g-execution-observation-validation.test.ts use to call
// Gate 2 directly — a resolved provider row, not a live registry query.
const MONEYPENNY_PROVIDER = {
  capabilityId: 'CONFIDENTIAL_CONSEQUENCE_PROJECTION',
  providerAgentId: 'aigent-moneypenny',
  registryAssetId: 'aigentqube-moneypenny',
  runtimeMembershipRef: 'financial-services',
  benchRow: {
    runtimeMemberships: [{ runtimeId: 'financial-services', status: 'approved', eligibility: { satisfied: [], outstanding: [] } }],
  },
} as const;

function baseEnvelope(actionRef: string, projection: ConsequenceProjection | undefined): CapabilityInvocation {
  return {
    mode: 'capability',
    invocationId: `inv-slice2g-live-${actionRef}`,
    principalRef: ACTIVE_AUTHORITY.principalRef,
    originatingSurface: 'financial-services',
    requestingAgentId: 'aigent-moneypenny',
    capabilityId: 'CONFIDENTIAL_CONSEQUENCE_PROJECTION',
    runtimeMembershipRef: 'financial-services',
    executionMode: 'authoritative',
    intent: `Execute a confidentially-projected payment under ${ACTIVE_AUTHORITY.mandateRef}`,
    input: {},
    policyBindingRefs: [],
    delegationDepth: 0,
    invocationPath: [],
    maxInvocationDepth: 2,
    consequenceProjection: projection,
  };
}

/** Gate 2 (evaluateCapabilityAndRuntimeGate), called directly — FROZEN
 *  function, no new path — mapped to the same InvocationDecision shape
 *  invokeCapability() would have produced on an `ok:true` result. */
function decisionFromGate2(envelope: CapabilityInvocation): InvocationDecision {
  const result = evaluateCapabilityAndRuntimeGate(envelope, MONEYPENNY_PROVIDER as never);
  if (result.ok) {
    return {
      decision: 'allow',
      envelope: {
        invocationId: envelope.invocationId,
        capabilityId: envelope.capabilityId,
        resolvedProviderId: MONEYPENNY_PROVIDER.providerAgentId,
        resolvedRegistryAssetId: MONEYPENNY_PROVIDER.registryAssetId,
        executionMode: envelope.executionMode,
        sharedContext: [],
      },
    };
  }
  return { decision: 'refuse', code: result.code, reason: result.reason };
}

/** CFS-006a's real type; used only if the live invariant store is unreachable. */
function localForecast(): ConsequenceForecast {
  return {
    seedInvariantIds: ['inv.finance.001'],
    nodes: [],
    enables: 1,
    constrains: 0,
    contradicts: 0,
    forcesEscalation: false,
    constitutionalConstraint: false,
    constitutionalConstraintIds: [],
    rationale: 'no reachable constraint or contradiction',
  };
}

async function resolvePublicForecast(): Promise<{ forecast: ConsequenceForecast; source: string }> {
  try {
    const live = await forecastConsequences(['inv.finance.001']);
    return { forecast: live, source: 'LIVE_INVARIANT_STORE (CFS-006a forecastConsequences)' };
  } catch (err) {
    return {
      forecast: localForecast(),
      source: `LOCAL_FORECAST_FIXTURE — invariant store unreachable (${(err as Error).message.slice(0, 80)})`,
    };
  }
}

function step(label: string, detail: Record<string, unknown>) {
  console.log(`— ${label}`);
  for (const [k, v] of Object.entries(detail)) console.log(`    ${k}: ${JSON.stringify(v)}`);
  console.log();
}

async function main() {
  console.log('VELA-001 Slice 2G — LIVE proof');
  console.log(`applicationId: ${APP_ID}\n`);

  velaCryptoSelfTest();

  const { forecast: publicForecast, source: publicSource } = await resolvePublicForecast();
  step('CFS-006a public projection resolved', { source: publicSource, enables: publicForecast.enables });

  const requesterP521Key = freshP521PrivateKeyHex();
  console.log('— Associating fresh P-521 key with the application (ASSOCIATEKEY, RequestType=3)…');
  await associateP521Key(EVM_KEY, requesterP521Key, APP_ID);
  console.log('  ✓ associated\n');

  const transport = new VelaClientAdapter({
    deployment: VELA_LOCAL_DEPLOYMENT,
    requesterPrivateKeyHex: EVM_KEY,
    requesterP521PrivateKeyHex: requesterP521Key,
    maxFeeValueWei: 1_000_000n,
  });
  const provider = new VelaConfidentialProjectionProvider(transport, APP_ID);

  const identities = {
    authorityPrincipal: ACTIVE_AUTHORITY.principalRef,
    mandateSigner: ACTIVE_AUTHORITY.principalRef,
    confidentialRequester: 'aigent-moneypenny',
    confidentialPrivacyIdentity: 'aigent-moneypenny',
    executionSigner: 'aigent-moneypenny',
  };

  async function liveConfidentialEvidence(actionRef: string, inputs: Record<string, number>) {
    const prepared = await provider.prepareProjection({
      actionRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      identities,
      confidentialInputs: inputs,
    });
    const submission = await provider.submitProjection(prepared);
    let status = await provider.getProjectionStatus(submission.requestRef);
    for (let i = 0; i < 60 && status.state === 'OBSERVING'; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      status = await provider.getProjectionStatus(submission.requestRef);
    }
    const evidence = await provider.getProjectionEvidence(submission.requestRef);
    const verification = await provider.verifyProjectionEvidence(evidence);
    return { evidence, verification };
  }

  let failures = 0;
  const results: Record<string, unknown> = {};

  // ── Cases 1 + 2: live ACCEPTABLE confidential evidence, reused for both
  //    MATCHED_PROJECTION and DIVERGED_FROM_PROJECTION (they differ only in
  //    what is later reported as observed, per file header). ─────────────
  {
    const actionRef = 'live-slice2g-shared-action';
    console.log(`— Submitting ONE live confidential request for cases 1+2 (action ${actionRef})`);
    const { evidence, verification } = await liveConfidentialEvidence(actionRef, {
      currentExposure: 0,
      proposedSpend: 1,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    step('live Vela confidential projection', {
      requestRef: evidence.requestRef,
      disposition: evidence.disposition,
      protocolExecutionVerified: verification.protocolExecutionVerified,
      teeAttestationVerified: verification.teeAttestationVerified,
      attestationMode: verification.attestationMode,
    });
    if (evidence.disposition !== 'ACCEPTABLE') {
      console.log(`  ✗ expected live verdict ACCEPTABLE, got ${evidence.disposition} — cannot proceed with cases 1/2`);
      failures++;
    } else {
      const projection = composeUnifiedConsequenceProjection({
        projectionContextRef: CONTEXT_REF,
        actionRef,
        authorityRef: ACTIVE_AUTHORITY.principalRef,
        mandateRef: ACTIVE_AUTHORITY.mandateRef,
        publicForecast,
        confidentialRequirement: 'REQUIRED',
        confidentialEvidence: {
          provider: 'vela',
          requestRef: evidence.requestRef,
          disposition: evidence.disposition,
          resultCommitment: evidence.resultCommitment,
          payloadCommitment: evidence.payloadCommitment,
          protocolExecutionVerified: verification.protocolExecutionVerified,
          teeAttestationVerified: verification.teeAttestationVerified,
          attestationMode: verification.attestationMode,
        },
        policy: { attestationRequirement: 'NOT_REQUIRED' },
      });
      step('unified ConsequenceProjection', {
        disposition: projection.disposition,
        completeness: projection.completeness,
        projectionRef: projection.projectionRef,
      });

      const decision = decisionFromGate2(baseEnvelope(actionRef, projection));
      step('Gate 2 decision (evaluateCapabilityAndRuntimeGate, FROZEN function, called directly)', { decision: decision.decision });

      const authorisation = deriveActionAuthorisation({
        authority: ACTIVE_AUTHORITY,
        projection,
        invocationDecision: decision,
        now: new Date().toISOString(),
      });
      step('ActionAuthorisation', { status: authorisation.status, authorisationRef: authorisation.authorisationRef });

      const action: ProposedAction = {
        actionRef,
        actorRef: 'aigent-moneypenny',
        mandateRef: ACTIVE_AUTHORITY.mandateRef,
        actionType: 'confidential_spend',
        consequenceDomain: 'financial-services',
      };

      async function runObservationCase(
        caseName: string,
        signerRef: string,
        observedDisposition: ProjectionDisposition,
        expectValidation: string,
      ) {
        const now = new Date().toISOString();
        const bound = bindExecution({ authorisation, signerRef, now });
        step(`bindExecution() [${caseName}]`, {
          status: bound.status,
          executionRef: bound.execution?.executionRef ?? null,
          transactionRefPresent: Boolean(bound.execution?.transactionRef),
        });
        if (bound.status !== 'execution_bound' || !bound.execution) {
          console.log(`  ✗ [${caseName}] expected execution_bound, got ${bound.status}`);
          failures++;
          return;
        }
        if (bound.execution.transactionRef !== undefined) {
          console.log(`  ✗ [${caseName}] execution binding must never carry a transactionRef (that would be confirmation, not binding)`);
          failures++;
        }

        const observed = recordObservedConsequence({
          execution: bound.execution,
          projection,
          observedState: { caseName, reportedOutcome: observedDisposition },
          observedDisposition,
        });
        step(`ObservedConsequence + ConsequenceValidation [${caseName}]`, {
          consequenceRef: observed.consequenceRef,
          observedState: observed.observedState,
          validationState: observed.validationState,
        });
        if (observed.validationState !== expectValidation) {
          console.log(`  ✗ [${caseName}] expected validationState ${expectValidation}, got ${observed.validationState}`);
          failures++;
        }
        if (!('caseName' in (observed.observedState as object))) {
          console.log(`  ✗ [${caseName}] observedState was not preserved independently of validationState`);
          failures++;
        }

        const chain = assembleCausalChain({
          action,
          projection,
          authorisation,
          execution: bound.execution,
          observedConsequence: observed,
        });
        step(`causalChain [${caseName}]`, chain as Record<string, unknown>);

        await emitActionAuthorisationReceipt(authorisation, chain, 'persona-live-slice2g', 'financial-services');
        await emitExecutionReceipt(bound, chain, 'persona-live-slice2g', 'financial-services');
        await emitConsequenceReceipt(observed, chain, 'persona-live-slice2g', 'financial-services');
        console.log(`  (commerce receipt call sites exercised for ${caseName})\n`);

        results[caseName] = {
          projection: { projectionRef: projection.projectionRef, disposition: projection.disposition },
          authorisation,
          execution: bound.execution,
          observedConsequence: observed,
          causalChain: chain,
        };
      }

      await runObservationCase('MATCHED_PROJECTION', 'aigent-moneypenny', 'ACCEPTABLE', 'MATCHED_PROJECTION');
      await runObservationCase('DIVERGED_FROM_PROJECTION', 'aigent-moneypenny-diverged-case', 'UNACCEPTABLE', 'DIVERGED_FROM_PROJECTION');
    }
  }

  // ── Case 3: REQUIRED confidential absent -> UNRESOLVED -> ZERO execution ─
  {
    const actionRef = 'live-slice2g-unresolved-action';
    console.log(`— Case 3: REQUIRED confidential deliberately absent (action ${actionRef}, no live Vela call)`);
    const projection = composeUnifiedConsequenceProjection({
      projectionContextRef: CONTEXT_REF,
      actionRef,
      authorityRef: ACTIVE_AUTHORITY.principalRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      publicForecast,
      confidentialRequirement: 'REQUIRED',
      confidentialEvidence: null,
    });
    step('unified ConsequenceProjection', { disposition: projection.disposition, completeness: projection.completeness });

    const decision = decisionFromGate2(baseEnvelope(actionRef, projection));
    step('Gate 2 decision (evaluateCapabilityAndRuntimeGate, FROZEN function, called directly)', {
      decision: decision.decision,
      code: (decision as { code?: string }).code,
    });

    const authorisation = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: new Date().toISOString(),
    });
    step('ActionAuthorisation', { status: authorisation.status });
    if (authorisation.status !== 'UNRESOLVED') {
      console.log(`  ✗ expected authorisation UNRESOLVED, got ${authorisation.status}`);
      failures++;
    }

    const bound = bindExecution({ authorisation, signerRef: 'aigent-moneypenny', now: new Date().toISOString() });
    step('bindExecution() [REQUIRED-absent]', { status: bound.status, execution: bound.execution, reason: bound.reason });
    if (bound.status !== 'refused' || bound.execution !== null) {
      console.log('  ✗ expected execution REFUSED with zero CommerceExecution created');
      failures++;
    } else {
      console.log('  ✓ ZERO execution confirmed — no CommerceExecution record exists for this action\n');
    }

    const action: ProposedAction = {
      actionRef,
      actorRef: 'aigent-moneypenny',
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      actionType: 'confidential_spend',
      consequenceDomain: 'financial-services',
    };
    const chain = assembleCausalChain({ action, projection, authorisation });
    step('causalChain [REQUIRED-absent]', chain as Record<string, unknown>);
    if (chain.executionRef !== null || chain.observedConsequenceRef !== null || chain.validationState !== null) {
      console.log('  ✗ causal chain must show null execution/observation/validation when execution was refused');
      failures++;
    }

    await emitActionAuthorisationReceipt(authorisation, chain, 'persona-live-slice2g', 'financial-services');
    await emitExecutionReceipt(bound, chain, 'persona-live-slice2g', 'financial-services');
    console.log('  (commerce receipt call sites exercised for REQUIRED-absent case)\n');

    results['REQUIRED_ABSENT_UNRESOLVED'] = {
      projection: { projectionRef: projection.projectionRef, disposition: projection.disposition },
      authorisation,
      execution: bound.execution,
      causalChain: chain,
    };
  }

  const evidenceRecord = {
    provenAt: new Date().toISOString(),
    applicationId: APP_ID,
    publicForecastSource: publicSource,
    gate2Note:
      'Gate 2 (evaluateCapabilityAndRuntimeGate) was called DIRECTLY with the same fixture provider ' +
      'tests/vela-slice2f-capability-invocation.test.ts uses, rather than through invokeCapability(), ' +
      'because the full gateway additionally resolves the capability provider from a live Supabase-backed ' +
      'registry (Gate 1) — a real, already-documented data-only gap in this sandbox, not a code path this ' +
      'proof needed to exercise. Gate 2 itself — the frozen function this proof is actually about — ran for real.',
    supabasePersistenceNote:
      'No live Supabase credentials in this sandbox — commerce receipt call sites were exercised ' +
      '(emitActionAuthorisationReceipt/emitExecutionReceipt/emitConsequenceReceipt all ran without ' +
      'throwing, per their best-effort .catch(()=>undefined) contract) but the actual Postgres write ' +
      'could not be independently confirmed. This file is the durable, persisted record of the complete ' +
      'reference chain in place of a live DB read-back.',
    frozen: {
      gate2Touched: false,
      newAuthorisationPathCreated: false,
      executionBindingConflatedWithConfirmation: false,
      observationConflatedWithValidation: false,
    },
    results,
  };
  writeFileSync(OUT_PATH, JSON.stringify(evidenceRecord, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  console.log(`— Complete reference chain persisted to ${OUT_PATH}`);

  console.log(`\n— Result: ${failures === 0 ? 'ALL CASES PASSED' : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
  console.log('\nLIVE SLICE 2G PROOF COMPLETE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
