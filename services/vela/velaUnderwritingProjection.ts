/**
 * Vela underwriting projection — Use Case Zero's first vertical slice on top
 * of the proven multi-party substrate (2026-09-13, immediately following
 * `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-ts-wiring.md`).
 *
 * OPERATOR RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "Keep the
 * slice deliberately narrow: Party A private state + Party B private state ->
 * explicit joint-compute scope -> confidential risk calculation ->
 * minimum-disclosure verdict -> optional simulated premium/coverage
 * instruction -> causal receipt. For this first pass, make the underwriting
 * logic deterministic and intentionally simple. The goal is not actuarial
 * sophistication yet; it is to prove the full constitutional loop and the
 * separation of concerns."
 *
 * WHY A NEW FILE, NOT AN EDIT TO `velaMultiPartyProjection.ts`: that module's
 * own header states, twice, "NO NEW BUSINESS LOGIC" and lists RiskSlice/
 * coverage/premium/underwriting computation as explicitly out of scope for
 * it — this file IS that business logic, so adding it there would violate
 * the very invariant that module's own tests (gate 6 of
 * `tests/vela-multi-party-projection.test.ts`) prove holds. This mirrors the
 * EXISTING separation in this codebase between the single-party substrate
 * (`velaProjectionProvider.ts`) and the business-logic layer built on top of
 * it (`services/factor/factorConfidentialWorkload.ts`) — this file is the
 * multi-party counterpart of that second file, not a fork of the first.
 *
 * WHAT THIS FILE COMPOSES, NEVER FORKS:
 *  - `buildVelaMultiPartyProjectionRequest` / `prepareVelaMultiPartyProjection`
 *    / `submitVelaMultiPartyProjection` / `getVelaMultiPartyProjectionDisposition`
 *    (`velaMultiPartyProjection.ts`) — the ENTIRE Vela-facing sequence. Not
 *    one line of that module is duplicated or reimplemented here.
 *  - `createActivityReceipt` (`services/receipts/activityReceiptService.ts`)
 *    — the canonical receipt writer, used directly (never the
 *    constitutionalCommerce `CausalChainRefs`/`ActionAuthorisation`
 *    apparatus, which is a DIFFERENT, single-party authority/mandate flow
 *    this multi-party path does not have — per the task's own instruction).
 *  - `createUnderwritingProvider` (`services/financialServices/providers/
 *    underwriting/simulatedUnderwritingProvider.ts`) — the ONLY source of the
 *    richer 9-field quote; this file never computes risk/coverage/premium
 *    itself.
 *
 * THE CONFIDENTIALITY BOUNDARY THIS FILE HOLDS: the underwriting provider is
 * fed EXACTLY the `ConfidentialProjectionDisposition` this transport's own
 * fetchResult call already resolved for the calling party — never
 * `params.build.parties[*].inputs` (each party's raw financial figures),
 * never the constructed `request.inputs` map's VALUES (only the namespace-ref
 * KEYS are ever read by this file, for receipt-binding — see
 * `partyNamespaceRefsFromRequest` below). This file combines no two parties'
 * raw inputs itself; the ONLY combination that happens is already inside the
 * guest (`app.go`), which is exactly the constitutional boundary the prior
 * two build-order items proved and this one is required to preserve.
 *
 * THE EIGHT NEW OPERATOR-MANDATED ACCEPTANCE GATES (2026-09-13), and where
 * each is enforced — see `tests/vela-underwriting-projection.test.ts` for the
 * proving tests, one describe block per gate:
 *
 *  1. RISK INPUTS REMAIN PRIVATE AND SEPARATELY NAMESPACED.
 *     `UnderwritingProvider.quoteForVerdict`'s signature (defined in
 *     `underwritingProviderTypes.ts`) is structurally incapable of receiving
 *     raw `ProjectionInputs`/party financial figures — see that file's own
 *     header. This file calls it with ONLY the resolved `disposition`.
 *
 *  2. JOINT COMPUTATION ONLY UNDER EXPLICIT COMPUTE_WITH SCOPE.
 *     Unchanged from the substrate — this file adds no second authorization
 *     path and calls `getVelaMultiPartyProjectionDisposition` exactly as the
 *     prior item's own gate 4 proved. Proven end-to-end THROUGH this file's
 *     own `runVelaUnderwritingProjection` in the test suite.
 *
 *  3. OUTPUTS DISCLOSE ONLY THE MINIMUM AUTHORIZED RESULT.
 *     A party's resulting quote is derived from EXACTLY the disposition
 *     `getVelaMultiPartyProjectionDisposition` resolves for that party's own
 *     transport — which is already, per the substrate's own privacy
 *     boundary, that party's own standalone verdict unless they were
 *     genuinely and fully disclosed the joint one. This file adds no logic
 *     that could substitute a different party's result.
 *
 *  4. PREMIUM/COVERAGE OUTPUT IS CLEARLY MARKED SIMULATED.
 *     `quote.providerMode` is read verbatim from whatever
 *     `UnderwritingProvider` returned (today, always `'SIMULATED'` — see
 *     `simulatedUnderwritingProvider.ts`) and is ALSO bound onto the receipt
 *     as its own explicit `providerMode` field (operator's own instruction:
 *     "and providerMode explicitly").
 *
 *  5. SIMULATED COVERAGE NEVER AUTOMATICALLY CREATES A LIVE FINANCIAL
 *     OBLIGATION.
 *     `params.asset` is a CALLER-supplied, structurally separate parameter —
 *     this function NEVER constructs a `VelaAssetRef` from `quote.premium`
 *     or any other quote field. This is not merely a discipline this file
 *     documents: it is TEMPORALLY IMPOSSIBLE for it to be otherwise, because
 *     `submitVelaMultiPartyProjection` (where `asset` is consumed) runs
 *     BEFORE `provider.quoteForVerdict` is ever called — the quote does not
 *     exist yet at the point the asset-bearing decision is made. See "gates
 *     5 & 7" below.
 *
 *  6. THE CAUSAL RECEIPT BINDS REQUEST, PARTIES, SCOPE, RISK CALCULATION,
 *     RESULT, APP IDENTITY, VELA EXECUTION EVIDENCE, AND SIMULATED/LIVE
 *     STATUS.
 *     See `buildUnderwritingActionInput` below — every one of the eight
 *     named elements is a distinct, named field.
 *
 *  7. THE OPTIONAL ASSET-BEARING PATH IS ONLY INVOKED WHEN THE INSTRUCTION
 *     ACTUALLY CARRIES VALUE.
 *     `params.asset` is passed straight through to
 *     `submitVelaMultiPartyProjection`, unchanged, exactly as that function's
 *     own gate 7/8 already guarantee (never a different ref, never invented
 *     when absent). This file adds no second asset-bearing decision. Because
 *     `VelaAssetRef`'s own `validateVelaAssetRef` (`velaTypes.ts`) already
 *     rejects any `assetAmount <= 0n` before it can reach the transport, a
 *     caller-supplied asset ref ALWAYS carries positive value by
 *     construction — so "does not carry value" reduces exactly to "no asset
 *     ref supplied at all"; this file adds no separate zero-amount check
 *     because one is already structurally impossible to construct.
 *
 *  8. NO SINGLE-PARTY OR EXISTING MULTI-PARTY PROJECTION BEHAVIOUR REGRESSES.
 *     This file imports from, but adds no method to and modifies no line of,
 *     `velaMultiPartyProjection.ts`, `velaProjectionProvider.ts`,
 *     `velaTypes.ts`, `velaPartyNamespace.ts`, `velaClientAdapter.ts`, or
 *     `velaTestTransport.ts`. See the full pre/post Vela + whole-repo suite
 *     diff in the accompanying update doc.
 *
 * Server-side only (imports `velaMultiPartyProjection.ts` and
 * `activityReceiptService.ts`, both server-side only).
 */

import { createHash } from 'crypto';
import {
  getVelaMultiPartyProjectionOutcome,
  prepareVelaMultiPartyProjection,
  submitVelaMultiPartyProjection,
  type BuildVelaMultiPartyProjectionRequestParams,
} from './velaMultiPartyProjection';
import { toDomainAttestationMode, type VelaAssetRef, type VelaTransport } from './velaTypes';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { recordVelaUnderwritingRiskTelemetry } from './velaUnderwritingRiskTelemetry';
import { createUnderwritingProvider } from '@/services/financialServices/providers/underwriting/simulatedUnderwritingProvider';
import type {
  UnderwritingProvider,
  UnderwritingQuote,
} from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';
import type { AttestationMode, ConfidentialProjectionDisposition } from '@/types/confidentialProjection';

export interface RunVelaUnderwritingProjectionParams {
  /** Wire-construction params — reused verbatim from the multi-party
   *  substrate's own type; never redefined here. */
  build: BuildVelaMultiPartyProjectionRequestParams;
  /** THIS caller's own transport — its `fetchResult` decrypts only the
   *  event addressed to the caller's own registered key (per the substrate's
   *  existing privacy boundary), so the disposition this function resolves
   *  is inherently scoped to whichever party this transport belongs to. */
  transport: VelaTransport;
  /**
   * A real on-chain asset to carry alongside the submission — OPTIONAL, and
   * supplied ONLY by the caller, at call time, BEFORE any quote is computed.
   * NEVER derived by this function from a quote's premium/coverageLimit —
   * see gate 5/7 in this file's header for why that is structurally, not
   * just procedurally, impossible.
   */
  asset?: VelaAssetRef;
  /** Bounded poll attempts before giving up honestly — mirrors
   *  `services/factor/factorConfidentialWorkload.ts`'s own `pollToTerminal`
   *  budget discipline (never blocks forever). */
  maxPollAttempts?: number;
  /** Injectable for tests; defaults to the one SIMULATED provider that
   *  exists today (`createUnderwritingProvider()`). */
  underwritingProvider?: UnderwritingProvider;
  /** The accountable persona this delegated execution acts for — NEVER
   *  invented here. Mirrors `factorConfidentialWorkload.ts`'s own
   *  `actorPersonaId` convention exactly: the caller (a route resolving the
   *  spine's active persona, or an explicit platform-credential value under
   *  a cron/system trigger) always supplies this; this module never guesses
   *  or defaults to a hardcoded system persona. */
  actorPersonaId: string;
  /** The agent driving this workload (e.g. 'aigent-factor'). */
  requestedByAgentRef: string;
  /** Caller's own derived namespace ref, for receipt READABILITY only —
   *  never used to alter behaviour (the disposition is already scoped by the
   *  transport itself, not by this value). Optional. */
  requestingPartyNamespaceRef?: string;
  activeCartridge?: string;
}

export interface VelaUnderwritingProjectionResult {
  onChainRequestId: string;
  disposition: ConfidentialProjectionDisposition;
  quote: UnderwritingQuote;
  /** `null` only when the receipt write itself is skipped/unavailable
   *  (mirrors `createActivityReceipt`'s own `| null` return contract) — never
   *  when the projection itself failed, which throws instead. */
  receiptId: string | null;
  /**
   * `null` only when the telemetry write itself is skipped/unavailable
   * (`recordVelaUnderwritingRiskTelemetry` never throws — see that module's
   * own header). A telemetry failure NEVER changes `disposition`/`quote`/
   * `receiptId` above; item 6's own hook is purely additive.
   */
  telemetryRecordId: string | null;
}

const DEFAULT_MAX_POLL_ATTEMPTS = 10;
const DEFAULT_ACTIVE_CARTRIDGE = 'moneypenny';

/**
 * sha256 commitment over the submitted ciphertext — same namespace/shape
 * discipline as `velaProjectionProvider.ts`'s own `commit('vela:payload:',
 * encryptedPayload)` (receipt-safe: a one-way commitment over opaque bytes,
 * never the plaintext). Defined locally rather than importing that file's
 * private, unexported `commit` helper — CLAUDE.md's "reuse, don't duplicate"
 * concern is about DECODING/business logic (already honored: this file
 * decodes nothing new), not about a two-line hash wrapper that has no
 * exported home to reuse from.
 */
function commitMultiPartyPayload(payload: Uint8Array): string {
  return createHash('sha256').update('vela:multi-party-payload:').update(Buffer.from(payload)).digest('hex');
}

/**
 * Polls `getVelaMultiPartyProjectionOutcome` until it leaves pending, bounded
 * by `maxAttempts` — mirrors `factorConfidentialWorkload.ts`'s own
 * `pollToTerminal` shape, redefined locally because that function is private
 * to a different module and this loop's exit condition differs slightly —
 * not a case CLAUDE.md's "one authoritative location" concern applies to.
 *
 * Uses `getVelaMultiPartyProjectionOutcome`, NOT the lossy
 * `getVelaMultiPartyProjectionDisposition`, and REFUSES to return a
 * disposition at all when the outcome is `'EXECUTION_FAILED'` — this
 * function feeds directly into an underwriting quote and a persisted
 * activity receipt (via `runVelaUnderwritingProjection` below), so an
 * execution/fee failure must never be interpreted as the guest having
 * computed a genuine constitutional UNRESOLVED. See Execution Failure
 * Non-Equivalence (`CI-2026-09-14-EXECUTION-FAILURE-NON-EQUIVALENCE-001`) —
 * discovered live against the public Vela v0.2.0 devnet, 2026-09-14.
 */
/**
 * Completion evidence surfaced alongside the resolved disposition — the
 * fields requirement 3's own persistence list names that
 * `getVelaMultiPartyProjectionOutcome` does not itself carry
 * (`stateRootHex`/`prevStateRootHex`/`stateUpdateTxHash` are on the raw
 * `VelaRequestResult`, not the coarser outcome type). Fetched with ONE extra
 * `transport.fetchResult` call once the request is already known terminal
 * (cheap — the same completed data, no new poll).
 */
interface VelaUnderwritingCompletionEvidence {
  disposition: ConfidentialProjectionDisposition;
  applicationFees: string;
  stateRootHex: string;
  prevStateRootHex: string;
  stateUpdateTxHash: string;
}

async function pollMultiPartyDispositionToTerminal(
  transport: Pick<VelaTransport, 'fetchResult'>,
  onChainRequestId: string,
  maxAttempts: number,
): Promise<VelaUnderwritingCompletionEvidence> {
  let attempts = 0;
  let outcome = await getVelaMultiPartyProjectionOutcome(transport, onChainRequestId);
  while (outcome.status === 'PENDING') {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `runVelaUnderwritingProjection: request ${onChainRequestId} did not leave OBSERVING within ` +
          `${maxAttempts} poll attempts — refusing to block forever.`,
      );
    }
    outcome = await getVelaMultiPartyProjectionOutcome(transport, onChainRequestId);
  }
  if (outcome.status === 'EXECUTION_FAILED') {
    throw new Error(
      `runVelaUnderwritingProjection: request ${onChainRequestId} failed at the Vela execution layer ` +
        `(errorCode ${outcome.errorCode}: "${outcome.errorMsg}", applicationFees ${outcome.applicationFees}) — ` +
        'this is an execution/infrastructure failure, never a constitutional UNRESOLVED determination. ' +
        'Refusing to quote or receipt a result the guest never actually computed.',
    );
  }
  // Terminal + RESOLVED: safe to fetch the same completed result once more
  // for the state-root/tx evidence getVelaMultiPartyProjectionOutcome does
  // not itself carry. Never decoded/trusted before this point in the flow.
  const raw = await transport.fetchResult(onChainRequestId);
  return {
    disposition: outcome.disposition,
    applicationFees: outcome.applicationFees,
    stateRootHex: raw?.stateRootHex ?? '',
    prevStateRootHex: raw?.prevStateRootHex ?? '',
    stateUpdateTxHash: raw?.stateUpdateTxHash ?? '',
  };
}

/**
 * The receipt's `actionInput` — every one of the eight elements the
 * operator's mandate requires, each its own named field (gate 6). Reuses
 * `ConfidentialProjectionEvidence`/`ConfidentialEvidenceVerification`'s own
 * field-name vocabulary (`types/confidentialProjection.ts`) wherever this
 * layer has an equivalent fact available, rather than inventing new evidence
 * terminology: `payloadCommitment` and `attestationMode` are named and
 * derived exactly as that file's evidence type names them. This multi-party
 * layer has no full `ConfidentialProjectionEvidence` object (the multi-party
 * wiring module deliberately does not build a
 * `getMultiPartyProjectionEvidence` — out of scope for that item), so only
 * the subset of evidence concepts actually available here is bound: the
 * payload commitment (computable from the encrypted request this file
 * already holds) and the deployment's attestation mode (read from the
 * transport, exactly as the single-party provider does) — never a fabricated
 * `resultCommitment`/`executionProofRefs`, which would require evidence this
 * layer does not have.
 *
 * NEVER includes: any party's raw financial inputs, any `recipientAddress`
 * (delivery routing, not needed for audit and excluded per
 * minimum-disclosure), or any T0 identifier. Only opaque namespace refs, the
 * public wire-level scope, the coarse verdict, and the quote's own
 * (already-simulated, already-non-confidential) fields.
 */
function buildUnderwritingActionInput(input: {
  applicationId: string;
  requestRef: string;
  onChainRequestId: string;
  partyNamespaceRefs: string[];
  scopeBinding: BuildVelaMultiPartyProjectionRequestParams['scope']['binding'];
  scopeGrants: BuildVelaMultiPartyProjectionRequestParams['scope']['grants'];
  disposition: ConfidentialProjectionDisposition;
  payloadCommitment: string;
  attestationMode: AttestationMode;
  requestingPartyNamespaceRef?: string;
  quote: UnderwritingQuote;
  /** Completion evidence (2026-09-16, Vela/Horizen v0.2.0 feedback) — only
   *  ever reached AFTER pollMultiPartyDispositionToTerminal has already
   *  confirmed RequestCompleted.status === 0, so its presence here is itself
   *  proof the request completed successfully. */
  completion: {
    applicationFees: string;
    stateRootHex: string;
    prevStateRootHex: string;
    stateUpdateTxHash: string;
  };
}): Record<string, unknown> {
  return {
    // 1. Request.
    requestRef: input.requestRef,
    onChainRequestId: input.onChainRequestId,
    // 2. App identity.
    applicationId: input.applicationId,
    // 3. Parties — namespace refs only, never raw identity/recipientAddress.
    partyNamespaceRefs: input.partyNamespaceRefs,
    requestingPartyNamespaceRef: input.requestingPartyNamespaceRef ?? null,
    // 4. Scope — the disclosure scope actually used (public wire-level
    //    binding + grants; carries no financial data — see this file's
    //    header).
    scopeBinding: input.scopeBinding,
    scopeGrants: input.scopeGrants,
    // 5. Risk calculation result (the coarse, minimum-disclosure verdict).
    disposition: input.disposition,
    // 6. Vela execution evidence available at this layer (see this
    //    function's own doc comment for why not a full evidence object).
    payloadCommitment: input.payloadCommitment,
    attestationMode: input.attestationMode,
    // 7. The underwriting quote's own fields, in full.
    quote: input.quote,
    // 8. Simulated/live status, bound explicitly (operator's own
    //    instruction), not merely nested inside `quote`.
    providerMode: input.quote.providerMode,
    // 9. Authoritative on-chain completion evidence — the ACTUAL fee charged
    //    (distinct from any client-side reservation) and the state
    //    transition this request produced. Never inferred from submission
    //    alone; always read from the matching RequestCompleted/StateRootUpdate.
    applicationFees: input.completion.applicationFees,
    stateRootHex: input.completion.stateRootHex,
    prevStateRootHex: input.completion.prevStateRootHex,
    stateUpdateTxHash: input.completion.stateUpdateTxHash,
  };
}

/**
 * Runs ONE full underwriting projection for the calling party: prepare ->
 * submit -> observe -> (confidential risk calculation already happened
 * inside the guest) -> minimum-disclosure verdict -> underwriting quote ->
 * causal receipt.
 *
 * Every call submits a NEW Vela request (mirrors
 * `runAdmissionPacketPolicyEvaluation`'s own "no caller-suppliable
 * idempotency key in this seam" contract) — there is no resume variant here
 * because the multi-party wiring module itself does not expose one either.
 */
export async function runVelaUnderwritingProjection(
  params: RunVelaUnderwritingProjectionParams,
): Promise<VelaUnderwritingProjectionResult> {
  const startedAtMs = Date.now();
  if (!params.actorPersonaId) {
    throw new Error('runVelaUnderwritingProjection: actorPersonaId is required.');
  }
  if (!params.requestedByAgentRef) {
    throw new Error('runVelaUnderwritingProjection: requestedByAgentRef is required.');
  }

  // 1. Construct + validate (gate 1 of the SUBSTRATE) + encrypt. Any
  //    malformed/mismatched scope binding throws HERE, before any transport
  //    call — see velaMultiPartyProjection.ts's own gate 5.
  const prepared = await prepareVelaMultiPartyProjection(params.transport, params.build);

  // 2. Submit. `asset` is passed through EXACTLY as supplied — never
  //    derived from anything computed later (gate 5/7: the quote does not
  //    exist yet at this point in the function).
  const submission = await submitVelaMultiPartyProjection(params.transport, prepared, params.asset);

  // 3. Observe until terminal — the confidential risk calculation and its
  //    minimum-disclosure verdict already happened inside the guest by the
  //    time this resolves. Throws before this line returns if the request
  //    failed at the execution layer (status !== 0) — see
  //    pollMultiPartyDispositionToTerminal's own doc comment.
  const completionEvidence = await pollMultiPartyDispositionToTerminal(
    params.transport,
    submission.onChainRequestId,
    params.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS,
  );
  const disposition = completionEvidence.disposition;

  // 4. Underwriting quote — fed ONLY the coarse verdict (gate 1).
  const provider = params.underwritingProvider ?? createUnderwritingProvider();
  const quote = await provider.quoteForVerdict(disposition);

  // 5. Causal receipt (gate 6).
  const partyNamespaceRefs = Object.keys(prepared.request.inputs);
  const payloadCommitment = commitMultiPartyPayload(prepared.encryptedPayload);
  const attestationMode = toDomainAttestationMode(params.transport.deployment.attestationMode);

  const receipt = await createActivityReceipt({
    personaId: params.actorPersonaId,
    activeCartridge: params.activeCartridge ?? DEFAULT_ACTIVE_CARTRIDGE,
    actionType: 'vela_underwriting_projection_completed',
    summary:
      `Vela multi-party underwriting projection for application ${params.build.applicationId}: ` +
      `${disposition} (${quote.providerMode})`,
    agentsInvoked: [params.requestedByAgentRef],
    actionInput: buildUnderwritingActionInput({
      applicationId: params.build.applicationId,
      requestRef: prepared.request.requestRef,
      onChainRequestId: submission.onChainRequestId,
      partyNamespaceRefs,
      scopeBinding: prepared.request.scope.binding,
      scopeGrants: prepared.request.scope.grants,
      disposition,
      payloadCommitment,
      attestationMode,
      requestingPartyNamespaceRef: params.requestingPartyNamespaceRef,
      quote,
      completion: {
        applicationFees: completionEvidence.applicationFees,
        stateRootHex: completionEvidence.stateRootHex,
        prevStateRootHex: completionEvidence.prevStateRootHex,
        stateUpdateTxHash: completionEvidence.stateUpdateTxHash,
      },
    }),
  });

  // 6. Risk-invariant telemetry hook (Use Case Zero build-order item 6) —
  //    purely additive evidence for `golden_cycle_records`, fed ONLY the
  //    already-authorized fields above (see
  //    `velaUnderwritingRiskTelemetry.ts`'s own header). Never throws, so no
  //    additional try/catch is needed at this call site — see that module's
  //    own fail-closed contract, proven by a dedicated test.
  const telemetryResult = await recordVelaUnderwritingRiskTelemetry({
    requestRef: prepared.request.requestRef,
    onChainRequestId: submission.onChainRequestId,
    applicationId: params.build.applicationId,
    partyNamespaceRefs,
    requestingPartyNamespaceRef: params.requestingPartyNamespaceRef,
    scopeBinding: prepared.request.scope.binding,
    scopeGrants: prepared.request.scope.grants,
    disposition,
    quote,
    receiptId: receipt?.id ?? null,
    policyVersion: provider.policyVersion,
    settlementOccurred: params.asset != null,
    timeToCompletionMs: Date.now() - startedAtMs,
  });

  return {
    onChainRequestId: submission.onChainRequestId,
    disposition,
    quote,
    receiptId: receipt?.id ?? null,
    telemetryRecordId: telemetryResult?.id ?? null,
  };
}
