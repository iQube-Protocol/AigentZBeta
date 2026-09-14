/**
 * Vela multi-party confidential projection — TS-side wiring against the
 * guest-enforced disclosure scope (Vela accelerator build-order item,
 * 2026-09-13, immediately following
 * `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-guest-enforcement.md`).
 *
 * WHAT THIS IS: the FIRST TS-side module that can actually construct,
 * validate, submit, and decode a `MultiPartyProjectionRequest` against the
 * guest-side authorization mechanism `services/vela/wasm/projector/app/app.go`
 * now enforces (the "Multi-party confidential consequence projection
 * (ADDITIVE)" section of that file, roughly lines 235-750). Every type below
 * is wire-EXACT with that Go code — matched field-for-field by JSON tag, not
 * paraphrased — because this module's entire job is to serialize into
 * exactly what `app.go`'s `json.Unmarshal(payloadJSON, &req)` expects.
 *
 * OPERATOR RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "Preserve the
 * exact invariants the Go guest now proves. Keep this next slice deliberately
 * narrow: construct the request, serialize the disclosure scope, bind it to
 * the same applicationId + requestRef + operationType + outputClass, preserve
 * per-party namespace refs, submit through the existing Vela transport, and
 * decode the authorized result without adding any new business logic yet."
 *
 * NO NEW BUSINESS LOGIC: this module contains no RiskSlice, coverage,
 * premium, or underwriting computation of any kind — see the operator's own
 * "explicitly OUT of scope" list. `getVelaMultiPartyProjectionDisposition`
 * below decodes a result by calling the EXISTING `parseConfidentialVerdict`
 * (`velaProjectionProvider.ts`) — the same one-field `{"verdict": ...}`
 * decoder the single-party path already uses — rather than reimplementing
 * decoding logic (CLAUDE.md inv.engineering.036/037).
 *
 * COMPOSES WITH, NEVER FORKS, THE EXISTING PATH:
 *  - `deriveVelaPartyNamespaceRef` (`velaPartyNamespace.ts`) is the ONLY way
 *    a party's namespace ref is derived here — never a second derivation.
 *  - `VelaTransport.encryptForTee` / `submitProcessRequest` /
 *    `submitAssetBearingProcessRequest` / `fetchResult` (`velaTypes.ts`) are
 *    reused exactly as the single-party provider (`velaProjectionProvider.ts`)
 *    already uses them — this module adds no new transport method and no new
 *    encryption.
 *  - `parseConfidentialVerdict` (`velaProjectionProvider.ts`) is reused for
 *    decoding, not reimplemented.
 *  - The per-party private-inputs SHAPE is the SAME `Record<string, number>`
 *    the single-party path already sends as
 *    `ConfidentialProjectionRequest.confidentialInputs` (see
 *    `VelaConfidentialProjectionProvider.prepareProjection`, which serializes
 *    it directly as the Go guest's `ProjectionInputs` — every field there is
 *    a nullable `*int64`, so a key this record omits simply unmarshals to
 *    `nil`, exactly as it already does for the single-party path). There is
 *    no dedicated TS `ProjectionInputs` type anywhere in this repo today —
 *    reusing the existing `Record<string, number>` shape here is the
 *    "reuse, don't redefine" choice, not an oversight.
 *
 * DOES NOT EXTEND, AND IS NOT THE SAME MODEL AS,
 * `services/vela/velaPartyNamespace.ts`'s `VelaDisclosureScope` /
 * `isVelaCrossPartyAccessAuthorized`. That type is a single-owner-fans-out-to-
 * an-authorized-list shape with no COMPUTE_WITH/DISCLOSE_TO split and no
 * request/application/operation/output-class binding — it was built for a
 * narrower, earlier item, before the Go guest's actual wire format existed
 * (its own header says so explicitly). This module's
 * `VelaMultiPartyDisclosureScope` is the ACTUAL wire type the guest now reads
 * from `req.Scope`. `deriveVelaPartyNamespaceRef` — the reusable half of that
 * earlier file — is composed here; its `VelaDisclosureScope` gate is not.
 *
 * THE EIGHT OPERATOR-MANDATED ACCEPTANCE GATES, and where each is enforced:
 *
 *  1. NO CONSTRUCTION WITHOUT AN EXPLICIT SCOPE.
 *     `BuildVelaMultiPartyProjectionRequestParams.scope` is a REQUIRED
 *     (non-optional) field, so no caller can omit it and still typecheck.
 *     `assertValidVelaMultiPartyDisclosureScope` is ALSO called at runtime,
 *     inside `buildVelaMultiPartyProjectionRequest`, before any field of the
 *     request is assembled — so a JS caller (or a TS caller using `as any`)
 *     that defeats the compile-time type is still rejected at construction
 *     time, never merely relying on the type system. See
 *     `tests/vela-multi-party-projection.test.ts` "gate 1".
 *
 *  2. NAMESPACE REFS STAY DISTINCT UNTIL THE REQUEST REACHES THE GUEST.
 *     `buildVelaMultiPartyProjectionRequest` builds
 *     `VelaMultiPartyProjectionInputs` as a `Record<string,
 *     VelaMultiPartyContribution>` keyed by each party's OWN derived
 *     namespace ref — one loop iteration per party, each writing to its own
 *     key, never reading another key. No function in this file ever reads
 *     two parties' `inputs` values into one combined value, previews a joint
 *     result, or estimates anything from more than one party's private data
 *     — the ONLY thing this module does with more than one party's data is
 *     place each, separately, under its own map key. The one-time
 *     serialization into a single encrypted ciphertext
 *     (`transport.encryptForTee`) is transport, not combination — exactly as
 *     it already is for the single-party path, which also encrypts one
 *     opaque JSON blob per call. See "gate 2".
 *
 *  3. THE SENDER/SIGNER ADDRESS IS NEVER NAMESPACE AUTHORITY.
 *     No function in this file takes an EVM signing key, a `Wallet`, a
 *     `VelaClientAdapterOptions`, or any on-chain submitter identity as a
 *     parameter. The ONLY inputs to namespace-ref derivation are
 *     `applicationId` (the Vela on-chain application, not a party identity)
 *     and each party's own `VelaPartyNamespaceIdentities` — passed straight
 *     into the EXISTING `deriveVelaPartyNamespaceRef`. This is a structural
 *     property of the function signatures, not a discipline that could be
 *     violated by an oversight: there is nowhere in this file's call graph
 *     for a signer address to even reach the derivation. See "gate 3".
 *
 *  4. `COMPUTE_WITH` AND `DISCLOSE_TO` STAY SEPARATE IN THE WIRE FORMAT.
 *     `VelaScopeAction` is a union of exactly the two Go string literals,
 *     never a boolean and never derived from anything else in this file. See
 *     "gate 4".
 *
 *  5. A MISMATCHED SCOPE BINDING IS REJECTED BEFORE SUBMISSION.
 *     `assertVelaMultiPartyScopeBindingMatchesContext` compares
 *     `scope.binding.{applicationId,requestRef,operationType,outputClass}`
 *     against the ACTUAL request context (the `applicationId`/`requestRef`
 *     this call is submitting under, and this module's own operation/output
 *     constants) and throws on any mismatch. `prepareVelaMultiPartyProjection`
 *     calls it BEFORE `transport.encryptForTee` is ever invoked — so a
 *     mismatch never reaches the transport at all. This is DEFENSE IN DEPTH:
 *     the guest (`resolveAuthorizedCombination`) already, independently,
 *     resolves the identical mismatch to UNRESOLVED for every party — this
 *     client-side check does not replace that enforcement, it adds an
 *     earlier fail-closed point in front of it. See "gate 5".
 *
 *  6. THE EXISTING SINGLE-PARTY PATH IS UNTOUCHED.
 *     This file imports from, but adds no method to and modifies no line of,
 *     `velaProjectionProvider.ts`, `velaTypes.ts`, `velaClientAdapter.ts`, or
 *     `velaTestTransport.ts`. `VelaConfidentialProjectionProvider`'s five
 *     methods are unchanged. See the full pre/post Vela suite diff in the
 *     accompanying update doc.
 *
 *  7. THE NO-FUNDS PATH STAYS THE DEFAULT.
 *     `submitVelaMultiPartyProjection`'s `asset` parameter is OPTIONAL;
 *     omitting it calls `transport.submitProcessRequest` — the exact same
 *     zero-value path every other projection request uses. See "gate 7"/"8".
 *
 *  8. AN ASSET REF CAN OPTIONALLY RIDE ALONG, NEVER BY DEFAULT.
 *     Passing a `VelaAssetRef` routes through
 *     `transport.submitAssetBearingProcessRequest` with EXACTLY that ref —
 *     never a different one, never silently substituted. See "gate 8".
 *
 * Server-side only (imports `velaPartyNamespace.ts`, which is server-side
 * only, and `velaProjectionProvider.ts`, which handles the same).
 */

import {
  deriveVelaPartyNamespaceRef,
  type VelaPartyNamespaceIdentities,
} from './velaPartyNamespace';
import { parseConfidentialVerdict } from './velaProjectionProvider';
import type { VelaAssetRef, VelaTransport } from './velaTypes';
import type { ConfidentialProjectionDisposition } from '@/types/confidentialProjection';

// ── Wire constants (exact string literals `app.go` requires) ──────────────

/** `app.go`'s `multiPartyProjectionRequestType`. */
export const VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE =
  'confidential_multi_party_consequence_projection' as const;

/** `app.go`'s `multiPartyOperationJointConsequenceProjection`. */
export const VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION =
  'joint_consequence_projection' as const;

/** `app.go`'s `multiPartyOutputClassJointVerdict`. */
export const VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT = 'joint_verdict' as const;

/** `app.go`'s `ScopeAction` — exactly these two string literals, never a boolean. */
export type VelaScopeAction = 'COMPUTE_WITH' | 'DISCLOSE_TO';
export const VELA_SCOPE_ACTION_COMPUTE_WITH: VelaScopeAction = 'COMPUTE_WITH';
export const VELA_SCOPE_ACTION_DISCLOSE_TO: VelaScopeAction = 'DISCLOSE_TO';

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// ── Wire types (field-for-field with app.go's JSON tags) ───────────────────

/**
 * `app.go`'s `ScopeGrant{Action, Party, To}`. `to` is optional (`omitempty`
 * on the Go side) and meaningful only for `DISCLOSE_TO`.
 */
export interface VelaScopeGrant {
  action: VelaScopeAction;
  party: string;
  to?: string;
}

/** `app.go`'s `ScopeBinding{ApplicationID, RequestRef, OperationType, OutputClass}`. */
export interface VelaScopeBinding {
  applicationId: string;
  requestRef: string;
  operationType: string;
  outputClass: string;
}

/** `app.go`'s `MultiPartyDisclosureScope{Binding, Grants}`. */
export interface VelaMultiPartyDisclosureScope {
  binding: VelaScopeBinding;
  grants: VelaScopeGrant[];
}

/**
 * Reuses the SAME per-party private-inputs shape the single-party path
 * already sends (`ConfidentialProjectionRequest.confidentialInputs`) —
 * deliberately NOT a new, stricter type. See this file's header.
 */
export type VelaProjectionInputs = Record<string, number>;

/** `app.go`'s `MultiPartyContribution{RecipientAddress, Inputs}`. */
export interface VelaMultiPartyContribution {
  recipientAddress: string;
  inputs: VelaProjectionInputs;
}

/**
 * `app.go`'s `MultiPartyProjectionInputs map[string]MultiPartyContribution`
 * — keyed by each party's opaque namespace ref, for the entire lifetime of a
 * request (gate 2). This guest treats the key as opaque; it is derived
 * TS-side by `deriveVelaPartyNamespaceRef` and never recomputed here.
 */
export type VelaMultiPartyProjectionInputs = Record<string, VelaMultiPartyContribution>;

/** `app.go`'s `MultiPartyProjectionRequest{Type, RequestRef, Inputs, Scope, Context}`. */
export interface VelaMultiPartyProjectionRequest {
  type: typeof VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE;
  requestRef: string;
  inputs: VelaMultiPartyProjectionInputs;
  scope: VelaMultiPartyDisclosureScope;
  context?: Record<string, string>;
}

// ── Scope validation (gate 1) ───────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

/** Same `asRecord` pattern used elsewhere in this repo (e.g.
 *  `services/composer/runtimeProjectionShared.ts`) — never exported past
 *  this file, redefined locally per CLAUDE.md's existing convention rather
 *  than importing a private helper from an unrelated module. */
function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

/**
 * Runtime, fail-closed validation of a disclosure scope — gate 1. Called by
 * `buildVelaMultiPartyProjectionRequest` (and independently exported so a
 * caller can validate a scope it obtained elsewhere before use). Throws on:
 * a missing/non-object scope, a missing/non-object `binding`, any binding
 * field that is not a non-empty string, a `grants` field that is not an
 * array (an ABSENT `grants` is ambiguous — `app.go`'s own
 * `resolveAuthorizedCombination` rejects `scope.Grants == nil` for exactly
 * this reason; an explicit empty array `[]` is well-formed and means "no
 * combination authorized"), and any malformed grant entry.
 *
 * This is a RUNTIME check, not merely a TypeScript type — it still runs when
 * a caller defeats the compile-time type with `as any` or calls in from
 * plain JavaScript.
 */
export function assertValidVelaMultiPartyDisclosureScope(
  scope: unknown,
): asserts scope is VelaMultiPartyDisclosureScope {
  const scopeRecord = asRecord(scope);
  if (!scopeRecord) {
    throw new Error(
      'Vela multi-party disclosure scope is required and must be an object — a multi-party ' +
        'projection request must never be constructed without an explicit scope.',
    );
  }
  const binding = asRecord(scopeRecord.binding);
  if (!binding) {
    throw new Error('Vela multi-party disclosure scope.binding is required and must be an object.');
  }
  for (const field of ['applicationId', 'requestRef', 'operationType', 'outputClass'] as const) {
    const value = binding[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(
        `Vela multi-party disclosure scope.binding.${field} must be a non-empty string, got ${JSON.stringify(value)}.`,
      );
    }
  }
  if (!Array.isArray(scopeRecord.grants)) {
    throw new Error(
      'Vela multi-party disclosure scope.grants must be an array (use [] to explicitly authorize no ' +
        'combination) — a missing grants field is ambiguous, and the guest itself resolves that ' +
        'ambiguity to UNRESOLVED for every party (app.go: resolveAuthorizedCombination rejects ' +
        'scope.Grants == nil).',
    );
  }
  (scopeRecord.grants as unknown[]).forEach((g, i) => {
    const grant = asRecord(g);
    const action = grant?.action;
    if (!grant || (action !== VELA_SCOPE_ACTION_COMPUTE_WITH && action !== VELA_SCOPE_ACTION_DISCLOSE_TO)) {
      throw new Error(
        `Vela multi-party disclosure scope.grants[${i}].action must be "COMPUTE_WITH" or "DISCLOSE_TO", got ${JSON.stringify(action)}.`,
      );
    }
    if (typeof grant.party !== 'string' || grant.party.length === 0) {
      throw new Error(`Vela multi-party disclosure scope.grants[${i}].party must be a non-empty string.`);
    }
    if (grant.to !== undefined && typeof grant.to !== 'string') {
      throw new Error(`Vela multi-party disclosure scope.grants[${i}].to must be a string when present.`);
    }
  });
}

// ── Request construction (gates 1, 2, 3) ────────────────────────────────────

/**
 * One party's contribution as the CALLER supplies it — before this module
 * derives that party's namespace ref. `identities` is used ONLY to derive
 * the ref (via the existing `deriveVelaPartyNamespaceRef`) and never appears
 * on the wire itself; `recipientAddress` is delivery routing (the same class
 * of value as `ProcessRequest`'s own `sender` parameter — gate 3), not
 * namespace authority.
 */
export interface VelaMultiPartyPartyInput {
  identities: VelaPartyNamespaceIdentities;
  recipientAddress: string;
  inputs: VelaProjectionInputs;
}

export interface BuildVelaMultiPartyProjectionRequestParams {
  /** The Vela on-chain application these parties' namespace refs are scoped
   *  within — used ONLY for ref derivation, never as or from a signer identity. */
  applicationId: string;
  /** This SPECIFIC request's own identity — must be freshly minted per genuine
   *  submission (never reused across requests; see gate 5's non-transitivity). */
  requestRef: string;
  parties: VelaMultiPartyPartyInput[];
  /** REQUIRED — see gate 1. No default, no optional fallback. */
  scope: VelaMultiPartyDisclosureScope;
  context?: Record<string, string>;
}

/**
 * Constructs a wire-exact `VelaMultiPartyProjectionRequest`. Fails closed
 * (throws) before assembling anything on: a missing/malformed scope (gate 1),
 * a missing `requestRef`, an empty `parties` list, a malformed
 * `recipientAddress`, or two parties deriving the SAME namespace ref (which
 * would otherwise silently overwrite one party's contribution with another's
 * — the opposite of gate 2's "stay distinct" property).
 *
 * Never reads or combines two parties' `inputs` — each party's data is
 * placed under its own derived key and nothing else in this function touches
 * more than one party's `inputs` value at a time (gate 2).
 */
export function buildVelaMultiPartyProjectionRequest(
  params: BuildVelaMultiPartyProjectionRequestParams,
): VelaMultiPartyProjectionRequest {
  // Gate 1: validated before any field of the request is assembled.
  assertValidVelaMultiPartyDisclosureScope(params.scope);

  if (!params.requestRef) {
    throw new Error(
      'buildVelaMultiPartyProjectionRequest: requestRef is required — mint a fresh value per genuine request.',
    );
  }
  if (!params.parties || params.parties.length === 0) {
    throw new Error('buildVelaMultiPartyProjectionRequest: at least one party is required.');
  }

  const inputs: VelaMultiPartyProjectionInputs = {};
  for (const party of params.parties) {
    if (!HEX_ADDRESS_RE.test(party.recipientAddress)) {
      throw new Error(
        `buildVelaMultiPartyProjectionRequest: invalid recipientAddress "${party.recipientAddress}" — ` +
          'must be a 20-byte 0x-prefixed hex address.',
      );
    }
    // Gate 3: the ONLY inputs to this derivation are applicationId (not a
    // party identity) and the party's OWN identities — never a signer/sender
    // address, which this function does not even accept as a parameter.
    const ref = deriveVelaPartyNamespaceRef(params.applicationId, party.identities);
    if (Object.prototype.hasOwnProperty.call(inputs, ref)) {
      throw new Error(
        `buildVelaMultiPartyProjectionRequest: two parties derived the SAME namespace ref (${ref}) — ` +
          "refusing to silently overwrite one party's contribution with another's.",
      );
    }
    // Gate 2: this party's inputs are placed under its OWN key only — this
    // loop never reads a key it did not just write, and no other function in
    // this file reads more than one party's `inputs` at once.
    inputs[ref] = { recipientAddress: party.recipientAddress, inputs: party.inputs };
  }

  return {
    type: VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE,
    requestRef: params.requestRef,
    inputs,
    scope: params.scope,
    ...(params.context ? { context: params.context } : {}),
  };
}

// ── Pre-submission scope-binding check (gate 5) ─────────────────────────────

/**
 * Defense-in-depth (gate 5): compares `scope.binding`'s four fields against
 * THIS request's own actual context — the `applicationId`/`requestRef` it is
 * about to submit under, and this module's own fixed operation/output-class
 * constants (the only operation this guest revision recognizes) — and throws
 * on any mismatch. Called BEFORE any transport method, so a mismatch never
 * reaches `encryptForTee`, let alone `submitProcessRequest`.
 *
 * This does NOT replace the guest's own enforcement
 * (`resolveAuthorizedCombination`, which independently resolves the identical
 * mismatch to UNRESOLVED for every party) — it is an ADDITIONAL, earlier
 * fail-closed point, exactly as the operator's ruling requires ("or resolves
 * UNRESOLVED" names the guest's own check as the fallback, not a
 * substitute).
 */
export function assertVelaMultiPartyScopeBindingMatchesContext(
  scope: VelaMultiPartyDisclosureScope,
  context: { applicationId: string; requestRef: string },
): void {
  assertValidVelaMultiPartyDisclosureScope(scope);
  const mismatches: string[] = [];
  if (scope.binding.applicationId !== context.applicationId) {
    mismatches.push(
      `applicationId (scope: ${JSON.stringify(scope.binding.applicationId)}, request: ${JSON.stringify(context.applicationId)})`,
    );
  }
  if (scope.binding.requestRef !== context.requestRef) {
    mismatches.push(
      `requestRef (scope: ${JSON.stringify(scope.binding.requestRef)}, request: ${JSON.stringify(context.requestRef)})`,
    );
  }
  if (scope.binding.operationType !== VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION) {
    mismatches.push(
      `operationType (scope: ${JSON.stringify(scope.binding.operationType)}, expected: ${JSON.stringify(VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION)})`,
    );
  }
  if (scope.binding.outputClass !== VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT) {
    mismatches.push(
      `outputClass (scope: ${JSON.stringify(scope.binding.outputClass)}, expected: ${JSON.stringify(VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT)})`,
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      "Vela multi-party scope binding does not match this request's own context — refusing to " +
        'submit before any network/transport call is made. The guest itself would independently ' +
        `resolve this same mismatch to UNRESOLVED for every party. Mismatches: ${mismatches.join('; ')}`,
    );
  }
}

// ── Prepare + submit (composes the EXISTING VelaTransport, gates 6, 7, 8) ──

export interface PreparedVelaMultiPartyProjection {
  applicationId: string;
  request: VelaMultiPartyProjectionRequest;
  /** Opaque ciphertext, exactly like `PreparedConfidentialProjection.encryptedPayload`. */
  encryptedPayload: Uint8Array;
}

/**
 * Constructs, validates, and encrypts a multi-party projection request.
 * Nothing here is business logic — it is exactly the single-party
 * `prepareProjection`'s own shape (serialize → `encryptForTee`), generalized
 * to the multi-party wire type.
 *
 * The scope-binding check (gate 5) runs BEFORE `transport.encryptForTee` is
 * called — a mismatched scope never reaches the transport at all.
 */
export async function prepareVelaMultiPartyProjection(
  transport: Pick<VelaTransport, 'encryptForTee'>,
  params: BuildVelaMultiPartyProjectionRequestParams,
): Promise<PreparedVelaMultiPartyProjection> {
  const request = buildVelaMultiPartyProjectionRequest(params);
  assertVelaMultiPartyScopeBindingMatchesContext(request.scope, {
    applicationId: params.applicationId,
    requestRef: params.requestRef,
  });
  const plaintext = Buffer.from(JSON.stringify(request), 'utf8');
  const encryptedPayload = await transport.encryptForTee(plaintext);
  return { applicationId: params.applicationId, request, encryptedPayload };
}

export interface VelaMultiPartyProjectionSubmission {
  /** The on-chain requestId the transport returns — used to poll
   *  `fetchResult`. Deliberately NOT named `requestRef`: that name is
   *  reserved for `request.requestRef`, the payload-level value bound into
   *  the scope, which is a different value from the on-chain requestId. */
  onChainRequestId: string;
  submittedAt: string;
}

/**
 * Submits a prepared multi-party projection through the EXISTING
 * `VelaTransport` — no new transport method. Defaults to the SAME zero-value
 * path every projection request uses (`submitProcessRequest`, gate 7);
 * passing `asset` routes through `submitAssetBearingProcessRequest` with
 * EXACTLY that ref instead (gate 8), never a different one and never as the
 * default.
 */
export async function submitVelaMultiPartyProjection(
  transport: VelaTransport,
  prepared: PreparedVelaMultiPartyProjection,
  asset?: VelaAssetRef,
): Promise<VelaMultiPartyProjectionSubmission> {
  const onChainRequestId = asset
    ? await transport.submitAssetBearingProcessRequest(prepared.applicationId, prepared.encryptedPayload, asset)
    : await transport.submitProcessRequest(prepared.applicationId, prepared.encryptedPayload);
  return { onChainRequestId, submittedAt: new Date().toISOString() };
}

// ── Decode (reuses the existing single-field VerdictEvent decoder) ─────────

/**
 * The full outcome of a (possibly still-pending) multi-party request,
 * distinguishing three cases the raw `errorCode` makes observable but a bare
 * disposition string collapses into one — discovered live against the public
 * Vela v0.2.0 devnet (2026-09-14): a fee/fuel execution failure
 * (`errorCode !== 0`) decodes byte-for-byte identically to a genuine
 * guest-computed `UNRESOLVED` unless the raw execution status is inspected
 * first. Execution Failure Non-Equivalence
 * (`CI-2026-09-14-EXECUTION-FAILURE-NON-EQUIVALENCE-001`): failure to
 * execute must never be interpreted as a constitutional determination
 * produced by successful execution.
 *
 *  - `'PENDING'`: the request has not yet completed (mirrors the existing
 *    disposition-null idiom below).
 *  - `'EXECUTION_FAILED'`: the Vela Executor reported `errorCode !== 0` — a
 *    transport/resource/fee failure, NEVER the guest's own authorization or
 *    computation logic (which can only ever emit ACCEPTABLE/UNACCEPTABLE/
 *    UNRESOLVED via a SUCCESSFUL execution). Carries the raw `errorCode`/
 *    `errorMsg` so a caller can distinguish this from a genuine `UNRESOLVED`
 *    without re-deriving it.
 *  - `'RESOLVED'`: a genuine, guest-computed disposition.
 */
export type VelaMultiPartyProjectionOutcome =
  | { status: 'PENDING' }
  | { status: 'EXECUTION_FAILED'; errorCode: number; errorMsg: string }
  | { status: 'RESOLVED'; disposition: ConfidentialProjectionDisposition };

/**
 * Resolves the full, undegraded outcome of a multi-party request — the
 * preferred entry point for any caller that will use the result to build a
 * quote, a receipt, or any other persisted evidence, because it makes an
 * execution failure structurally impossible to mistake for a real
 * disposition (a caller has to explicitly handle `'EXECUTION_FAILED'` to
 * reach a `disposition` value at all — there is no field named `disposition`
 * on that branch). `getVelaMultiPartyProjectionDisposition` (below) is kept,
 * unchanged, for existing callers that only need the coarse three-valued
 * (or pending-null) signal and already treat a failure and a genuine
 * UNRESOLVED identically on purpose (e.g. a diagnostic script's own
 * comparison against an expected disposition).
 */
export async function getVelaMultiPartyProjectionOutcome(
  transport: Pick<VelaTransport, 'fetchResult'>,
  onChainRequestId: string,
): Promise<VelaMultiPartyProjectionOutcome> {
  const result = await transport.fetchResult(onChainRequestId);
  if (!result) return { status: 'PENDING' };
  if (result.errorCode !== 0) {
    return { status: 'EXECUTION_FAILED', errorCode: result.errorCode, errorMsg: result.errorMsg };
  }
  return { status: 'RESOLVED', disposition: parseConfidentialVerdict(result.decryptedUserEventJson) };
}

/**
 * Decodes the caller's OWN authorized verdict from a completed multi-party
 * request. Reuses `parseConfidentialVerdict` verbatim — the SAME one-field
 * `{"verdict": ...}` decoder the single-party path already uses — adding no
 * new decoding logic. `transport.fetchResult` already decrypts only the
 * event addressed to the caller's own registered P-521 key (per
 * `VelaClientAdapter.fetchResult` and `VELA-PRIVACY-BOUNDARY-001`), so this
 * naturally returns only the disposition this caller is authorized to see —
 * never another party's.
 *
 * Returns `null` while the request is still pending (mirrors
 * `ConfidentialProjectionStatus`'s `OBSERVING` state) rather than throwing —
 * matching `getProjectionStatus`'s own contract, not `getProjectionEvidence`'s
 * (which throws for a still-pending request). This module makes no policy
 * choice about which of those two single-party contracts is "right" for a
 * caller to use; it exposes the same underlying fact (`fetchResult` returned
 * null) via the same `null`-while-pending idiom `getProjectionStatus` chose.
 *
 * UNCHANGED BEHAVIOUR, KEPT FOR EXISTING CALLERS: still collapses
 * `'EXECUTION_FAILED'` into the string `'UNRESOLVED'`, exactly as it always
 * has (fail-closed, never a false ACCEPTABLE/UNACCEPTABLE). A NEW caller that
 * will persist the result as evidence, a quote, or a receipt MUST use
 * `getVelaMultiPartyProjectionOutcome` instead — see that function's own
 * doc comment and Execution Failure Non-Equivalence.
 */
export async function getVelaMultiPartyProjectionDisposition(
  transport: Pick<VelaTransport, 'fetchResult'>,
  onChainRequestId: string,
): Promise<ConfidentialProjectionDisposition | null> {
  const outcome = await getVelaMultiPartyProjectionOutcome(transport, onChainRequestId);
  if (outcome.status === 'PENDING') return null;
  if (outcome.status === 'EXECUTION_FAILED') return 'UNRESOLVED';
  return outcome.disposition;
}
