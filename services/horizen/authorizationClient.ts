/**
 * Horizen authorization client — EXPLICIT MUTATION ORCHESTRATION.
 *
 * GJR-VFY-001 Phase 1 (operator ruling 2026-07-31). Companion to the
 * read-only `services/horizen/client.ts`, which stays read-only per its own
 * header — every mutating step for Horizen's Pulse/PnL transparency
 * authorization lives here instead, never folded into the read client.
 *
 * SCOPE DISCIPLINE: this is a Horizen-specific orchestrator, not a universal
 * "partner authorization" abstraction — that generalization is explicitly
 * deferred (SIGNING-SPINE-001). What IS generalized here (via
 * `./mcpSchemaMatch` and `@/services/signing/partnerAuthorizationSigner`) is
 * only the safe MECHANICS already proven in
 * `scripts/register-moneypenny-horizen.ts`: live tool discovery, schema
 * matching, defensive extraction, network/contract cross-checks, local
 * signing, submission, authoritative reread, and refusal on mismatch.
 *
 * NO HARDCODED PULSE TOOL NAMES. `build_pulse_auth_message` /
 * `enable_pulse_monitoring` / `get_onboarding_status` are the spec's
 * PROVISIONAL LABELS, tried first as exact-name candidates, with a
 * schema-shape fallback if the live server declares different names. If
 * neither yields a compatible tool for a required role, this refuses with
 * `HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND` rather than guessing a call shape.
 *
 * PARTNER CONFIRMATION IS NOT OPTIONAL: a locally valid signature does not
 * complete anything until Horizen accepts the submission AND an authoritative
 * reread confirms the resulting state (`SIGNED`/`SUBMITTED`/`CONFIRMED` are
 * never collapsed).
 */

import { createHash, randomUUID } from 'crypto';
import { HORIZEN_NETWORK_FACTS, parseAgentId, type HorizenNetwork } from './identity';
import { HORIZEN_REGISTRY_MCP, fetchRegistryAgent as defaultFetchRegistryAgent, type HorizenRead } from './client';
import {
  findCompatibleTool,
  matchSchemaFields,
  missingRequiredFields,
  extractPartnerMessage,
  extractStructuredMessageField,
  extractIssuedAt,
  describeToolResultShape,
  normalizeMcpSubmissionResult,
  classifyPulseEnrollmentState,
  extractRegistryOwnerFromStatusText,
  type McpTool,
  type McpToolResult,
  type NormalizedMcpSubmissionResult,
} from './mcpSchemaMatch';
import {
  signPartnerAuthorization,
  type ResolveSigningKey,
  type PartnerAuthorizationSignature,
} from '@/services/signing/partnerAuthorizationSigner';
import {
  createPartnerAuthorizationRequest,
  updatePartnerAuthorizationRequest,
  getPartnerAuthorizationRequest,
  checkAuthorizationStoreAvailable as defaultCheckStoreAvailable,
  type AuthorizationStoreAvailability,
  type PartnerAuthorizationState,
} from './partnerAuthorizationStore';

// ── Types (GJR-VFY-001 §6, §8) ──────────────────────────────────────────────

export interface HorizenTransparencyAuthorization {
  version: string;
  aigentQubeId: string;
  agentCardHash: string;
  registry: {
    protocol: 'erc-8004';
    network: HorizenNetwork;
    contract: string;
    tokenId: string;
    registryAlias?: string;
  };
  controllerWallet: string;
  authorization: {
    pulseMonitoring: true;
    pnlDisclosure: true;
    purpose: 'horizen-financial-transparency';
    scope: string[];
  };
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  messageHash: string;
}

/**
 * UI-surface states (spec §8) — a superset of the persisted
 * `PartnerAuthorizationState`. `NOT_AVAILABLE`/`READY` describe a state
 * BEFORE any row exists (no capability wired yet / ready to prepare); every
 * other value corresponds 1:1 to a `partner_authorization_requests.state`.
 */
export type TransparencyAuthorizationState = 'NOT_AVAILABLE' | 'READY' | PartnerAuthorizationState;

export type HorizenAuthorizationRefusalCode =
  | 'INVALID_REQUEST'
  | 'MISSING_TOKEN_ID'
  | 'NETWORK_OR_CONTRACT_MISMATCH'
  | 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND'
  | 'PARTNER_MESSAGE_UNAVAILABLE'
  /** build_pulse_auth_message's response named none of the shapes we can extract an issuedAt from — refusing rather than generating our own (al / Horizen brief, 2026-08-04). */
  | 'ISSUED_AT_UNAVAILABLE'
  /** enable_pulse_monitoring reported isError — a tool-level rejection (e.g. schema validation), distinct from a successful-but-unparseable response. */
  | 'HORIZEN_SUBMISSION_REJECTED'
  | 'NONCE_MISSING_OR_REPLAYED'
  | 'AUTHORIZATION_EXPIRED'
  | 'SIGNING_FAILED'
  | 'HORIZEN_SUBMISSION_FAILED'
  | 'REGISTRY_REREAD_FAILED'
  | 'REGISTRY_OWNER_MISMATCH'
  | 'HORIZEN_REREAD_NOT_CONFIRMED'
  /* The LOCAL authorization store could not be reached — checked before any
   * partner call, so this refusal always means Horizen was never asked. */
  | 'AUTHORIZATION_STORE_UNAVAILABLE'
  /**
   * The local authorization row itself could not be created (e.g. a
   * schema-drift missing column) — distinct from AUTHORIZATION_STORE_UNAVAILABLE
   * only in WHEN it was caught (the pre-flight probe vs the write itself);
   * both mean the same thing to the caller: Horizen never recorded anything
   * (al, 2026-08-04).
   */
  | 'LOCAL_PERSISTENCE_FAILED'
  /** A row for this deterministic authorizationId already exists AND has reached SUBMITTED/CONFIRMED — see partnerAuthorizationStore.ts's createPartnerAuthorizationRequest. Re-read status; never re-prepare blindly. */
  | 'AUTHORIZATION_ALREADY_IN_FLIGHT'
  /**
   * The signer module's OWN internal self-check (recovered === wallet ===
   * expectedSigner) already passed, but an INDEPENDENT re-verification —
   * recovering the signer from the EXACT message text over the FRESHLY
   * persisted record, at the orchestrator level — did not match (al,
   * 2026-08-04: "the decisive local test is recoverAddress(exactMessage,
   * signature) === ownerOf(agentId)... that should run before submission").
   * Exists to catch a FUTURE divergence between what was signed and what
   * gets submitted (e.g. a refactor that reconstructs the message from
   * parsed fields instead of threading it verbatim) before
   * enable_pulse_monitoring is ever called, not merely today's composition
   * of already-passing checks.
   */
  | 'SIGNATURE_INTEGRITY_FAILED'
  /**
   * One of the message-critical fields about to be sent to
   * `enable_pulse_monitoring` (agentId, walletAddress, issuedAt, chain)
   * differs — BYTE FOR BYTE, not case-insensitively — from the value
   * persisted at prepare time, i.e. the value actually sent to
   * `build_pulse_auth_message` (Horizen partner confirmation, 2026-08-05:
   * "the arguments you pass to enable_pulse_monitoring must exactly
   * reproduce the ones used in build_pulse_auth_message"). Refused LOCALLY,
   * before Horizen is ever contacted for submission — a drift here would
   * make Horizen's server-side message reconstruction differ from what was
   * actually signed, producing a cryptographically-correct-looking but
   * server-side-mismatched `401 — Invalid signature` that every earlier
   * local check (recovered signer, registry owner) already passed.
   */
  | 'PULSE_ARGUMENT_DRIFT'
  /**
   * INSTRUMENTATION, NOT A FIX (Horizen live-test escalation, 2026-08-05).
   *
   * Horizen's engineer reproduced our 401 via live probes and narrowed it to
   * one class of defect: "the recovered signer ≠ the walletAddress you
   * submitted... your 401 says your bytes ≠ our reconstruction." His leading
   * hypothesis: `build_pulse_auth_message` returns a human-readable blob
   * PLUS a `--- structured ---` JSON section carrying a `message` field —
   * and the signable bytes are that field, not the rendered text around it.
   *
   * `extractPartnerMessage`'s `sole-text-block` fallback (mcpSchemaMatch.ts)
   * accepts the ENTIRE text block whenever the whole thing fails to
   * `JSON.parse` — which is exactly what a prose-preamble-plus-marker
   * response does, even though a `message` field is sitting right there
   * inside the embedded JSON. This refusal fires when
   * `extractStructuredMessageField`'s marker-aware read disagrees with what
   * `extractPartnerMessage` decided to sign — i.e. the two extractions of
   * the SAME response chose different bytes. Per al's explicit direction:
   * "Do not change signing behavior until the instrumentation identifies
   * the exact divergence" — this refuses LOUDLY with every diagnostic named,
   * rather than silently picking one side or attempting a fix blind.
   */
  | 'PULSE_MESSAGE_DRIFT'
  /**
   * A signature may recover locally to the correct owner INDEFINITELY while
   * still being invalid for Horizen's ceremony, because the signed request
   * itself carries a short validity window (documented as five minutes) and
   * Horizen's server-side reconstruction refuses a stale `issuedAt` even
   * though the bytes we signed and the bytes we submitted agree perfectly
   * (operator escalation, 2026-08-05: a live rejection's `issuedAt` matched
   * an EARLIER attempt's, on what was reported as a fresh retry).
   *
   * `prepareHorizenTransparencyAuthorization` checks the freshly-extracted
   * `issuedAt` against `now()` immediately after every
   * `build_pulse_auth_message` call, and retries that SAME call once (never
   * sign, never submit, never persist) before giving up — so a transient
   * stale response self-heals without the operator re-clicking Authorize.
   * This refusal fires only if BOTH attempts come back stale, which means
   * something more persistent (partner-side caching, clock skew) is
   * happening and deserves a human look rather than a silent third retry.
   */
  | 'PULSE_AUTHORIZATION_EXPIRED'
  /**
   * INSTRUMENTATION + HARD GUARD, NOT A FIX (Al's audit brief, 2026-08-06,
   * after three "Create fresh authorization" presses all reproduced the
   * exact same messageHash/issuedAt/signaturePrefix): a fresh ceremony run
   * must produce a build_pulse_auth_message response that DIFFERS from the
   * one already persisted for this authorizationId — an identical
   * issuedAt+message means either Horizen returned a cached response or this
   * client never actually made a live call, and signing/submitting it again
   * would reproduce the SAME rejection for the SAME reason with no new
   * information. Checked immediately after a successful (non-stale) build
   * attempt, BEFORE this attempt's nonce/issuedAt overwrite the previous
   * row — so the comparison is always against the row as it stood before
   * THIS click, and the old refused row is never touched when this fires.
   */
  | 'FRESH_AUTHORIZATION_NOT_CREATED'
  /**
   * The authoritative reread ran and could not resolve whether Pulse is
   * enabled — NOT a denial, NOT a failure, and never a reason to re-sign
   * (Al's brief, 2026-08-06: "If the submit text says success but the
   * immediate reread has not converged, retain SUBMITTED and allow refresh to
   * resolve it. Do not classify it as failure.").
   *
   * `HORIZEN_REREAD_NOT_CONFIRMED` used to be written as `REFUSED` for this
   * case, which recorded a TIMING condition as a constitutional verdict — the
   * same defect class as reading a transport timeout as a denial. Horizen's
   * genuine refusals arrive through the submit path (an `isError` result, or
   * explicit rejection prose), never through a reread that merely hasn't
   * converged yet. The row stays SUBMITTED so "Refresh partner status" can
   * settle it without recreating or resigning anything.
   */
  | 'PARTNER_STATE_UNRESOLVED'
  /**
   * The authoritative reread gave an EXPLICIT NEGATIVE, not an inconclusive
   * one (Al's follow-up brief, 2026-08-06, after a live `get_onboarding_status`
   * answered "✗ Not enrolled in Pulse monitoring. Next step: Enroll…" and was
   * classified as merely unresolved-pending — trapping the operator behind a
   * status-check button that can never change that outcome, since nothing
   * re-attempts enrollment). `classifyPulseEnrollmentState` returning
   * `NOT_ENROLLED` is itself a CONCLUSIVE answer, distinct from
   * `PARTNER_STATE_UNRESOLVED`'s "no answer yet" — retryable, and NOT a
   * signature, ownership, or cryptographic failure: every local check already
   * passed. It means only that the prior ceremony did not establish
   * enrollment. Persisted as `state: REFUSED` (retry already works via the
   * existing non-CONFIRMED/non-recent-SUBMITTED reset path in
   * partnerAuthorizationStore.ts — no new `state` value, no migration) with
   * THIS refusalCode naming the specific, conclusive reason.
   */
  | 'PARTNER_NOT_ENROLLED'
  /**
   * Horizen's OWN two services disagree about who owns this token (Al's
   * escalation, 2026-08-06, after a live investigation): their REST
   * `/agents/:id` endpoint reported `0x24BBB9C7...` as owner of token 8798 —
   * matching the on-chain mint event and a direct `ownerOf()` read, verified
   * three independent ways — while their `get_onboarding_status` MCP tool
   * reported a DIFFERENT address, `0xa6aCB16f7...`, that has never
   * transacted on-chain at all. Neither our signing wallet nor our local
   * checks are implicated: this is a partner-side data inconsistency between
   * two Horizen backends, not a signature, ownership, or wallet-configuration
   * defect on our side.
   *
   * Checked in `crossCheckRegistryOwner`, BEFORE any signing — a conflict
   * here means no local action (re-signing, choosing a different wallet,
   * retrying) can resolve it, so retrying is actively counterproductive: it
   * would just reproduce the identical rejection while consuming another
   * nonce. The UI must show BOTH addresses and must NOT offer "Create fresh
   * authorization" from this state — see PulseTransparencyToggle.tsx's
   * 'owner-source-conflict' branch.
   */
  | 'HORIZEN_OWNER_SOURCE_CONFLICT'
  | 'STATE_MISMATCH';

/**
 * WHICH of the strings in `build_pulse_auth_message`'s response was selected
 * as the canonical signable payload, and what the rejected alternative was
 * (Al's brief, 2026-08-06). Persisted alongside the authorization so a future
 * 401 can be diagnosed from the record alone — "which bytes did this attempt
 * actually sign" must never again require re-running the ceremony to answer.
 *
 * `source`:
 *   - `structured-message` — the `--- structured ---` JSON's own `message`
 *     field. The canonical case, and the fix for the 2026-08-06 401.
 *   - `named-field` / `sole-text-block` — the legacy shapes, retained
 *     unchanged for responses that carry no structured message at all.
 */
export interface PulseMessageSelection {
  source: 'structured-message' | 'named-field' | 'sole-text-block';
  /** The JSON field the message came from, when `source` is `structured-message`. */
  field: string | null;
  messageByteLength: number;
  messageHash: string;
  /** The instructional envelope that was NOT signed — null when it did not differ, or no structured selection happened. */
  outerCandidateByteLength: number | null;
  outerCandidateHash: string | null;
}

/**
 * Byte length (UTF-8, not `.length`) + hash of a candidate message. Byte
 * length is what the partner's own diagnostics report and what a "198 vs
 * 826" comparison means; `String.length` counts UTF-16 units and would
 * silently disagree on any non-ASCII message.
 */
function describeMessageSide(s: string): { length: number; byteLength: number; sha256: string } {
  return { length: s.length, byteLength: Buffer.byteLength(s, 'utf8'), sha256: sha256Hex(s) };
}

/**
 * One row of a field-by-field comparison between what was SIGNED (parsed
 * from build_pulse_auth_message's exact returned text) and what was
 * SUBMITTED (the arguments actually sent to enable_pulse_monitoring) —
 * deliberately unnormalized (al, 2026-08-04: "Do not normalize values
 * before comparison. Show exact strings and lengths"). `signedValue` is
 * `null` when no matching labelled line was found in the message at all —
 * itself informative, not an error.
 */
export interface HorizenMessageFieldParityRow {
  field: string;
  signedValue: string | null;
  submittedValue: string | null;
  equal: boolean;
}

/**
 * A bounded escalation artifact (al, 2026-08-04) — produced ONLY when
 * enable_pulse_monitoring rejects a submission that verifySignatureIntegrity
 * already confirmed locally valid (recovered signer = submitted wallet =
 * registry owner). Unlike the bounded transcript in a refusal's `detail`
 * (never the message text, never the raw signature — safe for general
 * logs), THIS artifact deliberately carries the full exact message and
 * signature, because it exists for exactly one purpose: handing Horizen (or
 * an operator escalating to them) everything needed to determine whether
 * their build and enable endpoints agree on the same message, without
 * requiring a second live reproduction. Callers MUST route this to a
 * secure/restricted surface, never general logs or a broad API response —
 * this module does not decide that placement.
 */
export interface HorizenEscalationPacket {
  tokenId: string;
  network: HorizenNetwork;
  registryContract: string;
  expectedOwner: string;
  recoveredSigner: string;
  issuedAt: string;
  endpoint: string;
  messageByteLength: number;
  messageHash: string;
  exactMessage: string;
  signature: string;
  signatureLength: number;
  signatureVByte: string;
  submittedArguments: Record<string, unknown>;
  buildTool: { name: string; inputSchema: unknown; rawResult: unknown };
  /**
   * `inputSchema` added 2026-08-05 (Horizen escalation direction: "capture
   * the complete live MCP schemas... for both build_pulse_auth_message and
   * enable_pulse_monitoring") — previously only build's schema was carried;
   * a reader could see what we sent submit but not what Horizen's own
   * schema DECLARED it expected.
   */
  submitTool: { name: string; inputSchema: unknown; rawResult: unknown };
  fieldParity: HorizenMessageFieldParityRow[];
  /**
   * WHICH candidate string in the build response was signed (Al's brief,
   * 2026-08-06). The single most important fact in a 401 escalation after
   * the 826-vs-198 discovery: it lets Horizen confirm, without a second live
   * reproduction, that the exact structured canonical message was signed.
   * Optional so standalone callers of `submitHorizenTransparencyAuthorization`
   * (unit tests) still produce a well-formed packet without it.
   */
  messageSelection?: PulseMessageSelection;
  capturedAt: string;
}

/**
 * Per-click audit trail (Al's audit brief, 2026-08-06 — "Capture and show
 * the HTTP response for each click, including: authorization request ID,
 * nonce, issuedAt, message hash, request state, whether the row was
 * inserted or reused"). Attached whenever a build attempt actually ran,
 * success or refusal, so the UI can render an "Attempt: ..." header that
 * makes replay immediately visible without reading CloudWatch. `attemptId`
 * is generated fresh per CALL (never the deterministic, per-agent
 * `authorizationId`) — it exists purely so the operator can see that THIS
 * click is a distinct event from the last one, even when the persisted
 * authorizationId is (by design) the same row.
 */
export interface AuthorizationAttemptDiagnostics {
  attemptId: string;
  authorizationId: string;
  nonce: string | null;
  issuedAt: string;
  messageHash: string;
  state: string;
  rowAction: 'inserted' | 'reset' | 'unknown';
  preparedAt: string;
  /**
   * WHICH of the build response's candidate strings this attempt signed
   * (Al's brief, 2026-08-06). Absent on refusals raised before a message was
   * ever selected. Surfaces to the UI so "did this attempt sign the 198-byte
   * canonical message or the 826-byte envelope" is answerable at a glance.
   */
  selection?: PulseMessageSelection;
}

export type AuthorizationResult<T> =
  | {
      ok: true;
      value: T;
      diagnostics?: AuthorizationAttemptDiagnostics;
      /** The complete, untruncated `enable_pulse_monitoring` response — see NormalizedMcpSubmissionResult and Al's change 5. */
      partnerResponse?: NormalizedMcpSubmissionResult;
      /**
       * The exact arguments `submitHorizenTransparencyAuthorization` sent to
       * `enable_pulse_monitoring` — added 2026-08-06 for the Nakamoto
       * correlation trace (services/horizen/pulseEnrollmentTrace.ts). Never
       * used for any decision here; a pure diagnostic carry, populated ONLY
       * by the submit stage. Server-side/log-parity only — never forwarded
       * to a client-facing route response (same discipline as
       * escalationPacket below).
       */
      submittedArguments?: Record<string, unknown>;
      /**
       * The RAW, pre-`normalizeMcpSubmissionResult` MCP tool result for
       * `enable_pulse_monitoring` — added 2026-08-06, same reason as
       * `submittedArguments`. `partnerResponse` above is the interpreted
       * form every existing caller already consumes; this is the exact bytes
       * Horizen returned, before any interpretation, which the correlation
       * trace's decision contract requires and no existing caller reads.
       */
      rawSubmitResult?: unknown;
      /**
       * The RAW `get_onboarding_status` MCP tool result from THIS reread —
       * added 2026-08-06, same reason. `verifyHorizenTransparencyActivation`
       * already computes `statusResult` internally; this exposes it rather
       * than only the classified ok/refusalCode/detail every existing caller
       * reads. Never used for any decision in this module.
       */
      rawStatusResult?: unknown;
      /** The exact arguments this reread sent to the status tool — same diagnostic-only carry as `submittedArguments`. */
      statusArgsUsed?: Record<string, unknown>;
    }
  | {
      ok: false;
      refusalCode: HorizenAuthorizationRefusalCode;
      detail: string;
      /** Populated ONLY for HORIZEN_SUBMISSION_REJECTED, after local signature integrity already passed. See HorizenEscalationPacket's own doc comment for handling requirements. */
      escalationPacket?: HorizenEscalationPacket;
      /** Populated whenever a build attempt ran before this refusal — see AuthorizationAttemptDiagnostics. */
      diagnostics?: AuthorizationAttemptDiagnostics;
      /** The complete, untruncated partner response when one was received — never summarised to "[0] type=text, NOT JSON". */
      partnerResponse?: NormalizedMcpSubmissionResult;
      /**
       * Whether this refusal can be resolved by simply trying the ceremony
       * again — set explicitly (never inferred by the UI from the refusal
       * code alone) so the surface's retry affordance and this module's own
       * notion of "retryable" cannot silently drift apart.
       */
      retryable?: boolean;
      /** See the `ok: true` branch's doc comment — same diagnostic-only carries, populated on the refusal paths that still reached the submit/status call. */
      submittedArguments?: Record<string, unknown>;
      rawSubmitResult?: unknown;
      rawStatusResult?: unknown;
      statusArgsUsed?: Record<string, unknown>;
    };

// ── Injected dependencies (never touched by Phase 1 tests — always mocked) ──

export interface PartnerMcpClient {
  listTools(): Promise<{ tools: McpTool[] }>;
  callTool(args: { name: string; arguments: Record<string, unknown> }): Promise<McpToolResult>;
}

async function defaultMcpClient(): Promise<PartnerMcpClient> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'metame-horizen-authorization-client', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(HORIZEN_REGISTRY_MCP)));
  return client as unknown as PartnerMcpClient;
}

export interface AuthorizationDeps {
  mcpClient?: PartnerMcpClient;
  /** Injected by Phase 1's tests, which mock the store and must not probe it. */
  checkStoreAvailable?: () => Promise<AuthorizationStoreAvailability>;
  fetchRegistryAgent?: (registryAlias: string, network: HorizenNetwork) => Promise<HorizenRead<Record<string, unknown>>>;
  resolveSigningKey?: ResolveSigningKey;
  now?: () => Date;
  randomNonce?: () => string;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Horizen's documented validity window for a signed Pulse authorization
 * message (partner spec — "valid for five minutes"). Used only as the
 * FALLBACK when the message text itself doesn't state its own window;
 * `parsePulseValidForMs` always prefers what the partner actually said.
 */
const PULSE_AUTH_DEFAULT_VALIDITY_MS = 5 * 60 * 1000;

/** How many total attempts at `build_pulse_auth_message` a single prepare
 *  call will make before giving up on staleness — one fresh call, one
 *  retry. Never more: a persistently stale response is a partner-side or
 *  clock-skew condition to surface, not to mask with silent retries. */
const PULSE_AUTH_MAX_BUILD_ATTEMPTS = 2;

/**
 * The partner-stated validity window, if the message names one (e.g. "valid
 * for 5 minutes") — never guessed. Returns null when absent, so the caller
 * falls back to `PULSE_AUTH_DEFAULT_VALIDITY_MS` explicitly rather than this
 * function silently supplying it.
 */
function parsePulseValidForMs(message: string): number | null {
  const m = message.match(/valid\s+for\s+(\d+)\s*minute/i);
  return m ? parseInt(m[1], 10) * 60 * 1000 : null;
}

const BUILD_TOOL_SPEC = {
  role: 'build',
  nameCandidates: ['build_pulse_auth_message'],
  requiredFieldHints: ['tokenid', 'agentid', 'network', 'wallet', 'address'],
};
const SUBMIT_TOOL_SPEC = {
  role: 'submit',
  nameCandidates: ['enable_pulse_monitoring'],
  requiredFieldHints: ['signature', 'signedmessage', 'signedpayload', 'authorization'],
};
const STATUS_TOOL_SPEC = {
  role: 'status',
  nameCandidates: ['get_onboarding_status', 'get_pulse_status', 'pulse_status', 'pulse-status'],
  requiredFieldHints: ['tokenid', 'agentid', 'transactionhash', 'txhash', 'submissionref'],
};

/**
 * The candidate values a Pulse build call may need, offered by name for
 * `matchSchemaFields` to select from against the tool's DECLARED schema.
 *
 * ── WHY THIS IS EXPORTED (2026-08-03) ─────────────────────────────────────
 *
 * `scripts/horizen-pulse-diagnostic.ts` — the tool built expressly to stop us
 * guessing about this call — hand-rolled its own argument object instead. It
 * sent `wallet`, Horizen's schema requires `walletAddress`, and the run
 * reported `walletAddress Required` as though that were the client's defect.
 * It is not: `matchSchemaFields` matches on containment, so `walletAddress`
 * picks up the `wallet` candidate and the real client sends it correctly.
 *
 * So the diagnostic manufactured a failure the code under diagnosis does not
 * have, and cost a round trip chasing it. A diagnostic that does not execute
 * the path it claims to diagnose is worse than none — it produces confident
 * wrong answers. That is inv.engineering.036/037 landing inside the very tool
 * meant to enforce evidence over inference. One definition, both callers.
 */
export function pulseBuildCandidates(
  facts: (typeof HORIZEN_NETWORK_FACTS)[HorizenNetwork],
  decimalAgentId: string,
  controllerWallet: string,
): Record<string, unknown> {
  return {
    // Pulse enable/disable is one tool; this path only ever enables. Disabling
    // is a separate governed act and is deliberately not wired here.
    action: 'enable',
    tokenId: decimalAgentId,
    agentId: decimalAgentId,
    network: facts.pulseSelector,
    chain: facts.pulseSelector,
    chainId: facts.chainId,
    registry: facts.identityRegistry.toLowerCase(),
    registryAddress: facts.identityRegistry.toLowerCase(),
    wallet: controllerWallet.toLowerCase(),
    address: controllerWallet.toLowerCase(),
  };
}

/**
 * The candidate values ANY Horizen status/onboarding read may need —
 * `chain`/`chainId`, not just `network`, for the SAME reason
 * `pulseBuildCandidates` already carries all three (Horizen, confirmed
 * 2026-08-06 directly: "get_onboarding_status defaults to base-mainnet when
 * you omit chain. Pass chain: 'base-sepolia' and it returns [Nakamoto's real
 * wallet]... I hit the same trap on my first lookup").
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * Both status-read call sites below (`fetchOnboardingStatusOwner`'s owner
 * cross-check, and the authoritative enrollment reread) hand-rolled their own
 * candidate object with `network` alone — never `chain`. `matchSchemaFields`
 * matches by NAME, not by meaning: a schema property literally called
 * `chain` never matches a candidate key called `network` (neither string
 * contains the other), so on a partner tool whose schema names it `chain`,
 * the argument was silently omitted and the tool defaulted to base-mainnet.
 * That defaulted lookup returned an unrelated agent's owner on mainnet
 * (token 8798 happens to exist there too, coincidentally) — which is the
 * entire evidence trail behind the now-closed `HORIZEN_OWNER_SOURCE_CONFLICT`
 * investigation: not a partner-side data inconsistency, a local chain-
 * resolution omission. `pulseBuildCandidates` already carried the fix for
 * the BUILD call; these two reads just never reused it (inv.engineering.
 * 036/037 — one authoritative candidate set, not three).
 */
export function pulseStatusCandidates(
  facts: (typeof HORIZEN_NETWORK_FACTS)[HorizenNetwork],
  agentId: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    tokenId: agentId,
    agentId,
    network: facts.pulseSelector,
    chain: facts.pulseSelector,
    chainId: facts.chainId,
    ...extra,
  };
}

// ── Stage 1: prepare ─────────────────────────────────────────────────────

export interface PrepareHorizenTransparencyAuthorizationInput {
  authorizationId: string;
  /** The operator's own persona — the principal recording this act, resolved by the caller via the identity spine. Never derived from aigentQubeId. */
  actorPersonaId: string;
  aigentQubeId: string;
  agentCardHash: string;
  controllerWallet: string;
  keyRef: string;
  registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
  scope: string[];
  expiresInSeconds?: number;
  /**
   * Enrollment metadata `enable_pulse_monitoring`'s live schema requires
   * (al / Horizen brief, 2026-08-04) — NOT part of the signed message
   * (`build_pulse_auth_message`'s ASR body carries only agentId/network/
   * chain/registry/wallet/issuedAt), so these two are resolved fresh at
   * submit time rather than persisted.
   *
   * `pulseEndpoint` MUST be resolved by the caller from the agent's own
   * canonical Agent Card `services[]` entry — never invented, never the
   * Agent Card URL itself unless the card explicitly declares that as the
   * monitored service. The caller refuses locally (before this pipeline is
   * even invoked) when no eligible public HTTPS endpoint exists.
   */
  agentDisplayName: string;
  pulseEndpoint: string;
}

export interface PreparedAuthorization {
  authorizationId: string;
  /** Fresh per call, never the deterministic authorizationId — see AuthorizationAttemptDiagnostics. */
  attemptId: string;
  actorPersonaId: string;
  envelope: HorizenTransparencyAuthorization;
  /** The exact partner-supplied message text this envelope's signature must be produced over. Preserved verbatim, never altered. */
  message: string;
  /** WHICH candidate in the build response `message` was selected from — see PulseMessageSelection. */
  selection: PulseMessageSelection;
  /**
   * Carried forward ONLY so a submission rejection can attach a full
   * HorizenEscalationPacket naming exactly what the build stage declared and
   * returned (al, 2026-08-04: "print the live MCP inputSchema and complete
   * successful output from build_pulse_auth_message"). Never used for any
   * decision in this pipeline — a pure diagnostic carry.
   */
  buildToolName: string;
  buildToolInputSchema: unknown;
  rawBuildResult: unknown;
}

export async function prepareHorizenTransparencyAuthorization(
  input: PrepareHorizenTransparencyAuthorizationInput,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<PreparedAuthorization>> {
  // Generated FIRST, unconditionally, and independent of deps.randomNonce
  // (which governs the PERSISTED nonce, not this diagnostic-only id) — every
  // diagnostic and refusal below that names an attempt uses this same id, so
  // a click that fails early (e.g. INVALID_REQUEST) is still a
  // distinguishable, loggable event.
  const attemptId = randomUUID();

  if (!input.actorPersonaId || !input.aigentQubeId || !input.agentCardHash || !input.controllerWallet || !input.keyRef || !input.scope?.length) {
    return { ok: false, refusalCode: 'INVALID_REQUEST', detail: 'actorPersonaId, aigentQubeId, agentCardHash, controllerWallet, keyRef and a non-empty scope are all required' };
  }
  if (!input.agentDisplayName || !input.pulseEndpoint) {
    return { ok: false, refusalCode: 'INVALID_REQUEST', detail: 'agentDisplayName and pulseEndpoint are required — enable_pulse_monitoring cannot enroll without them' };
  }
  if (!input.registry?.tokenId) {
    return { ok: false, refusalCode: 'MISSING_TOKEN_ID', detail: 'registry.tokenId is required' };
  }
  const facts = HORIZEN_NETWORK_FACTS[input.registry.network];
  if (!facts) {
    return { ok: false, refusalCode: 'NETWORK_OR_CONTRACT_MISMATCH', detail: `"${input.registry.network}" is not a recognised Horizen network` };
  }

  /*
   * A LOCAL PREREQUISITE IS CHECKED LOCALLY, BEFORE ANY OUTBOUND ACT
   * (operator, 2026-08-03).
   *
   * This function used to call Horizen — listTools, then build the
   * authorization message — and only afterwards try to persist the request.
   * So a missing local table surfaced as:
   *
   *   createPartnerAuthorizationRequest failed: Could not find the table
   *   'public.partner_authorization_requests' in the schema cache
   *
   * …AFTER the partner had already been asked to do work. That is backwards
   * twice over: we ask an external party for something we cannot record, and
   * the operator learns about a deploy step from a partner-facing ceremony.
   *
   * `deps.checkStoreAvailable` is injectable so Phase 1's tests, which mock
   * the store entirely, are not forced through a real availability probe.
   */
  const checkStore = deps.checkStoreAvailable ?? defaultCheckStoreAvailable;
  const storeState = await checkStore();
  if (!storeState.available) {
    return {
      ok: false,
      refusalCode: 'AUTHORIZATION_STORE_UNAVAILABLE',
      detail:
        `The local authorization store is unavailable (${storeState.kind}), so this request could not be ` +
        `recorded and Horizen was NOT called — nothing was authorized and nothing needs undoing. ` +
        `${storeState.detail}. Remedy: ${storeState.remedy}`,
    };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { tools } = await mcpClient.listTools();
  const buildTool = findCompatibleTool(tools, BUILD_TOOL_SPEC, new Set());
  if (!buildTool.ok) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND',
      detail: `no tool compatible with role "build" declared by Horizen's MCP server. Declared tools: ${buildTool.declaredToolNames.join(', ') || '(none)'}`,
    };
  }

  /*
   * CONFORM TO THE DOCUMENTED CONTRACT, NOT TO WHAT HAPPENED TO COMPILE
   * (Horizen partner Q&A, relayed 2026-08-03).
   *
   * Pulse authorization is a Horizen capability layered ON TOP of ERC-8004
   * registration, not part of it. Its message is byte-exact plaintext and the
   * arguments that produce it are specified:
   *
   *   ASR Pulse enable
   *   Agent: 7866                      <- DECIMAL, never hex, never a label
   *   Network: sepolia
   *   Chain: 84532                     <- the CHAIN ID, not a network name
   *   Registry: 0x8004a818…            <- LOWERCASED
   *   Wallet: 0x…                      <- LOWERCASED, and must equal ownerOf(agentId)
   *   Issued At: <ISO-8601>
   *
   * Every one of those facts already lived in `HORIZEN_NETWORK_FACTS` and
   * `parseAgentId` (services/horizen/identity.ts) — this call simply wasn't
   * reading them. `chain` was being sent the string 'base-sepolia' where the
   * chain id 84532 belongs, and the network selector was the raw key rather
   * than `facts.pulseSelector`. That is inv.engineering.036/037 in its usual
   * shape: the authoritative source existed and a consumer bypassed it.
   */
  const parsedAgentId = parseAgentId(input.registry.tokenId);
  if (!parsedAgentId.ok) {
    return {
      ok: false,
      refusalCode: 'INVALID_REQUEST',
      detail: `registry.tokenId "${input.registry.tokenId}" is not a usable agent id (${parsedAgentId.reason}): ${parsedAgentId.detail}`,
    };
  }
  // Hex in the registry, decimal in Pulse/PnL — the partner Q&A is explicit
  // that these are the SAME identifier and must be normalised via BigInt.
  const decimalAgentId = parsedAgentId.value.toString(10);

  /*
   * `chain` IS THE NETWORK SELECTOR, NOT THE CHAIN ID — corrected 2026-08-03
   * from Horizen's own schema rejection:
   *
   *   chain: expected 'base-mainnet' | 'base-sepolia', received number
   *   action: expected 'enable' | 'disable', received undefined, Required
   *
   * I had read `Chain: 84532` from the Q&A's MESSAGE BODY and applied it to
   * the tool ARGUMENT. Those are different contracts: 84532 is what Horizen
   * writes INTO the plaintext it returns; the argument that selects the
   * network is the same string selector as `network`. Converging on "the
   * contract" means the contract for the thing being called, not a
   * neighbouring one — and the tool's own declared inputSchema, which we
   * already fetch, outranks any prose about it.
   */
  /*
   * THE EXACT STRING EMBEDDED IN THE SIGNED MESSAGE — CAPTURED HERE, NEVER
   * RE-DERIVED AT SUBMIT (Horizen partner confirmation, 2026-08-05).
   *
   *   > "The server never reads your message field. It reconstructs the
   *   >  signed message server-side from (action, agentId, walletAddress,
   *   >  issuedAt, chain) and verifies the signature against its own
   *   >  reconstruction... byte-for-byte identity has to hold between what
   *   >  the wallet signed and what the server rebuilds."
   *
   * `pulseBuildCandidates` lowercases the wallet before sending it to
   * `build_pulse_auth_message` — so the message we go on to SIGN embeds the
   * LOWERCASE address. Before this fix, the persisted record (and therefore
   * `submitHorizenTransparencyAuthorization`'s `walletAddress` argument) kept
   * `input.controllerWallet` AS GIVEN — `AgentKeyService` returns an
   * EIP-55-checksummed address, so the value submit sent back differed from
   * the build-time value BY CASE ALONE. Horizen's server-side reconstruction
   * then embedded the checksummed casing, producing a message that was
   * never actually signed — recovered signer still equalled the true owner
   * (case-insensitive recovery), so every LOCAL check passed while the
   * PARTNER's own signature verification failed with exactly `401 — Invalid
   * signature`. Exactly the same class of defect `issuedAt` was fixed for
   * above (2026-08-04) — captured from what was actually SENT, never
   * re-read from a differently-cased source at the next stage.
   */
  const messageWalletAddress = input.controllerWallet.toLowerCase();
  const buildArgs = matchSchemaFields(buildTool.tool.inputSchema, pulseBuildCandidates(facts, decimalAgentId, messageWalletAddress));

  // Fail HERE, naming the field, rather than at the partner with a generic
  // validation dump — the schema was in hand before the call was made.
  const missing = missingRequiredFields(buildTool.tool.inputSchema, buildArgs);
  if (missing.length > 0) {
    return {
      ok: false,
      refusalCode: 'INVALID_REQUEST',
      detail:
        `"${buildTool.tool.name}" declares required argument(s) this client supplies no value for: ` +
        `${missing.join(', ')}. Declared schema: ${JSON.stringify(buildTool.tool.inputSchema?.properties ?? {})}`,
    };
  }
  const now = deps.now ?? (() => new Date());
  const MESSAGE_FIELDS = ['message', 'payload', 'authMessage', 'messageToSign', 'authorizationMessage'];

  type BuildAttempt =
    | {
        kind: 'ok';
        buildResult: McpToolResult;
        message: string;
        issuedAt: string;
        selection: PulseMessageSelection;
      }
    | { kind: 'refuse'; refusalCode: HorizenAuthorizationRefusalCode; detail: string }
    | { kind: 'stale'; issuedAt: string; ageMs: number; validForMs: number };

  /*
   * ONE ATTEMPT: call build_pulse_auth_message, select the canonical signable
   * message, extract issuedAt, and check it against ITS OWN validity window.
   * Never signs, never submits, never persists anything — a pure
   * read-and-check, safe to repeat.
   */
  async function attemptBuild(): Promise<BuildAttempt> {
    const buildResult = await mcpClient.callTool({ name: buildTool.tool.name, arguments: buildArgs });

    /*
     * ── CANONICAL MESSAGE SELECTION (Al's brief, 2026-08-06) ────────────────
     *
     * THE STRUCTURED `message` FIELD WINS. This is the fix for the repeated
     * `401 Invalid signature`, and it changes exactly one assumption: which
     * of the two strings Horizen returns is the authorization payload.
     *
     * The live response carries BOTH:
     *   - an 826-byte instructional envelope beginning "Sign this message
     *     with wallet …", which embeds the human-readable body AND a
     *     `--- structured ---` JSON block;
     *   - inside that JSON, a 198-byte `message` field beginning "ASR Pulse
     *     enable\nAgent: 8798\n…".
     *
     * Both carry the same operational FIELDS — which is why every
     * field-parity check passed while the bytes and hashes differed
     * completely (826/1c60a368… vs 198/784fe278…). We were signing the
     * envelope. `enable_pulse_monitoring` accepts no message argument at
     * all, so Horizen's server RECONSTRUCTS the canonical message and
     * verifies against that. A signature over the envelope therefore
     * recovers perfectly to the correct owner locally and still fails the
     * partner's verification — precisely the observed symptom.
     *
     * The partner's own machine-readable `message` field is a stronger
     * statement of "this is what to sign" than any text heuristic over the
     * prose around it, so it is selected outright rather than compared and
     * refused. The 2026-08-05 drift instrumentation is what produced this
     * evidence; it is now narrowed (below) to the one case that remains
     * genuinely undecidable.
     */
    const structuredAttempt = extractStructuredMessageField(buildResult, MESSAGE_FIELDS);

    /*
     * The ONE surviving fail-closed case: the embedded JSON names two or more
     * candidate message fields carrying DISTINCT strings. No local rule can
     * decide which the partner reconstructs against, so refuse rather than
     * pick (Al: "Two conflicting structured canonical messages still fail
     * closed"). Fields that agree byte-for-byte are not a conflict.
     */
    if (!structuredAttempt.found && structuredAttempt.conflict) {
      return {
        kind: 'refuse',
        refusalCode: 'PULSE_MESSAGE_DRIFT',
        detail:
          `"${buildTool.tool.name}"'s structured response declares conflicting canonical message fields ` +
          `(${structuredAttempt.conflict.fields.join(', ')}) carrying different strings — refusing rather than ` +
          `guessing which one Horizen's server reconstructs against. ${structuredAttempt.reason}`,
      };
    }

    if (structuredAttempt.found) {
      // The exact string JSON decoding produced — never trimmed, never
      // normalized, never rebuilt from the labelled lines around it.
      const message = structuredAttempt.message;
      const outer = extractPartnerMessage(buildResult, MESSAGE_FIELDS);
      const outerCandidate = outer.ok && outer.message !== message ? describeMessageSide(outer.message) : null;
      const selected = describeMessageSide(message);
      /*
       * The rejected envelope is RECORDED, not refused on — a noncanonical
       * diagnostic candidate. This log line is what proves, from CloudWatch
       * alone, which of the two strings a given attempt actually signed.
       */
      console.log(
        `[PULSE MESSAGE SELECTION] "${buildTool.tool.name}" canonical message selected from structured field ` +
          `"${structuredAttempt.field}" (markerPresent: ${structuredAttempt.markerPresent}): ` +
          `length ${selected.length}, sha256 ${selected.sha256}. ` +
          (outerCandidate
            ? `Noncanonical outer candidate NOT signed: length ${outerCandidate.length}, sha256 ${outerCandidate.sha256}.`
            : 'No differing outer candidate.'),
      );
      const issuedAtCheck = resolveIssuedAtOrRefuse(buildResult, message, buildTool.tool.name);
      if (issuedAtCheck.kind !== 'ok') return issuedAtCheck;
      return {
        kind: 'ok',
        buildResult,
        message,
        issuedAt: issuedAtCheck.issuedAt,
        selection: {
          source: 'structured-message',
          field: structuredAttempt.field,
          messageByteLength: selected.byteLength,
          messageHash: selected.sha256,
          outerCandidateByteLength: outerCandidate?.byteLength ?? null,
          outerCandidateHash: outerCandidate?.sha256 ?? null,
        },
      };
    }

    /*
     * NO STRUCTURED MESSAGE AT ALL — the legacy shapes keep working exactly
     * as before: a named top-level field, or a lone non-error text block
     * (Horizen's earlier 265-char plain-text response, established by the
     * 2026-08-03 diagnostic). This fallback is unchanged and still refuses
     * rather than inventing when neither shape is present.
     */
    const extracted = extractPartnerMessage(buildResult, MESSAGE_FIELDS);
    if (!extracted.ok) {
      return {
        kind: 'refuse',
        refusalCode: 'PARTNER_MESSAGE_UNAVAILABLE',
        detail:
          `"${buildTool.tool.name}" did not return a usable message — refusing rather than inventing one. ` +
          `${extracted.reason}. Looked for fields: ${MESSAGE_FIELDS.join(', ')}. ` +
          `No structured message either (${structuredAttempt.reason}). ` +
          `Actually returned: ${describeToolResultShape(buildResult)}`,
      };
    }
    const message = extracted.message;
    const selected = describeMessageSide(message);
    const issuedAtCheck = resolveIssuedAtOrRefuse(buildResult, message, buildTool.tool.name);
    if (issuedAtCheck.kind !== 'ok') return issuedAtCheck;
    return {
      kind: 'ok',
      buildResult,
      message,
      issuedAt: issuedAtCheck.issuedAt,
      selection: {
        source: extracted.via === 'named-field' ? 'named-field' : 'sole-text-block',
        field: null,
        messageByteLength: selected.byteLength,
        messageHash: selected.sha256,
        outerCandidateByteLength: null,
        outerCandidateHash: null,
      },
    };
  }

  /**
   * `issuedAt` extraction + the staleness check, shared by both selection
   * paths above so neither can drift from the other (inv.engineering.036/037:
   * one authoritative location). Returns a `BuildAttempt` refusal/stale
   * verdict directly, or `{kind:'ok', issuedAt}` on success.
   */
  function resolveIssuedAtOrRefuse(
    buildResult: McpToolResult,
    message: string,
    toolName: string,
  ): { kind: 'ok'; issuedAt: string } | Extract<BuildAttempt, { kind: 'refuse' } | { kind: 'stale' }> {
    /*
     * NEVER REGENERATE issuedAt (al / Horizen brief, 2026-08-04). This used to
     * be `now().toISOString()` — a value independently generated AFTER the
     * build call returned, with no relationship to what the signed message
     * actually says. `enable_pulse_monitoring`'s own live schema requires back
     * "the issuedAt returned by build_pulse_auth_message"; Horizen's signature
     * verification reconstructs the message server-side using ITS OWN
     * issuedAt, so submitting any other value fails verification even with an
     * otherwise-correct call. Extracted from the selected message text itself
     * — never generated, never guessed.
     */
    const issuedAt = extractIssuedAt(message);
    if (!issuedAt) {
      return {
        kind: 'refuse',
        refusalCode: 'ISSUED_AT_UNAVAILABLE',
        detail:
          `"${toolName}"'s response did not contain a recognisable issuedAt — refusing rather than ` +
          `generating one, since enable_pulse_monitoring requires back the EXACT value embedded in the signed ` +
          `message. Looked for: issuedAt="...", "Issued At: ...". Actually returned: ${describeToolResultShape(buildResult)}`,
      };
    }

    /*
     * A SIGNATURE MAY RECOVER TO THE CORRECT OWNER INDEFINITELY WHILE STILL
     * BEING INVALID FOR THE PARTNER CEREMONY (operator escalation, 2026-08-05):
     * Horizen's server-side reconstruction refuses a stale `issuedAt` even
     * when the signed bytes and submitted bytes agree byte-for-byte — a live
     * rejection's transcript showed the SAME issuedAt reappearing on what was
     * reported as a fresh retry. Checked here, immediately after extraction,
     * so a stale response never reaches signing at all.
     */
    const validForMs = parsePulseValidForMs(message) ?? PULSE_AUTH_DEFAULT_VALIDITY_MS;
    const ageMs = now().getTime() - Date.parse(issuedAt);
    if (!Number.isFinite(ageMs) || ageMs > validForMs) {
      return { kind: 'stale', issuedAt, ageMs, validForMs };
    }
    return { kind: 'ok', issuedAt };
  }

  let attempt: BuildAttempt = { kind: 'stale', issuedAt: '', ageMs: 0, validForMs: 0 };
  for (let i = 1; i <= PULSE_AUTH_MAX_BUILD_ATTEMPTS; i += 1) {
    attempt = await attemptBuild();
    if (attempt.kind !== 'stale') break;
    if (i === PULSE_AUTH_MAX_BUILD_ATTEMPTS) {
      return {
        ok: false,
        refusalCode: 'PULSE_AUTHORIZATION_EXPIRED',
        detail:
          `"${buildTool.tool.name}" returned an issuedAt (${attempt.issuedAt}) already ` +
          `${Math.round(attempt.ageMs / 1000)}s old — beyond its ${Math.round(attempt.validForMs / 1000)}s validity ` +
          `window — on ${i} of ${PULSE_AUTH_MAX_BUILD_ATTEMPTS} attempts. Refusing to sign an already-expired ` +
          'authorization rather than submit it and receive Horizen\'s rejection for a reason this check already caught.',
      };
    }
    // Loop again — a genuinely FRESH build_pulse_auth_message call, never
    // reusing this attempt's message, issuedAt or anything derived from it.
  }
  if (attempt.kind === 'refuse') {
    return { ok: false, refusalCode: attempt.refusalCode, detail: attempt.detail };
  }
  const { buildResult, message, issuedAt, selection } = attempt;
  // The SELECTED message's own hash — the same value persisted as
  // payload_hash, signed over, and reported in diagnostics. One derivation,
  // never a second one computed from a differently-selected string.
  const messageHash = selection.messageHash;

  /*
   * FRESH_AUTHORIZATION_NOT_CREATED — THE HARD LOCAL GUARD (Al's audit
   * brief, 2026-08-06). The staleness check above already ran on THIS
   * response's own age; it cannot detect a response that looks
   * superficially current-enough on age but is actually the same bytes
   * Horizen (or a caching layer in front of it) returned last time — which
   * is exactly what three consecutive "Create fresh authorization" presses
   * reproduced (identical messageHash, identical issuedAt, identical
   * signature prefix). Compared against the row AS IT STOOD BEFORE this
   * click — never against anything this attempt is about to write — so a
   * genuinely fresh build (different issuedAt OR different message text)
   * always passes, and the prior REFUSED/EXPIRED row is left untouched when
   * this fires (Al: "the old refused row remains immutable for audit").
   */
  const priorRecord = await getPartnerAuthorizationRequest(input.authorizationId);
  if (priorRecord && priorRecord.issuedAt === issuedAt && priorRecord.payloadHash === messageHash) {
    const detail =
      `"${buildTool.tool.name}" returned an issuedAt (${issuedAt}) and message identical to the ALREADY-PERSISTED ` +
      `attempt for this authorization (state: ${priorRecord.state}) — this is not a fresh ceremony. Refusing ` +
      `locally rather than signing and submitting the same bytes again. The prior record is untouched.`;
    console.error(`[PULSE AUTHORIZATION LIFECYCLE] authorization "${input.authorizationId}": ${detail}`);
    return {
      ok: false,
      refusalCode: 'FRESH_AUTHORIZATION_NOT_CREATED',
      detail,
      diagnostics: {
        attemptId,
        authorizationId: input.authorizationId,
        nonce: priorRecord.nonce,
        issuedAt,
        messageHash,
        state: priorRecord.state,
        rowAction: 'unknown',
        preparedAt: now().toISOString(),
      },
    };
  }

  const nonce = deps.randomNonce ? deps.randomNonce() : sha256Hex(`${input.authorizationId}:${now().toISOString()}:${Math.random()}`).slice(0, 32);
  const expiresAt = new Date(now().getTime() + (input.expiresInSeconds ?? 900) * 1000).toISOString();

  const created = await createPartnerAuthorizationRequest({
    authorizationId: input.authorizationId,
    purpose: 'horizen-financial-transparency',
    subjectAigentQubeId: input.aigentQubeId,
    keyRef: input.keyRef,
    partner: 'horizen',
    network: input.registry.network,
    nonce,
    expiresAt,
    agentId: decimalAgentId,
    // The EXACT string sent to build_pulse_auth_message — see
    // `messageWalletAddress`'s own comment above. Never `input.controllerWallet`
    // as given; that casing is not provably what the signed message embeds.
    walletAddress: messageWalletAddress,
    issuedAt,
  });
  if (!created.ok) {
    // Pass the store's own refusalCode through VERBATIM (fixed 2026-08-04) —
    // this used to hardcode NONCE_MISSING_OR_REPLAYED regardless of what the
    // store actually reported, mislabeling e.g. a LOCAL_PERSISTENCE_FAILED
    // schema-drift refusal as a nonce replay.
    return {
      ok: false,
      refusalCode: created.refusalCode,
      detail: created.detail,
      diagnostics: {
        attemptId,
        authorizationId: input.authorizationId,
        nonce,
        issuedAt,
        messageHash,
        state: created.refusalCode === 'AUTHORIZATION_ALREADY_IN_FLIGHT' ? created.existingState : 'unknown',
        rowAction: 'unknown',
        preparedAt: now().toISOString(),
      },
    };
  }

  const envelope: HorizenTransparencyAuthorization = {
    version: '1.0',
    aigentQubeId: input.aigentQubeId,
    agentCardHash: input.agentCardHash,
    registry: {
      protocol: 'erc-8004',
      network: input.registry.network,
      contract: facts.identityRegistry,
      tokenId: input.registry.tokenId,
      registryAlias: input.registry.registryAlias,
    },
    controllerWallet: input.controllerWallet,
    authorization: {
      pulseMonitoring: true,
      pnlDisclosure: true,
      purpose: 'horizen-financial-transparency',
      scope: input.scope,
    },
    nonce,
    issuedAt,
    expiresAt,
    messageHash,
  };

  await updatePartnerAuthorizationRequest(input.authorizationId, { state: 'PREPARED', payloadHash: envelope.messageHash });

  return {
    ok: true,
    value: {
      authorizationId: input.authorizationId,
      attemptId,
      actorPersonaId: input.actorPersonaId,
      envelope,
      message,
      selection,
      buildToolName: buildTool.tool.name,
      buildToolInputSchema: buildTool.tool.inputSchema,
      rawBuildResult: buildResult,
    },
    diagnostics: {
      attemptId,
      authorizationId: input.authorizationId,
      nonce,
      issuedAt,
      messageHash,
      state: 'PREPARED',
      rowAction: created.wasReset ? 'reset' : 'inserted',
      preparedAt: now().toISOString(),
      selection,
    },
  };
}

// ── Stage 2: sign ────────────────────────────────────────────────────────

export async function signHorizenTransparencyAuthorization(
  prepared: PreparedAuthorization,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<PartnerAuthorizationSignature>> {
  const record = await getPartnerAuthorizationRequest(prepared.authorizationId);
  if (!record || record.state !== 'PREPARED') {
    return { ok: false, refusalCode: 'STATE_MISMATCH', detail: `authorization "${prepared.authorizationId}" is not in PREPARED state` };
  }
  await updatePartnerAuthorizationRequest(prepared.authorizationId, { state: 'AWAITING_SIGNATURE' });

  const signed = await signPartnerAuthorization(
    {
      keyRef: record.keyRef,
      payload: prepared.message,
      purpose: record.purpose,
      expectedSigner: prepared.envelope.controllerWallet,
      network: record.network,
      expiresAt: record.expiresAt,
    },
    { resolveSigningKey: deps.resolveSigningKey, now: deps.now },
  );
  if (!signed.ok) {
    const refusalCode = signed.refusalCode === 'EXPIRED' ? 'AUTHORIZATION_EXPIRED' : 'SIGNING_FAILED';
    await updatePartnerAuthorizationRequest(prepared.authorizationId, { state: 'REFUSED', refusalCode, refusalDetail: signed.detail });
    return { ok: false, refusalCode, detail: signed.detail };
  }

  await updatePartnerAuthorizationRequest(prepared.authorizationId, {
    state: 'SIGNED',
    signerAddress: signed.result.signerAddress,
    signatureRef: sha256Hex(signed.result.signature),
  });
  return { ok: true, value: signed.result };
}

// ── Stage 3: submit ──────────────────────────────────────────────────────

/**
 * A BOUNDED, SAFE diagnostic transcript (al, 2026-08-04: "If local recovery
 * does equal the ERC-8004 owner and Horizen still rejects it... output a
 * safe signature transcript and escalate it... as a contract discrepancy
 * rather than adding more inference code"). Attached ONLY when Horizen
 * rejects a submission this client already verified locally
 * (verifySignatureIntegrity ran before submit was ever called) — the point
 * is to hand a partner-facing escalation exactly the facts needed to
 * distinguish a signature-format variant this integration hasn't matched
 * from a genuine server-side defect, nothing more. Deliberately narrow:
 * message BYTE LENGTH and a HASH of it, never the message text itself; the
 * signature's length/prefix/v-byte, never anything secret (the private key
 * never reaches this function at all). Every field is a fact already
 * computed for this exact submission — nothing inferred, nothing guessed.
 */
function buildSignatureDiagnosticTranscript(args: {
  message: string;
  signature: PartnerAuthorizationSignature;
  expectedOwner: string;
  agentId: string;
  issuedAt: string;
  endpoint: string;
}): Record<string, string | number> {
  const sig = args.signature.signature;
  return {
    messageByteLength: Buffer.byteLength(args.message, 'utf8'),
    messageHash: sha256Hex(args.message),
    recoveredSigner: args.signature.signerAddress,
    expectedOwner: args.expectedOwner,
    signatureLength: sig.length,
    signaturePrefix: sig.slice(0, 10),
    signatureVByte: sig.length >= 2 ? sig.slice(-2) : '',
    agentId: args.agentId,
    issuedAt: args.issuedAt,
    endpoint: args.endpoint,
  };
}

/**
 * Parses `Label: value` lines out of the ASR message text — the format
 * every documented example uses ("Agent: 7866", "Network: sepolia",
 * "Issued At: <ISO-8601>", ...). Labels are captured EXACTLY as they appear
 * (case, spacing) so a caller can inspect what the message actually said;
 * matching against a canonical field name for the parity table below is a
 * SEPARATE, case-insensitive step, never baked into this parse.
 */
export function parseLabelledMessageFields(message: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of message.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.+?)\s*$/.exec(line);
    if (m) fields.set(m[1], m[2]);
  }
  return fields;
}

/** Every spelling variant this integration has seen or documented for each canonical field the ASR message may name — case-insensitive lookup keys only. */
const FIELD_LABEL_CANDIDATES: Record<string, string[]> = {
  agentId: ['agent', 'agentid', 'agent id'],
  name: ['name'],
  endpoint: ['endpoint'],
  walletAddress: ['wallet', 'walletaddress', 'wallet address'],
  issuedAt: ['issued at', 'issuedat'],
  action: ['action'],
  network: ['network'],
  chain: ['chain'],
  chainId: ['chain id', 'chainid'],
  registry: ['registry', 'registry address', 'registry contract'],
};

/**
 * The field-by-field parity report (al, 2026-08-04): "Parse every factual
 * field from the signed text and produce a parity report... Do not
 * normalize values before comparison. Show exact strings and lengths."
 * Exact string equality only — no case-folding, no trimming beyond what the
 * line parser already does to isolate the value from its label, no address
 * checksum normalization. A field absent from BOTH is still reported
 * (`equal: false` when either side is null) so a caller sees explicitly
 * that no comparison could be made, rather than the row being silently
 * dropped.
 */
export function buildFieldParityTable(message: string, submitted: Record<string, unknown>): HorizenMessageFieldParityRow[] {
  const parsedLabels = parseLabelledMessageFields(message);
  const lowerLabelMap = new Map<string, string>();
  for (const [label, value] of parsedLabels) lowerLabelMap.set(label.toLowerCase(), value);

  return Object.entries(FIELD_LABEL_CANDIDATES).map(([field, candidates]) => {
    let signedValue: string | null = null;
    for (const candidate of candidates) {
      if (lowerLabelMap.has(candidate)) {
        signedValue = lowerLabelMap.get(candidate)!;
        break;
      }
    }
    const raw = submitted[field];
    const submittedValue = raw === undefined || raw === null ? null : String(raw);
    return {
      field,
      signedValue,
      submittedValue,
      equal: signedValue !== null && submittedValue !== null && signedValue === submittedValue,
    };
  });
}

export interface PulseArgumentDrift {
  field: string;
  builtValue: string;
  submitValue: string;
}

/**
 * BYTE-FOR-BYTE, NEVER CASE-INSENSITIVE (Horizen partner confirmation,
 * 2026-08-05) — the exact defect this catches (a wallet address that
 * recovers to the same signer under either casing but reconstructs a
 * DIFFERENT message string) is invisible to a case-insensitive compare.
 * Checks only fields actually present in `submitArgs` — a schema that
 * declares neither `walletAddress` nor `signerAddress` has nothing to drift
 * on for that fact, and `missingRequiredFields` already refused it earlier
 * if the schema required one.
 */
export function detectPulseArgumentDrift(
  record: { agentId: string | null; walletAddress: string | null; issuedAt: string | null; network: string },
  submitArgs: Record<string, unknown>,
): PulseArgumentDrift[] {
  const drift: PulseArgumentDrift[] = [];
  const check = (field: string, builtValue: string | null, submitValue: unknown) => {
    if (builtValue === null || submitValue === undefined) return;
    if (String(submitValue) !== builtValue) {
      drift.push({ field, builtValue, submitValue: String(submitValue) });
    }
  };
  check('agentId', record.agentId, submitArgs.agentId);
  check('walletAddress', record.walletAddress, submitArgs.walletAddress ?? submitArgs.signerAddress);
  check('issuedAt', record.issuedAt, submitArgs.issuedAt);
  check('chain', record.network, submitArgs.chain ?? submitArgs.network);
  return drift;
}

/**
 * Assembles the bounded escalation artifact — see HorizenEscalationPacket's
 * own doc comment for what this is for and how it must be handled.
 */
function buildHorizenEscalationPacket(args: {
  registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
  expectedOwner: string;
  message: string;
  signature: PartnerAuthorizationSignature;
  issuedAt: string;
  endpoint: string;
  submittedArguments: Record<string, unknown>;
  buildToolName: string;
  buildToolInputSchema: unknown;
  rawBuildResult: unknown;
  submitToolName: string;
  submitToolInputSchema: unknown;
  rawSubmitResult: unknown;
  messageSelection?: PulseMessageSelection;
  now: () => Date;
}): HorizenEscalationPacket {
  const sig = args.signature.signature;
  return {
    tokenId: args.registry.tokenId,
    network: args.registry.network,
    registryContract: HORIZEN_NETWORK_FACTS[args.registry.network]?.identityRegistry ?? 'unknown',
    expectedOwner: args.expectedOwner,
    recoveredSigner: args.signature.signerAddress,
    issuedAt: args.issuedAt,
    endpoint: args.endpoint,
    messageByteLength: Buffer.byteLength(args.message, 'utf8'),
    messageHash: sha256Hex(args.message),
    exactMessage: args.message,
    signature: sig,
    signatureLength: sig.length,
    signatureVByte: sig.length >= 2 ? sig.slice(-2) : '',
    submittedArguments: args.submittedArguments,
    buildTool: { name: args.buildToolName, inputSchema: args.buildToolInputSchema, rawResult: args.rawBuildResult },
    submitTool: { name: args.submitToolName, inputSchema: args.submitToolInputSchema, rawResult: args.rawSubmitResult },
    fieldParity: buildFieldParityTable(args.message, args.submittedArguments),
    ...(args.messageSelection ? { messageSelection: args.messageSelection } : {}),
    capturedAt: args.now().toISOString(),
  };
}

export async function submitHorizenTransparencyAuthorization(
  authorizationId: string,
  args: {
    message: string;
    signature: PartnerAuthorizationSignature;
    /**
     * Enrollment metadata NOT part of the signed message — resolved fresh by
     * the caller (never persisted, never message-critical). See
     * PrepareHorizenTransparencyAuthorizationInput's own doc comment.
     */
    agentDisplayName: string;
    endpoint: string;
    /**
     * Escalation-only carry (al, 2026-08-04) — never used for any decision
     * here. registry/expectedOwner let a rejection's escalation packet name
     * the registry contract and the owner already confirmed by
     * verifySignatureIntegrity; the build* fields let it include the build
     * stage's exact tool name/schema/raw response, all optional so this
     * function stays independently callable/testable without them.
     */
    registry?: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
    expectedOwner?: string;
    buildToolName?: string;
    buildToolInputSchema?: unknown;
    rawBuildResult?: unknown;
    /** Which build-response candidate produced `message` — escalation-only, see HorizenEscalationPacket.messageSelection. */
    messageSelection?: PulseMessageSelection;
  },
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ submissionRef: string | null; partnerResponse: NormalizedMcpSubmissionResult }>> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record || record.state !== 'SIGNED') {
    return { ok: false, refusalCode: 'STATE_MISMATCH', detail: `authorization "${authorizationId}" is not in SIGNED state` };
  }
  // The three message-critical facts MUST have been persisted at prepare —
  // a row from before this correction landed cannot be resubmitted (its
  // signature was produced without them being tracked at all).
  if (!record.agentId || !record.walletAddress || !record.issuedAt) {
    return {
      ok: false,
      refusalCode: 'STATE_MISMATCH',
      detail:
        `authorization "${authorizationId}" is missing agentId/walletAddress/issuedAt — it was prepared before ` +
        `the 2026-08-04 correction and cannot be resumed. Re-run prepare to start a fresh request.`,
    };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { tools } = await mcpClient.listTools();
  const submitTool = findCompatibleTool(tools, SUBMIT_TOOL_SPEC, new Set());
  if (!submitTool.ok) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND',
      detail: `no tool compatible with role "submit" declared by Horizen's MCP server. Declared tools: ${submitTool.declaredToolNames.join(', ') || '(none)'}`,
    };
  }

  /*
   * THE FULL ENROLLMENT ENVELOPE, NOT JUST THE SIGNATURE (al / Horizen brief,
   * 2026-08-04). `enable_pulse_monitoring`'s live schema requires agentId,
   * name, endpoint, walletAddress, signature AND issuedAt — offering only
   * message/signature candidates left every one of those unmatched and sent
   * as `undefined`, which is exactly the five-field Zod rejection observed
   * live. agentId/walletAddress/issuedAt are read back from the PERSISTED
   * record — the exact values that produced the signed message, never
   * re-derived; name/endpoint come from the caller since they are not part
   * of the signed message at all.
   */
  const submitArgs = matchSchemaFields(submitTool.tool.inputSchema, {
    // Pulse enable/disable is one tool; offered explicitly so a schema that
    // declares `action` reconstructs the SAME message-critical fact
    // build_pulse_auth_message was called with (Horizen partner
    // confirmation, 2026-08-05: reconstruction reads "action, agentId,
    // walletAddress, issuedAt, chain").
    action: 'enable',
    agentId: record.agentId,
    name: args.agentDisplayName,
    endpoint: args.endpoint,
    walletAddress: record.walletAddress,
    message: args.message,
    signature: args.signature.signature,
    signedMessage: args.signature.signature,
    signedPayload: args.signature.signature,
    signerAddress: args.signature.signerAddress,
    issuedAt: record.issuedAt,
    chain: record.network,
    network: record.network,
  });

  const missing = missingRequiredFields(submitTool.tool.inputSchema, submitArgs);
  if (missing.length > 0) {
    const detail =
      `"${submitTool.tool.name}" declares required argument(s) this client supplies no value for: ` +
      `${missing.join(', ')}. Declared schema: ${JSON.stringify(submitTool.tool.inputSchema?.properties ?? {})}`;
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: 'HORIZEN_SUBMISSION_FAILED', refusalDetail: detail });
    return { ok: false, refusalCode: 'HORIZEN_SUBMISSION_FAILED', detail };
  }

  /*
   * THE DRIFT GATE, BEFORE HORIZEN IS EVER CONTACTED (Horizen partner
   * confirmation, 2026-08-05: "instrument the ceremony so it proves whether
   * the two calls are byte-identical... abort locally with a
   * PULSE_ARGUMENT_DRIFT diagnostic before contacting Horizen").
   *
   * `record.agentId`/`walletAddress`/`issuedAt` are the EXACT values
   * persisted at prepare time — the ones actually sent to
   * `build_pulse_auth_message` (see `messageWalletAddress`'s own comment in
   * `prepareHorizenTransparencyAuthorization`). Compared BYTE FOR BYTE
   * against what `submitArgs` is about to send — never case-insensitively,
   * because the defect this catches (mismatched wallet casing) is
   * cryptographically invisible to a case-insensitive comparison.
   */
  const drift = detectPulseArgumentDrift(record, submitArgs);
  if (drift.length > 0) {
    const detail =
      `submit arguments differ from what was sent to build_pulse_auth_message — refusing before Horizen is ` +
      `contacted: ${drift.map((d) => `${d.field} (built: "${d.builtValue}", submitting: "${d.submitValue}")`).join('; ')}`;
    console.error(`[PULSE ARGUMENT DRIFT] authorization "${authorizationId}": ${detail}`);
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: 'PULSE_ARGUMENT_DRIFT', refusalDetail: detail });
    return { ok: false, refusalCode: 'PULSE_ARGUMENT_DRIFT', detail };
  }

  const submitResult = await mcpClient.callTool({ name: submitTool.tool.name, arguments: submitArgs });

  /*
   * isError IS TERMINAL, CHECKED FIRST (al / Horizen brief, 2026-08-04).
   *
   * A tool-level rejection (schema validation, business-rule refusal, ...)
   * still returns `content` — usually the error body — and the code
   * previously ran straight into `extractStringField` looking for a
   * submission reference inside it, then reported the misleading "did not
   * return a recognisable submission reference" as if the call had merely
   * returned an unfamiliar SUCCESS shape. It never had: `enable_pulse_
   * monitoring` was rejected outright by Horizen's own argument validation.
   * Reusing `describeToolResultShape`'s error-body-verbatim path (the same
   * discipline `extractPartnerMessage` already applies) reports what
   * actually happened instead of a generic parsing complaint.
   */
  if (submitResult.isError === true) {
    /*
     * A bounded, safe diagnostic transcript rides along with this refusal
     * (al, 2026-08-04) — this call is only reached after
     * verifySignatureIntegrity already confirmed recovery/wallet/owner agree
     * LOCALLY, so a rejection here means either a signature-contract variant
     * this integration hasn't matched (prefix, encoding, hashing) or a
     * partner-side defect — never a local ownership/logic bug the earlier
     * gates would already have caught.
     */
    const transcript = buildSignatureDiagnosticTranscript({
      message: args.message,
      signature: args.signature,
      expectedOwner: record.walletAddress,
      agentId: record.agentId,
      issuedAt: record.issuedAt,
      endpoint: args.endpoint,
    });
    const partnerErrorText = describeToolResultShape(submitResult);

    /*
     * TWO FRAMINGS, NOT ONE (al, 2026-08-04): "The error should now be
     * surfaced as: Horizen rejected a locally verified owner signature.
     * Local authorization integrity passed. Partner contract clarification
     * required. — not merely 'Invalid signature', and not another
     * invitation to retry." That framing is only HONEST when this rejection
     * is actually the signature check — an unrelated rejection (a schema
     * validation dump, a business-rule refusal) keeps the generic wording
     * because it IS generic, and claiming "local integrity passed" for a
     * defect this integration might still own would overclaim.
     */
    const looksLikeSignatureRejection = /invalid signature/i.test(partnerErrorText);
    const detail = looksLikeSignatureRejection
      ? `Horizen rejected a locally verified owner signature. Local authorization integrity passed. Partner contract ` +
        `clarification required. Partner response: ${partnerErrorText}. ` +
        `Local signature transcript (recovery already verified before this call): ${JSON.stringify(transcript)}`
      : `"${submitTool.tool.name}" rejected the request: ${partnerErrorText}. ` +
        `Local signature transcript (recovery already verified before this call): ${JSON.stringify(transcript)}`;

    // The full escalation packet — the exact message/signature belong here,
    // NEVER in `detail` above (general-log-visible). Requires the
    // escalation-only carry fields; standalone callers that omit them
    // (e.g. direct unit tests of this function alone) simply get no packet
    // rather than a half-populated one.
    const escalationPacket =
      args.registry && args.expectedOwner && args.buildToolName !== undefined
        ? buildHorizenEscalationPacket({
            registry: args.registry,
            expectedOwner: args.expectedOwner,
            message: args.message,
            signature: args.signature,
            issuedAt: record.issuedAt,
            endpoint: args.endpoint,
            submittedArguments: submitArgs,
            buildToolName: args.buildToolName,
            buildToolInputSchema: args.buildToolInputSchema,
            rawBuildResult: args.rawBuildResult,
            submitToolName: submitTool.tool.name,
            submitToolInputSchema: submitTool.tool.inputSchema,
            rawSubmitResult: submitResult,
            messageSelection: args.messageSelection,
            now: deps.now ?? (() => new Date()),
          })
        : undefined;

    /*
     * ESCALATION LOGGING (2026-08-04) — mirrors services/dvn/
     * activityReceiptDvnPipeline.ts's [DVN ESCALATION] console.error
     * pattern verbatim: same mechanism, same reason (surfaces in
     * CloudWatch/Amplify error-level logs, restricted to infra operators,
     * never a general API response or a broad-audience DB column). Without
     * this, the packet was computed and then silently discarded — it never
     * reached `detail` (general-log-visible; deliberately bounded) and the
     * route never forwards `escalationPacket` to its JSON response. This is
     * the ONLY place this artifact is currently retrievable.
     */
    if (escalationPacket) {
      console.error(`[HORIZEN ESCALATION] enable_pulse_monitoring rejected authorization "${authorizationId}": ${JSON.stringify(escalationPacket)}`);
    }

    await updatePartnerAuthorizationRequest(authorizationId, {
      state: 'REFUSED',
      refusalCode: 'HORIZEN_SUBMISSION_REJECTED',
      refusalDetail: detail,
    });
    return {
      ok: false,
      refusalCode: 'HORIZEN_SUBMISSION_REJECTED',
      detail,
      ...(escalationPacket ? { escalationPacket } : {}),
      // The full partner body, verbatim — never only `describeToolResultShape`'s
      // summary (Al's change 5: "The actual text is necessary evidence").
      partnerResponse: normalizeMcpSubmissionResult(submitResult),
      submittedArguments: submitArgs,
      rawSubmitResult: submitResult,
    };
  }

  /*
   * ── A SUBMISSION REFERENCE IS METADATA, NOT A PREREQUISITE ───────────────
   * (Al's brief, 2026-08-06.)
   *
   * This branch used to demand a JSON object carrying submissionRef/
   * transactionHash/txHash/hash/id and, finding none, write REFUSED. Horizen
   * then answered a genuinely successful (non-`isError`) call with 1109
   * characters of plain text — and the client threw the whole response away
   * and recorded a local failure for what may well have been a completed
   * enablement. Pulse enablement is a registry API call, not necessarily a
   * chain transaction, so there may be no hash to return at all.
   *
   * The normalizer preserves everything and interprets without discarding.
   * The row goes to SUBMITTED — which is the truth: Horizen's state-changing
   * call was made and answered — and the AUTHORITATIVE REREAD that follows
   * (verifyHorizenTransparencyActivation, run next by the pipeline, or later
   * by "Refresh partner status") is what decides CONFIRMED. A missing
   * reference no longer terminates the ceremony.
   */
  const normalized = normalizeMcpSubmissionResult(submitResult);

  /*
   * Explicit rejection prose on a NON-`isError` response — Horizen answered
   * successfully at the transport level while saying, in words, that it
   * refused. Recorded as REFUSED, with the partner's exact text preserved;
   * "Refresh partner status" still performs an authoritative reread that can
   * override this, because partner STATE outranks partner PROSE.
   */
  if (normalized.semanticStatus === 'rejected') {
    const detail =
      `"${submitTool.tool.name}" answered without a transport error but its response states a refusal. ` +
      `Partner response: ${normalized.partnerMessage ?? describeToolResultShape(submitResult)}`;
    await updatePartnerAuthorizationRequest(authorizationId, {
      state: 'REFUSED',
      refusalCode: 'HORIZEN_SUBMISSION_REJECTED',
      refusalDetail: detail,
      partnerStatus: normalized.partnerMessage ?? undefined,
    });
    return { ok: false, refusalCode: 'HORIZEN_SUBMISSION_REJECTED', detail, partnerResponse: normalized, submittedArguments: submitArgs, rawSubmitResult: submitResult };
  }

  /*
   * confirmed / pending / unknown all become SUBMITTED. `unknown` is NOT a
   * failure: an unfamiliar success shape is exactly the case the reread
   * exists to settle, and refusing here would repeat the defect this change
   * removes. What the response actually said is preserved on the row.
   */
  console.log(
    `[PULSE SUBMISSION] authorization "${authorizationId}" — "${submitTool.tool.name}" answered ` +
      `semanticStatus=${normalized.semanticStatus}, submissionRef=${normalized.submissionRef ?? 'none'}, ` +
      `${normalized.textBlocks.length} text block(s), ${normalized.parsedJsonValues.length} JSON value(s). ` +
      `Partner response (verbatim): ${normalized.partnerMessage ?? '(no text)'}`,
  );
  await updatePartnerAuthorizationRequest(authorizationId, {
    state: 'SUBMITTED',
    // Only set when one genuinely exists — never a fabricated placeholder.
    ...(normalized.submissionRef ? { submissionRef: normalized.submissionRef } : {}),
    ...(normalized.partnerMessage ? { partnerStatus: normalized.partnerMessage } : {}),
  });
  return {
    ok: true,
    value: { submissionRef: normalized.submissionRef ?? null, partnerResponse: normalized },
    partnerResponse: normalized,
    submittedArguments: submitArgs,
    rawSubmitResult: submitResult,
  };
}

// ── Stage 4: verify ──────────────────────────────────────────────────────

function pickStringField(obj: Record<string, unknown> | null | undefined, names: string[]): string | null {
  if (!obj) return null;
  for (const n of names) {
    const v = obj[n];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * Does the registry's own on-chain owner match the wallet this ceremony is
 * signing/submitting as? One definition, two call sites (2026-08-04):
 *   - `runHorizenTransparencyAuthorization` — BEFORE submit, so a wrong
 *     wallet never reaches Horizen's state-changing enable_pulse_monitoring
 *     call at all.
 *   - `verifyHorizenTransparencyActivation` — AFTER submit, as the
 *     authoritative post-hoc confirmation (control could theoretically
 *     change between prepare and reread).
 *
 * ── WHY THE PRE-SUBMIT CALL EXISTS (al, 2026-08-04) ─────────────────────
 *
 * The message-building comment above states outright: "Wallet: 0x… must
 * equal ownerOf(agentId)". Before this, the ONLY owner cross-check ran
 * post-submit — so a wallet that is not the token's actual on-chain owner
 * reached Horizen's REAL signature verification and came back as:
 *
 *   "enable_pulse_monitoring" rejected the request: tool-reported error:
 *   Registry API returned 401 for /agents/8798/enable-pulse — Invalid
 *   signature
 *
 * That is cryptographically true (the signature cannot verify against a
 * message the actual owner didn't produce) but diagnostically useless — it
 * reads as a signing bug when the real defect is a wrong wallet. Checking
 * here turns that into a named, local REGISTRY_OWNER_MISMATCH before any
 * partner contact for the state-changing call happens.
 */
/**
 * Horizen's own onboarding-status service, read for exactly one purpose
 * here: the owner it names, compared against the REST reread's owner by
 * `crossCheckRegistryOwner` immediately below (Al's escalation, 2026-08-06 —
 * see `HORIZEN_OWNER_SOURCE_CONFLICT`'s own doc comment for the full
 * evidence chain). Best-effort and silent on failure: an unreachable or
 * incompatible status tool is NOT itself a refusal — it only means no
 * additional cross-source signal was available, and the existing REST-based
 * check proceeds exactly as it did before this existed.
 */
async function fetchOnboardingStatusOwner(
  mcpClient: PartnerMcpClient,
  registry: { tokenId: string; network: HorizenNetwork },
): Promise<{ owner: string | null; statusResult: McpToolResult | null; statusArgs: Record<string, unknown> | null }> {
  try {
    const { tools } = await mcpClient.listTools();
    const statusTool = findCompatibleTool(tools, STATUS_TOOL_SPEC, new Set());
    if (!statusTool.ok) return { owner: null, statusResult: null, statusArgs: null };
    const statusArgs = matchSchemaFields(
      statusTool.tool.inputSchema,
      pulseStatusCandidates(HORIZEN_NETWORK_FACTS[registry.network], registry.tokenId),
    );
    const statusResult = await mcpClient.callTool({ name: statusTool.tool.name, arguments: statusArgs });
    const content = statusResult?.content;
    const rawText = Array.isArray(content) ? content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join(' ') : '';
    return { owner: rawText ? extractRegistryOwnerFromStatusText(rawText) : null, statusResult, statusArgs };
  } catch {
    // A transport failure here says nothing about ownership — never let it
    // block the REST-based check this augments.
    return { owner: null, statusResult: null, statusArgs: null };
  }
}

async function crossCheckRegistryOwner(
  registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string },
  controllerWallet: string,
  deps: AuthorizationDeps,
): Promise<
  | {
      ok: true;
      owner: string;
      /**
       * The get_onboarding_status response this same call already fetched for
       * owner extraction — carried through so a caller can ALSO check current
       * enrollment state without a second partner call (2026-08-07 pre-submit
       * idempotency gate, correlated trace c565e58b-4ce8-4ccf-9f0f-ac611d1d526c).
       * `null` only when the status tool was unreachable/incompatible — the
       * owner-conflict check above already tolerates that same absence.
       */
      statusResult: McpToolResult | null;
      statusArgs: Record<string, unknown> | null;
    }
  | { ok: false; refusalCode: 'REGISTRY_REREAD_FAILED' | 'REGISTRY_OWNER_MISMATCH' | 'HORIZEN_OWNER_SOURCE_CONFLICT'; detail: string }
> {
  const fetchAgent = deps.fetchRegistryAgent ?? defaultFetchRegistryAgent;
  const reread = await fetchAgent(registry.registryAlias ?? registry.tokenId, registry.network);
  if (!reread.ok) {
    return { ok: false, refusalCode: 'REGISTRY_REREAD_FAILED', detail: `registry reread failed: ${reread.reason}` };
  }
  const owner = pickStringField(reread.value, ['owner', 'ownerAddress', 'controller', 'controllerWallet']);

  /*
   * DEFENSIVE CROSS-SOURCE CHECK, BEFORE ANY SIGNING (Al's escalation,
   * 2026-08-06). A live investigation proved Horizen's REST `/agents/:id`
   * owner and their `get_onboarding_status` owner can disagree for the SAME
   * token, and that the REST value was the one corroborated by the on-chain
   * mint event and a direct `ownerOf()` read three ways. A conflict here
   * means Horizen's own two services disagree with each other — no local
   * action (re-signing, choosing a different wallet, retrying) can resolve
   * it, so this refuses rather than let another attempt reproduce the same
   * partner-side rejection.
   */
  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const statusOwner = await fetchOnboardingStatusOwner(mcpClient, registry);
  if (owner && statusOwner.owner && owner.toLowerCase() !== statusOwner.owner.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_OWNER_SOURCE_CONFLICT',
      detail:
        `Horizen's own services disagree about who owns this token: the registry REST endpoint reports owner ` +
        `${owner}, while the onboarding-status service reports ${statusOwner.owner}. This is a partner-side data ` +
        `conflict between two Horizen backends — not a signature, ownership, or wallet-configuration issue on our ` +
        `side. Refusing rather than signing or retrying, since no local action can resolve a disagreement between ` +
        `two of the partner's own services.`,
    };
  }

  if (owner && owner.toLowerCase() !== controllerWallet.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'REGISTRY_OWNER_MISMATCH',
      detail: `registry-reread owner (${owner}) does not match the controller wallet (${controllerWallet})`,
    };
  }
  // No `owner` field reported at all (a lenient registry read) — the
  // controllerWallet is the only candidate available; downstream callers
  // (verifySignatureIntegrity) use this as the expected owner for the
  // decisive local test either way.
  return { ok: true, owner: owner ?? controllerWallet, statusResult: statusOwner.statusResult, statusArgs: statusOwner.statusArgs };
}

/**
 * THE decisive local test (al, 2026-08-04): `recoverAddress(exactMessage,
 * signature) === walletAddress submitted === ownerOf(agentId)`. Three
 * quantities, one gate — not a composition of two separately-passing checks
 * trusted by inference:
 *   - `expectedOwner` is the value crossCheckRegistryOwner ACTUALLY resolved
 *     moments earlier (never re-derived, never assumed equal to
 *     controllerWallet even though it always is today);
 *   - `record.walletAddress` is read FRESH from the persisted row — the same
 *     one submitHorizenTransparencyAuthorization is about to read
 *     `agentId`/`walletAddress`/`issuedAt` from — never the in-memory value
 *     used to build/sign, so a drift between "what was signed" and "what
 *     will be submitted" cannot hide behind an unchanged local variable;
 *   - `signature.signerAddress` is the signer module's OWN internal
 *     recovery, re-derived here independently rather than trusted.
 *
 * `exactMessage` MUST be the verbatim string returned by
 * build_pulse_auth_message, threaded through unmodified — never
 * reconstructed from parsed fields. Signing method is ordinary EIP-191
 * personal_sign (`ethers.Wallet.signMessage` / `ethers.verifyMessage`) — the
 * SAME primitive on both the signing and recovery side; no typed-data
 * signing, no pre-hashing, anywhere in this pipeline.
 *
 * By construction today all three quantities agree (composition, not
 * coincidence: the same controllerWallet flows through prepare -> sign ->
 * here). Its value is as a REGRESSION GATE — it fails loudly if a future
 * change ever lets any one of them diverge from the other two, before
 * enable_pulse_monitoring is ever called.
 */
export async function verifySignatureIntegrity(
  authorizationId: string,
  exactMessage: string,
  signature: PartnerAuthorizationSignature,
  expectedOwner: string,
): Promise<{ ok: true } | { ok: false; refusalCode: 'SIGNATURE_INTEGRITY_FAILED'; detail: string }> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record?.walletAddress) {
    return {
      ok: false,
      refusalCode: 'SIGNATURE_INTEGRITY_FAILED',
      detail: `authorization "${authorizationId}" has no persisted walletAddress to verify the signature against`,
    };
  }
  const { ethers } = await import('ethers');
  const recovered = ethers.verifyMessage(exactMessage, signature.signature);
  const recoveredLower = recovered.toLowerCase();
  if (
    recoveredLower !== signature.signerAddress.toLowerCase() ||
    recoveredLower !== record.walletAddress.toLowerCase() ||
    recoveredLower !== expectedOwner.toLowerCase()
  ) {
    return {
      ok: false,
      refusalCode: 'SIGNATURE_INTEGRITY_FAILED',
      detail:
        `recovered signer (${recovered}) over the exact message about to be submitted does not agree with ALL of: ` +
        `persisted walletAddress (${record.walletAddress}), registry owner (${expectedOwner}) — refusing before ` +
        `enable_pulse_monitoring is called`,
    };
  }
  return { ok: true };
}

/**
 * Flattens an MCP tool result's text content into one lowercase string for a
 * keyword confirmation check. `JSON.stringify(toolResult)` on the WRAPPED
 * `{content:[{type:'text',text:...}]}` shape double-escapes the inner JSON's
 * quotes, so a literal `'"active"'` search never matches — this joins the
 * actual text bodies instead of stringifying the wrapper around them.
 */
export function flattenToolResultText(result: McpToolResult | null | undefined): string {
  if (Array.isArray(result?.content)) {
    return result!.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join(' ').toLowerCase();
  }
  return JSON.stringify(result ?? {}).toLowerCase();
}

/**
 * The states a reread may legitimately run against. SUBMITTED is the normal
 * case; `RECONCILABLE_STATES` additionally lets "Refresh partner status"
 * reconcile a row that a LOCAL decision refused — because partner STATE
 * outranks any local or prose-level verdict (Al's brief, 2026-08-06:
 * "A confirmed reread overrides a missing submission reference", and the
 * refresh must "reconcile the local authorization request"). CONFIRMED is
 * excluded: there is nothing to reconcile. PREPARED/AWAITING_SIGNATURE/SIGNED
 * are excluded: Horizen's state-changing call was never made, so there is no
 * partner state to read.
 */
export const RECONCILABLE_STATES: PartnerAuthorizationState[] = ['SUBMITTED', 'REFUSED', 'QUARANTINED', 'EXPIRED'];

export async function verifyHorizenTransparencyActivation(
  authorizationId: string,
  args: {
    actorPersonaId: string;
    registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
    controllerWallet: string;
    /**
     * Which local states this reread may run against — defaults to SUBMITTED
     * alone, exactly as before. "Refresh partner status" passes
     * `RECONCILABLE_STATES` so a locally-refused row can still be reconciled
     * against authoritative partner state.
     */
    allowStates?: PartnerAuthorizationState[];
    /**
     * What `enable_pulse_monitoring`'s own response semantically said, when
     * this reread follows a submission in the same request. Used ONLY to
     * choose the wording/severity of a non-convergent outcome — never to
     * assert confirmation, which always requires the partner's own state.
     */
    submitSemanticStatus?: NormalizedMcpSubmissionResult['semanticStatus'];
  },
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ confirmed: true }>> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  const allowStates = args.allowStates ?? (['SUBMITTED'] as PartnerAuthorizationState[]);
  if (!record || !allowStates.includes(record.state)) {
    return {
      ok: false,
      refusalCode: 'STATE_MISMATCH',
      detail:
        `authorization "${authorizationId}" is ${record ? `in ${record.state} state` : 'absent'} — this reread accepts ` +
        `${allowStates.join('/')}`,
    };
  }

  const ownerCheck = await crossCheckRegistryOwner(args.registry, args.controllerWallet, deps);
  if (!ownerCheck.ok) {
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: ownerCheck.refusalCode, refusalDetail: ownerCheck.detail });
    return { ok: false, refusalCode: ownerCheck.refusalCode, detail: ownerCheck.detail };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { tools } = await mcpClient.listTools();
  const statusTool = findCompatibleTool(tools, STATUS_TOOL_SPEC, new Set());
  if (!statusTool.ok) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND',
      detail: `no tool compatible with role "status" declared by Horizen's MCP server. Declared tools: ${statusTool.declaredToolNames.join(', ') || '(none)'}`,
    };
  }
  const statusArgs = matchSchemaFields(
    statusTool.tool.inputSchema,
    pulseStatusCandidates(HORIZEN_NETWORK_FACTS[args.registry.network], args.registry.tokenId, {
      submissionRef: record.submissionRef ?? '',
      transactionHash: record.submissionRef ?? '',
    }),
  );
  const statusResult = await mcpClient.callTool({ name: statusTool.tool.name, arguments: statusArgs });
  const statusText = flattenToolResultText(statusResult);
  /*
   * THREE OUTCOMES, NOT TWO (Al's follow-up brief, 2026-08-06). A bare
   * `.includes('enabled')` check cannot tell "Horizen hasn't answered
   * conclusively yet" from "Horizen just said, in words, that it is not
   * enrolled" — and a live `get_onboarding_status` reread did exactly the
   * latter ("✗ Not enrolled in Pulse monitoring. Next step: Enroll…"), which
   * this classifier's predecessor filed under the former. See
   * `classifyPulseEnrollmentState`'s own doc comment for the full evidence
   * and the negation-outranks-positive rule that fixes it.
   */
  const enrollmentState = classifyPulseEnrollmentState(statusText);
  const rawStatus = JSON.stringify(statusResult).slice(0, 500);

  if (enrollmentState === 'NOT_ENROLLED') {
    /*
     * A CONCLUSIVE NEGATIVE — retryable, and explicitly not a claim about the
     * signature. See PARTNER_NOT_ENROLLED's own doc comment for why this is
     * `state: REFUSED` (no new state value, no migration) distinguished by
     * refusalCode alone, and why that is enough for the existing retry path
     * in partnerAuthorizationStore.ts to already work unchanged.
     */
    const detail =
      `Horizen's authoritative status reports this agent is NOT enrolled in Pulse monitoring — the prior submission ` +
      `did not establish enrollment. This is not a signature, ownership, or cryptographic failure: every local check ` +
      `(recovered signer, registry owner, message selection) already passed. Retry by creating a fresh authorization. ` +
      `Partner state read: ${rawStatus}`;
    await updatePartnerAuthorizationRequest(authorizationId, {
      state: 'REFUSED',
      refusalCode: 'PARTNER_NOT_ENROLLED',
      refusalDetail: detail,
      partnerStatus: rawStatus,
    });
    return { ok: false, refusalCode: 'PARTNER_NOT_ENROLLED', detail, retryable: true, rawStatusResult: statusResult, statusArgsUsed: statusArgs };
  }

  if (enrollmentState === 'PENDING_CONVERGENCE') {
    /*
     * NOT A DENIAL, AND NO LONGER WRITTEN AS ONE (Al's brief, 2026-08-06).
     *
     * This used to write `REFUSED` + HORIZEN_REREAD_NOT_CONFIRMED, which
     * recorded "the partner's state has not converged yet" as a constitutional
     * verdict — the same defect class as reading a transport timeout as a
     * refusal, and the reason a possibly-successful enablement ended up shown
     * to the operator as a rejection. Horizen's real refusals arrive through
     * the submit path (`isError`, or explicit rejection prose), or now through
     * an explicit NOT_ENROLLED reread (handled above) — never through mere
     * silence here.
     *
     * The row is left in whatever reconcilable state it already held — for a
     * SUBMITTED row that means SUBMITTED, so refresh can settle it later;
     * for a row a local decision already refused, the ORIGINAL refusal detail
     * is preserved rather than overwritten by this inconclusive reread.
     */
    if (record.state === 'SUBMITTED') {
      await updatePartnerAuthorizationRequest(authorizationId, { state: 'SUBMITTED', partnerStatus: rawStatus });
    }
    const because =
      args.submitSemanticStatus === 'confirmed'
        ? 'the submission response itself reported success, so this is very likely convergence lag rather than a refusal'
        : args.submitSemanticStatus === 'pending'
          ? 'the submission response reported the request as still processing'
          : 'the submission response did not clearly state an outcome either';
    return {
      ok: false,
      refusalCode: 'PARTNER_STATE_UNRESOLVED',
      detail:
        `Horizen's authoritative reread did not (yet) report Pulse as enabled, and ${because}. The authorization is ` +
        `unchanged and still submitted — nothing needs re-authorizing or re-signing. Re-check status to resolve it. ` +
        `Partner state read: ${rawStatus}`,
      rawStatusResult: statusResult,
      statusArgsUsed: statusArgs,
    };
  }
  // enrollmentState === 'CONFIRMED' falls through to the confirmation path below.
  return writeConfirmedPulseActivation(authorizationId, args, statusResult, statusArgs);
}

/**
 * Records a CONFIRMED Pulse activation — the ONE place that writes the
 * `horizen_pulse_authorized` receipt and flips the persisted row to
 * `CONFIRMED`. Extracted 2026-08-07 (inv.engineering.036/037) so the
 * pre-submit idempotency gate in `runHorizenTransparencyAuthorization` can
 * record a confirmation discovered BEFORE signing/submission through the
 * exact same path `verifyHorizenTransparencyActivation`'s post-submit
 * confirmation already uses — never a second, parallel writer.
 */
async function writeConfirmedPulseActivation(
  authorizationId: string,
  args: { actorPersonaId: string; registry: { network: HorizenNetwork; tokenId: string }; controllerWallet: string },
  statusResult: McpToolResult,
  statusArgs: Record<string, unknown>,
): Promise<AuthorizationResult<{ confirmed: true }>> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record) {
    return {
      ok: false,
      refusalCode: 'STATE_MISMATCH',
      detail: `authorization "${authorizationId}" is absent — cannot record a confirmation against no row`,
    };
  }
  const rawStatus = JSON.stringify(statusResult).slice(0, 500);

  const { createActivityReceipt } = await import('@/services/receipts/activityReceiptService');
  let receiptRef: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: args.actorPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'horizen_pulse_authorized',
      summary: `Horizen Pulse/PnL transparency authorization confirmed for ${record.subjectAigentQubeId} (token ${args.registry.tokenId}, ${args.registry.network})`,
      actionInput: {
        aigentQubeId: record.subjectAigentQubeId,
        controllerWallet: args.controllerWallet,
        tokenId: args.registry.tokenId,
        network: args.registry.network,
        authorizationId,
        signatureRef: record.signatureRef,
        submissionRef: record.submissionRef,
      },
    });
    receiptRef = receipt?.id ?? null;
  } catch {
    // Receipt failure never re-opens a partner-confirmed authorization; it is
    // surfaced as a null receiptRef for the caller to retry recording.
  }

  await updatePartnerAuthorizationRequest(authorizationId, {
    state: 'CONFIRMED',
    partnerStatus: rawStatus,
    receiptRef: receiptRef ?? undefined,
  });

  return { ok: true, value: { confirmed: true }, rawStatusResult: statusResult, statusArgsUsed: statusArgs };
}

// ── Full pipeline convenience wrapper (Phase 1 acceptance criterion) ────────

/**
 * ONE CONNECTION, ONE TOOL LISTING, FOR THE WHOLE CEREMONY.
 *
 * Each stage below independently falls back to `defaultMcpClient()` when no
 * client is injected. Run end to end with no deps, that meant THREE separate
 * transport connections to Horizen and THREE `listTools` round trips for a
 * tool set that cannot change inside a single ceremony — roughly three times
 * the remote latency of the work actually being done, inside one serverless
 * request whose budget the operator has already seen exhausted (an empty
 * response body, 2026-08-03).
 *
 * Wrapping the shared client rather than editing each stage keeps every stage
 * independently callable — Phase 1's tests drive them one at a time with their
 * own mock — while making the composed path pay the connection cost once.
 */
function shareOneConnection(client: PartnerMcpClient): PartnerMcpClient {
  let tools: Promise<{ tools: McpTool[] }> | null = null;
  return {
    listTools: () => (tools ??= client.listTools()),
    callTool: (args) => client.callTool(args),
  };
}

export async function runHorizenTransparencyAuthorization(
  input: PrepareHorizenTransparencyAuthorizationInput,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ authorizationId: string; receiptRef: string | null }>> {
  const shared: AuthorizationDeps = { ...deps, mcpClient: shareOneConnection(deps.mcpClient ?? (await defaultMcpClient())) };

  const prepared = await prepareHorizenTransparencyAuthorization(input, shared);
  if (!prepared.ok) return prepared;
  // Carried through EVERY later exit below (Al's audit brief, 2026-08-06) —
  // a click that fails at ownership, integrity, or submission is still
  // traceable to the exact attempt/nonce/issuedAt that prepare produced.
  const diagnostics = prepared.diagnostics;

  /*
   * OWNERSHIP, BEFORE SIGNING (moved here 2026-08-04, al: "Signing is itself
   * a governed cryptographic act... there is no reason to ask the agent key
   * to sign a message that is already known to name the wrong wallet."). The
   * canonical order is now: resolve token -> read ownerOf -> compare with the
   * proposed signer -> build the exact message (already done above, in
   * prepare) -> sign -> submit -> reread. verifyHorizenTransparencyActivation's
   * post-submit reread remains as the authoritative CONFIRMATION afterward —
   * not a duplicate of this pre-flight refusal.
   */
  const ownerCheck = await crossCheckRegistryOwner(input.registry, input.controllerWallet, shared);
  if (!ownerCheck.ok) {
    await updatePartnerAuthorizationRequest(prepared.value.authorizationId, {
      state: 'REFUSED',
      refusalCode: ownerCheck.refusalCode,
      refusalDetail: ownerCheck.detail,
    });
    return { ok: false, refusalCode: ownerCheck.refusalCode, detail: ownerCheck.detail, diagnostics };
  }

  /*
   * PRE-SUBMIT PULSE STATUS GATE — an already-enrolled agent is never
   * resubmitted merely to reconfirm it (operator ruling 2026-08-07,
   * correlated trace c565e58b-4ce8-4ccf-9f0f-ac611d1d526c).
   *
   * `crossCheckRegistryOwner` immediately above already called
   * get_onboarding_status once, for its own owner cross-check — this reuses
   * that SAME response (no second partner call) and runs it through the
   * identical, already-proven `classifyPulseEnrollmentState` the post-submit
   * reread uses. If it already reports enrollment, `enable_pulse_monitoring`
   * has nothing to do: write the confirmation through the SAME path the
   * post-submit reread uses (`writeConfirmedPulseActivation`, so this is
   * retrieval-then-record, never a second interpretation of raw text) and
   * return — never sign, never submit.
   *
   * A NOT_ENROLLED or PENDING_CONVERGENCE read here changes nothing: falls
   * through to the ordinary sign -> submit -> reread ceremony below, exactly
   * as before this gate existed.
   */
  if (ownerCheck.statusResult) {
    const preSubmitState = classifyPulseEnrollmentState(flattenToolResultText(ownerCheck.statusResult));
    if (preSubmitState === 'CONFIRMED') {
      const confirmed = await writeConfirmedPulseActivation(
        prepared.value.authorizationId,
        { actorPersonaId: input.actorPersonaId, registry: input.registry, controllerWallet: input.controllerWallet },
        ownerCheck.statusResult,
        ownerCheck.statusArgs ?? {},
      );
      if (confirmed.ok) {
        const finalRecord = await getPartnerAuthorizationRequest(prepared.value.authorizationId);
        return {
          ok: true,
          value: { authorizationId: prepared.value.authorizationId, receiptRef: finalRecord?.receiptRef ?? null },
          diagnostics,
          rawStatusResult: confirmed.rawStatusResult,
          statusArgsUsed: confirmed.statusArgsUsed,
        };
      }
      // confirmed.ok===false only on STATE_MISMATCH (the row vanished between
      // prepare and here) — fall through to the ordinary ceremony rather than
      // trusting a classification with no row left to record it against.
    }
  }

  const signed = await signHorizenTransparencyAuthorization(prepared.value, shared);
  if (!signed.ok) return { ...signed, diagnostics };

  /*
   * THE DECISIVE LOCAL TEST, BEFORE SUBMISSION (al, 2026-08-04): recover the
   * signer from the EXACT message that will be submitted and require it
   * match ALL THREE of the persisted walletAddress, the ACTUAL registry
   * owner just resolved (`ownerCheck.owner`, never re-derived), and the
   * signer module's own recovery. See verifySignatureIntegrity's own doc
   * comment for why this checks all three explicitly rather than trusting
   * composition of separately-passing checks.
   */
  const integrityCheck = await verifySignatureIntegrity(prepared.value.authorizationId, prepared.value.message, signed.value, ownerCheck.owner);
  if (!integrityCheck.ok) {
    await updatePartnerAuthorizationRequest(prepared.value.authorizationId, {
      state: 'REFUSED',
      refusalCode: integrityCheck.refusalCode,
      refusalDetail: integrityCheck.detail,
    });
    return { ok: false, refusalCode: integrityCheck.refusalCode, detail: integrityCheck.detail, diagnostics };
  }

  const submitted = await submitHorizenTransparencyAuthorization(
    prepared.value.authorizationId,
    {
      message: prepared.value.message,
      signature: signed.value,
      agentDisplayName: input.agentDisplayName,
      endpoint: input.pulseEndpoint,
      // Escalation-only carry — see submitHorizenTransparencyAuthorization's
      // own doc comment. ownerCheck.owner is the ACTUAL resolved registry
      // owner (never re-derived here).
      registry: input.registry,
      expectedOwner: ownerCheck.owner,
      buildToolName: prepared.value.buildToolName,
      buildToolInputSchema: prepared.value.buildToolInputSchema,
      rawBuildResult: prepared.value.rawBuildResult,
      messageSelection: prepared.value.selection,
    },
    shared,
  );
  if (!submitted.ok) return { ...submitted, diagnostics };
  const partnerResponse = submitted.value.partnerResponse;

  /*
   * THE AUTHORITATIVE REREAD ALWAYS RUNS (Al's change 2, 2026-08-06) — the
   * submission's own acknowledgement never decides the outcome, whatever
   * shape it arrived in. `submitSemanticStatus` only shapes how a
   * NON-convergent result is worded; confirmation still requires Horizen's
   * own state.
   */
  const verified = await verifyHorizenTransparencyActivation(
    prepared.value.authorizationId,
    {
      actorPersonaId: input.actorPersonaId,
      registry: input.registry,
      controllerWallet: input.controllerWallet,
      submitSemanticStatus: partnerResponse.semanticStatus,
    },
    shared,
  );
  /*
   * FORWARD rawSubmitResult/submittedArguments EVEN ON A REREAD FAILURE
   * (2026-08-07 fix, correlated trace c565e58b-4ce8-4ccf-9f0f-ac611d1d526c).
   *
   * `enable_pulse_monitoring` above already succeeded — Horizen genuinely
   * received and accepted the submission — but `verified` (this reread's own
   * AuthorizationResult) carries no rawSubmitResult field at all, so the bare
   * spread below used to silently drop it whenever the reread itself did not
   * confirm (PARTNER_NOT_ENROLLED, PARTNER_STATE_UNRESOLVED, an owner
   * conflict discovered post-submit, ...). Downstream,
   * services/horizen/pulseEnrollmentTrace.ts's `reachedPartnerSubmission`
   * check reads `rawSubmitResult !== undefined` to decide whether submission
   * was ever attempted — so a genuinely-reached submission was misreported as
   * "failed before enable_pulse_monitoring was ever called" (LOCAL_CONTRACT_ERROR),
   * which ALSO marks that trace `complete: true` and permanently blocks the
   * scheduled +5/+15/+30s continuation rereads that would otherwise have
   * discovered Horizen's later, genuine confirmation.
   */
  if (!verified.ok) {
    return {
      ...verified,
      diagnostics,
      partnerResponse,
      submittedArguments: submitted.submittedArguments,
      rawSubmitResult: submitted.rawSubmitResult,
    };
  }

  const finalRecord = await getPartnerAuthorizationRequest(prepared.value.authorizationId);
  return {
    ok: true,
    value: { authorizationId: prepared.value.authorizationId, receiptRef: finalRecord?.receiptRef ?? null },
    diagnostics,
    partnerResponse,
    // Forwarded from the submit/verify stages' own additive diagnostic
    // fields (2026-08-06, the Nakamoto correlation trace) — this wrapper's
    // control flow, stage order and decisions are unchanged; these three
    // were simply never threaded through to its OWN final return before.
    submittedArguments: submitted.submittedArguments,
    rawSubmitResult: submitted.rawSubmitResult,
    rawStatusResult: verified.rawStatusResult,
    statusArgsUsed: verified.statusArgsUsed,
  };
}
