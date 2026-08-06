/**
 * Pulse enrollment correlation trace — "Close Nakamoto Pulse Enrollment —
 * Final Correlated Trace" (operator directive, 2026-08-06; hardened against
 * serverless timeout per Al's review, 2026-08-06).
 *
 * Constraint on the original directive, verbatim: "Do not change agreement
 * identifiers, ratification, Standing, Agent Bench, wallet selection,
 * signature generation, message selection or health routing. The sole
 * objective is to determine why a fresh, locally valid
 * enable_pulse_monitoring submission does not become an enrolled state."
 *
 * Al's follow-up review, verbatim (2026-08-06) — the reason this module has
 * TWO entry points rather than one: "Do not make one HTTP request wait
 * through t+0/5/15/30... That could fail before returning the trace and
 * recreate the same ambiguity... Start trace: build, sign, submit once,
 * persist raw evidence, perform the immediate status read, return
 * immediately. Continue trace: a read-only-in-spirit route the UI calls at
 * ~+5/+15/+30s; each call performs ONE authoritative reread and appends it
 * to the same trace; no call re-signs or resubmits; classification updates
 * after every read." There is NO `setTimeout`/sleep anywhere in this module
 * — the +5/+15/+30s cadence lives entirely in the BROWSER (the caller of
 * `continuePulseEnrollmentTrace`), the same pattern PulseTransparencyToggle's
 * own `STATUS_POLL_MS` client-side interval already uses.
 *
 * This module NEVER duplicates the build/select/sign/submit mechanics —
 * every one of those stays exactly as `services/horizen/authorizationClient.ts`
 * already implements it (`runHorizenTransparencyAuthorization`, which itself
 * composes prepare -> crossCheckRegistryOwner -> sign -> verifySignatureIntegrity
 * (the local EIP-191 recovery check) -> submit -> first authoritative reread,
 * unchanged, called exactly ONCE by `startPulseEnrollmentTrace`). Later
 * rereads reuse the SAME `verifyHorizenTransparencyActivation` function with
 * `allowStates: RECONCILABLE_STATES`, never re-signing or resubmitting.
 *
 * "Invalidate/supersede any earlier refused authorization" needs no code
 * here — `createPartnerAuthorizationRequest` (partnerAuthorizationStore.ts)
 * already resets a non-CONFIRMED/non-recent-SUBMITTED row on every fresh
 * `prepareHorizenTransparencyAuthorization` call, which
 * `runHorizenTransparencyAuthorization` invokes unchanged.
 *
 * NEVER THE RAW SIGNATURE, NEVER THE RAW PERSONA ID. The signature stays a
 * sha256 commitment (mirrors `partner_authorization_requests.signature_ref`
 * — see the migration's own header). `actorPersonaId` is NEVER persisted on
 * the correlation row and never appears in what these functions return to a
 * route — CLAUDE.md's Identity & Access Spine marks personaId a T0
 * identifier ("NEVER serialise to JSON"), and this table's rows ARE
 * serialised to JSON for the UI. `continuePulseEnrollmentTrace` therefore
 * takes `actorPersonaId` as a fresh per-call argument (the CALLER's own
 * active persona, resolved by the route exactly as `startPulseEnrollmentTrace`
 * already does) rather than reading a stored one.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createHash, randomUUID } from 'crypto';
import { resolveRegistrableAgent, type RegistrableAgentConfig } from './registrableAgents';
import { resolveHorizenRegistrationBinding } from './agentRegistrationBinding';
import { resolvePulseEndpoint } from './pulseEndpoint';
import type { HorizenNetwork } from './identity';
import {
  runHorizenTransparencyAuthorization,
  verifyHorizenTransparencyActivation,
  RECONCILABLE_STATES,
  flattenToolResultText,
  type AuthorizationDeps,
} from './authorizationClient';
import { getPartnerAuthorizationRequest } from './partnerAuthorizationStore';
import { classifyPulseEnrollmentState, type NormalizedMcpSubmissionResult, type McpToolResult } from './mcpSchemaMatch';

export type PulseEnrollmentClassification =
  | 'ENROLLED'
  | 'PARTNER_REJECTED'
  | 'PARTNER_ACCEPTED_NOT_PERSISTED'
  | 'PARTNER_RESPONSE_UNRESOLVED'
  | 'LOCAL_CONTRACT_ERROR';

export interface PulseStatusReadRecord {
  /** 0 = the reread `runHorizenTransparencyAuthorization` already performed as part of its own ceremony, captured by `startPulseEnrollmentTrace`; 5/15/30 = a later `continuePulseEnrollmentTrace` call. */
  atSeconds: 0 | 5 | 15 | 30;
  timestamp: string;
  ok: boolean;
  refusalCode: string | null;
  /** The RAW `get_onboarding_status` MCP tool result — never truncated, never summarised. */
  rawStatusResult: unknown;
  statusArgsUsed: Record<string, unknown> | null;
  /** `classifyPulseEnrollmentState`'s own verdict for this specific read — null only when no raw result exists to classify (a transport-level failure before the tool ever answered). */
  enrollmentState: 'CONFIRMED' | 'NOT_ENROLLED' | 'PENDING_CONVERGENCE' | null;
}

export interface PulseCorrelationRecord {
  attemptId: string;
  authorizationId: string | null;
  agentSlug: string;
  agentId: string | null;
  chain: string | null;
  walletAddress: string | null;
  issuedAt: string | null;
  selectedMessageSource: string | null;
  selectedMessageLength: number | null;
  selectedMessageHash: string | null;
  /** sha256 commitment of the produced signature — see this module's own header for why never the raw signature. */
  signatureRef: string | null;
  submitArguments: Record<string, unknown> | null;
  rawSubmitResponse: unknown;
  normalizedSubmission: NormalizedMcpSubmissionResult | null;
  statusRereadArguments: Record<string, unknown> | null;
  statusReads: PulseStatusReadRecord[];
  reachedPartnerSubmission: boolean;
  localContractError: string | null;
  classification: PulseEnrollmentClassification;
  classificationReason: string;
  /** True once every scheduled reread (t+0/5/15/30s) has run, OR the classification is one that needs no further reads (ENROLLED/PARTNER_REJECTED/LOCAL_CONTRACT_ERROR). The UI stops polling `continue` once this is true. */
  complete: boolean;
  timestamps: Record<string, string>;
  createdAt: string;
}

export type StartPulseEnrollmentTraceResult = { ok: true; record: PulseCorrelationRecord } | { ok: false; reason: string };
export type ContinuePulseEnrollmentTraceResult = { ok: true; record: PulseCorrelationRecord } | { ok: false; reason: string };

export interface StartPulseEnrollmentTraceInput {
  agentSlug: string;
  actorPersonaId: string;
  /** The scheme+host this request arrived on — for the self-fetch of the agent's own Agent Card, same as verify/authorize/route.ts's resolveRequestOrigin. */
  origin: string;
}

const SCHEDULED_REREAD_SECONDS: Array<5 | 15 | 30> = [5, 15, 30];
const TABLE = 'horizen_pulse_correlation_traces';

function isConclusiveWithoutFurtherReads(classification: PulseEnrollmentClassification): boolean {
  return classification === 'ENROLLED' || classification === 'PARTNER_REJECTED' || classification === 'LOCAL_CONTRACT_ERROR';
}

function computeComplete(reachedPartnerSubmission: boolean, statusReads: PulseStatusReadRecord[], classification: PulseEnrollmentClassification): boolean {
  if (!reachedPartnerSubmission) return true; // LOCAL_CONTRACT_ERROR — nothing to reread, ever.
  if (isConclusiveWithoutFurtherReads(classification)) return true;
  return statusReads.length >= 1 + SCHEDULED_REREAD_SECONDS.length; // t+0 plus all three scheduled rereads.
}

function rowToRecord(row: Record<string, unknown>): PulseCorrelationRecord {
  return {
    attemptId: String(row.attempt_id),
    authorizationId: (row.authorization_id as string | null) ?? null,
    agentSlug: String(row.agent_slug),
    agentId: (row.agent_id as string | null) ?? null,
    chain: (row.chain as string | null) ?? null,
    walletAddress: (row.wallet_address as string | null) ?? null,
    issuedAt: (row.issued_at as string | null) ?? null,
    selectedMessageSource: (row.selected_message_source as string | null) ?? null,
    selectedMessageLength: (row.selected_message_length as number | null) ?? null,
    selectedMessageHash: (row.selected_message_hash as string | null) ?? null,
    signatureRef: (row.signature_ref as string | null) ?? null,
    submitArguments: (row.submit_arguments as Record<string, unknown> | null) ?? null,
    rawSubmitResponse: row.raw_submit_response ?? null,
    normalizedSubmission: (row.normalized_submission as NormalizedMcpSubmissionResult | null) ?? null,
    statusRereadArguments: (row.status_reread_arguments as Record<string, unknown> | null) ?? null,
    statusReads: Array.isArray(row.status_reads) ? (row.status_reads as PulseStatusReadRecord[]) : [],
    reachedPartnerSubmission: row.reached_partner_submission === true,
    localContractError: (row.local_contract_error as string | null) ?? null,
    classification: row.classification as PulseEnrollmentClassification,
    classificationReason: String(row.classification_reason),
    complete: row.complete === true,
    timestamps: (row.timestamps as Record<string, string> | null) ?? {},
    createdAt: String(row.created_at),
  };
}

async function insertTrace(record: PulseCorrelationRecord): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) {
    console.error('[PULSE CORRELATION TRACE] no Supabase client available — trace NOT persisted:', JSON.stringify(record));
    return;
  }
  const { error } = await admin.from(TABLE).insert({
    attempt_id: record.attemptId,
    authorization_id: record.authorizationId,
    agent_slug: record.agentSlug,
    agent_id: record.agentId,
    chain: record.chain,
    wallet_address: record.walletAddress,
    issued_at: record.issuedAt,
    selected_message_source: record.selectedMessageSource,
    selected_message_length: record.selectedMessageLength,
    selected_message_hash: record.selectedMessageHash,
    signature_ref: record.signatureRef,
    submit_arguments: record.submitArguments,
    raw_submit_response: record.rawSubmitResponse,
    normalized_submission: record.normalizedSubmission,
    status_reread_arguments: record.statusRereadArguments,
    status_reads: record.statusReads,
    reached_partner_submission: record.reachedPartnerSubmission,
    local_contract_error: record.localContractError,
    classification: record.classification,
    classification_reason: record.classificationReason,
    complete: record.complete,
    timestamps: record.timestamps,
    created_at: record.createdAt,
  });
  if (error) {
    // A migration not yet applied (20260930001900) is the expected shape of
    // this failure until the operator runs it — never let a persistence
    // failure discard the trace the operator is waiting on.
    console.error(`[PULSE CORRELATION TRACE] insert failed (apply migration 20260930001900?): ${error.message}. Record: ${JSON.stringify(record)}`);
  }
}

async function updateTraceStatusReads(
  attemptId: string,
  updates: { statusReads: PulseStatusReadRecord[]; classification: PulseEnrollmentClassification; classificationReason: string; complete: boolean; timestamps: Record<string, string> },
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) {
    console.error('[PULSE CORRELATION TRACE] no Supabase client available — reread NOT persisted for attempt', attemptId);
    return;
  }
  const { error } = await admin
    .from(TABLE)
    .update({
      status_reads: updates.statusReads,
      classification: updates.classification,
      classification_reason: updates.classificationReason,
      complete: updates.complete,
      timestamps: updates.timestamps,
    })
    .eq('attempt_id', attemptId);
  if (error) {
    console.error(`[PULSE CORRELATION TRACE] update failed for attempt "${attemptId}": ${error.message}`);
  }
}

/**
 * Fetch the most recent persisted trace(s) for an agent — read path for the
 * UI, never re-running the ceremony.
 */
export async function getLatestPulseCorrelationTraces(agentSlug: string, limit = 5): Promise<PulseCorrelationRecord[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const { data, error } = await admin.from(TABLE).select('*').eq('agent_slug', agentSlug).order('created_at', { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map(rowToRecord);
}

async function getTraceByAttemptId(attemptId: string): Promise<PulseCorrelationRecord | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data, error } = await admin.from(TABLE).select('*').eq('attempt_id', attemptId).maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data as Record<string, unknown>);
}

function enrollmentStateFromRawStatus(raw: unknown): 'CONFIRMED' | 'NOT_ENROLLED' | 'PENDING_CONVERGENCE' | null {
  if (raw === null || raw === undefined) return null;
  return classifyPulseEnrollmentState(flattenToolResultText(raw as McpToolResult));
}

/**
 * The five-way decision contract, applied to already-computed evidence only
 * — never a second interpretation of raw text (that stays
 * `classifyPulseEnrollmentState`'s and `normalizeMcpSubmissionResult`'s job,
 * both unchanged, both reused as-is). Called after EVERY read — t+0 in
 * `startPulseEnrollmentTrace`, and again after each `continuePulseEnrollmentTrace`
 * — so the classification only ever grows more certain, never regresses.
 */
export function classifyTrace(args: {
  reachedPartnerSubmission: boolean;
  localContractError: string | null;
  submissionRejected: boolean;
  submissionConfirmed: boolean;
  statusReads: PulseStatusReadRecord[];
}): { classification: PulseEnrollmentClassification; reason: string } {
  if (!args.reachedPartnerSubmission) {
    return {
      classification: 'LOCAL_CONTRACT_ERROR',
      reason: `arguments, message, signature recovery or chain resolution failed before enable_pulse_monitoring was ever called: ${args.localContractError ?? 'unknown local failure'}`,
    };
  }
  if (args.submissionRejected) {
    return {
      classification: 'PARTNER_REJECTED',
      reason: 'the enable_pulse_monitoring response explicitly reported rejection or failure',
    };
  }
  const anyConfirmed = args.statusReads.some((r) => r.enrollmentState === 'CONFIRMED');
  if (anyConfirmed) {
    return {
      classification: 'ENROLLED',
      reason: 'an authoritative get_onboarding_status reread explicitly reported Pulse enabled',
    };
  }
  const allScheduledReadsIn = args.statusReads.length >= 1 + SCHEDULED_REREAD_SECONDS.length;
  if (args.submissionConfirmed) {
    return {
      classification: 'PARTNER_ACCEPTED_NOT_PERSISTED',
      reason: allScheduledReadsIn
        ? 'the submission explicitly reported success/accepted/enabled, but every status reread (t+0/5/15/30s) reported not enrolled — Horizen accepted the attempt but did not persist or expose it'
        : `the submission explicitly reported success/accepted/enabled, but the ${args.statusReads.length} status read(s) so far report not enrolled — provisional until all scheduled rereads complete`,
    };
  }
  return {
    classification: 'PARTNER_RESPONSE_UNRESOLVED',
    reason: allScheduledReadsIn
      ? 'the submission response did not clearly state success or failure, and status remained not enrolled through every reread (t+0/5/15/30s)'
      : `the submission response did not clearly state success or failure, and the ${args.statusReads.length} status read(s) so far report not enrolled — provisional until all scheduled rereads complete`,
  };
}

/**
 * STEP 1 of Al's hardened sequence — build, sign, submit ONCE, persist raw
 * evidence, perform the immediate (t+0) status read, RETURN IMMEDIATELY. No
 * `setTimeout`, no sleep. Whatever latency exists here is exactly the SAME
 * single round trip `/verify/authorize` has always made (build -> sign ->
 * submit -> one reread) — this function calls the identical, unmodified
 * `runHorizenTransparencyAuthorization`, never a slower or riskier path.
 */
export async function startPulseEnrollmentTrace(
  input: StartPulseEnrollmentTraceInput,
  deps: AuthorizationDeps = {},
): Promise<StartPulseEnrollmentTraceResult> {
  const attemptId = randomUUID();
  const timestamps: Record<string, string> = { traceStarted: new Date().toISOString() };
  const stamp = (key: string) => {
    timestamps[key] = new Date().toISOString();
  };

  const agent: RegistrableAgentConfig | null = resolveRegistrableAgent(input.agentSlug);
  if (!agent) return { ok: false, reason: `"${input.agentSlug}" is not a registrable agent` };

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'Service unavailable — no Supabase client' };

  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    return { ok: false, reason: `${agent.displayName} has no Horizen tokenId yet — the Register stage must complete first` };
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;

  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
  if (!addresses?.evmAddress) {
    return { ok: false, reason: `no evm_address on record for agent "${agent.runtimeAgentId}"` };
  }

  let agentCardHash: string;
  let pulseEndpoint: string | null;
  try {
    const cardRes = await fetch(`${input.origin}${agent.agentCardPath}?_cb=${Date.now()}-${Math.random().toString(36).slice(2)}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!cardRes.ok) throw new Error(`agent-card fetch failed: HTTP ${cardRes.status}`);
    const cardText = await cardRes.text();
    agentCardHash = createHash('sha256').update(cardText, 'utf8').digest('hex');
    pulseEndpoint = resolvePulseEndpoint(JSON.parse(cardText));
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'agent-card fetch failed' };
  }
  if (!pulseEndpoint) {
    return { ok: false, reason: `${agent.displayName} has no Agent Runtime Endpoint declared — Pulse has nothing to health-check` };
  }

  const authorizationId = `horizen-pulse-auth-${agent.aigentQubeId}-${binding.token_id}-${network}`;
  stamp('inputsResolved');

  /*
   * THE ENTIRE build -> crossCheckRegistryOwner -> sign -> verifySignatureIntegrity
   * -> submit -> first reread ceremony, UNCHANGED, called EXACTLY ONCE. Same
   * scope as the existing "Authorize Pulse monitoring & P&L disclosure"
   * button, so this is the SAME authorizationId and the SAME ceremony an
   * operator's click would run, not a parallel one.
   */
  const result = await runHorizenTransparencyAuthorization(
    {
      authorizationId,
      actorPersonaId: input.actorPersonaId,
      aigentQubeId: agent.aigentQubeId,
      agentCardHash,
      controllerWallet: addresses.evmAddress,
      keyRef: agent.runtimeAgentId,
      registry: { network, tokenId: binding.token_id, registryAlias: binding.registry_alias ?? undefined },
      scope: ['pulse-monitoring', 'pnl-disclosure'],
      agentDisplayName: agent.displayName,
      pulseEndpoint,
    },
    deps,
  );
  stamp('enableCallReturned');

  const resolvedAuthorizationId = result.diagnostics?.authorizationId ?? authorizationId;
  const persistedRecord = await getPartnerAuthorizationRequest(resolvedAuthorizationId, admin);

  const selection = result.diagnostics?.selection ?? null;
  const baseFields = {
    attemptId: result.diagnostics?.attemptId ?? attemptId,
    authorizationId: resolvedAuthorizationId,
    agentSlug: input.agentSlug,
    agentId: persistedRecord?.agentId ?? null,
    chain: network,
    walletAddress: persistedRecord?.walletAddress ?? null,
    issuedAt: persistedRecord?.issuedAt ?? result.diagnostics?.issuedAt ?? null,
    selectedMessageSource: selection?.source ?? null,
    selectedMessageLength: selection?.messageByteLength ?? null,
    selectedMessageHash: selection?.messageHash ?? null,
    signatureRef: persistedRecord?.signatureRef ?? null,
  };

  // Did this attempt actually reach enable_pulse_monitoring? Only the submit
  // stage's own additive fields (2026-08-06) populate `rawSubmitResult` —
  // absent means every earlier stage's own refusal (a LOCAL_CONTRACT_ERROR
  // by the required sequence's own definition: "arguments, message,
  // signature recovery or chain resolution fail before submission").
  const reachedPartnerSubmission = result.rawSubmitResult !== undefined;

  if (!reachedPartnerSubmission) {
    const localContractError = result.ok ? 'unexpected: submission succeeded with no rawSubmitResult captured' : `${result.refusalCode}: ${result.detail}`;
    const { classification, reason } = classifyTrace({
      reachedPartnerSubmission: false,
      localContractError,
      submissionRejected: false,
      submissionConfirmed: false,
      statusReads: [],
    });
    const record: PulseCorrelationRecord = {
      ...baseFields,
      submitArguments: null,
      rawSubmitResponse: null,
      normalizedSubmission: null,
      statusRereadArguments: null,
      statusReads: [],
      reachedPartnerSubmission: false,
      localContractError,
      classification,
      classificationReason: reason,
      complete: true,
      timestamps,
      createdAt: new Date().toISOString(),
    };
    await insertTrace(record);
    return { ok: true, record };
  }

  // Reached Horizen. The reread `runHorizenTransparencyAuthorization` itself
  // already ran IS this trace's t=0 read — captured via the same additive
  // rawStatusResult/statusArgsUsed fields, never re-invoked here.
  const statusReads: PulseStatusReadRecord[] = [
    {
      atSeconds: 0,
      timestamp: timestamps.enableCallReturned,
      ok: result.ok || result.rawStatusResult !== undefined,
      refusalCode: result.ok ? null : result.refusalCode,
      rawStatusResult: result.rawStatusResult ?? null,
      statusArgsUsed: result.statusArgsUsed ?? null,
      enrollmentState: enrollmentStateFromRawStatus(result.rawStatusResult),
    },
  ];

  const normalizedSubmission = result.partnerResponse ?? null;
  const submissionRejected = normalizedSubmission?.semanticStatus === 'rejected' || (!result.ok && result.refusalCode === 'HORIZEN_SUBMISSION_REJECTED');
  const submissionConfirmed = normalizedSubmission?.semanticStatus === 'confirmed';
  const { classification, reason } = classifyTrace({ reachedPartnerSubmission: true, localContractError: null, submissionRejected, submissionConfirmed, statusReads });

  const record: PulseCorrelationRecord = {
    ...baseFields,
    submitArguments: result.submittedArguments ?? null,
    rawSubmitResponse: result.rawSubmitResult ?? null,
    normalizedSubmission,
    statusRereadArguments: statusReads[0]?.statusArgsUsed ?? null,
    statusReads,
    reachedPartnerSubmission: true,
    localContractError: null,
    classification,
    classificationReason: reason,
    complete: computeComplete(true, statusReads, classification),
    timestamps,
    createdAt: new Date().toISOString(),
  };
  await insertTrace(record);
  return { ok: true, record };
}

/**
 * STEP 2 of Al's hardened sequence — called by the UI at ~+5/+15/+30s
 * relative to when `startPulseEnrollmentTrace` returned. Performs EXACTLY
 * ONE authoritative reread (never re-signs, never resubmits — the
 * `verifyHorizenTransparencyActivation` call below is a plain
 * get_onboarding_status read with `allowStates: RECONCILABLE_STATES`),
 * appends it to the SAME persisted trace, recomputes the classification, and
 * returns. A no-op (returns the record unchanged) once the trace is already
 * `complete` — safe to call an extra time without effect.
 */
export async function continuePulseEnrollmentTrace(
  attemptId: string,
  actorPersonaId: string,
  deps: AuthorizationDeps = {},
): Promise<ContinuePulseEnrollmentTraceResult> {
  const record = await getTraceByAttemptId(attemptId);
  if (!record) return { ok: false, reason: `no trace found for attempt "${attemptId}"` };
  if (record.complete) return { ok: true, record };

  const nextAtSecondsIndex = record.statusReads.length - 1; // t+0 already present at index 0
  const nextAtSeconds = SCHEDULED_REREAD_SECONDS[nextAtSecondsIndex];
  if (nextAtSeconds === undefined) return { ok: true, record }; // already has all scheduled reads

  const agent = resolveRegistrableAgent(record.agentSlug);
  if (!agent) return { ok: false, reason: `"${record.agentSlug}" is no longer a registrable agent` };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'Service unavailable — no Supabase client' };
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) return { ok: false, reason: `${agent.displayName} no longer has a Horizen tokenId` };
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
  if (!addresses?.evmAddress) return { ok: false, reason: `no evm_address on record for agent "${agent.runtimeAgentId}"` };

  const network = (binding.network ?? record.chain ?? 'base-sepolia') as HorizenNetwork;
  const registry = { network, tokenId: binding.token_id, registryAlias: binding.registry_alias ?? undefined };
  const authorizationId = record.authorizationId ?? `horizen-pulse-auth-${agent.aigentQubeId}-${binding.token_id}-${network}`;

  const reread = await verifyHorizenTransparencyActivation(
    authorizationId,
    { actorPersonaId, registry, controllerWallet: addresses.evmAddress, allowStates: RECONCILABLE_STATES },
    deps,
  );
  const timestamps = { ...record.timestamps, [`statusReread_${nextAtSeconds}s`]: new Date().toISOString() };
  const newRead: PulseStatusReadRecord = {
    atSeconds: nextAtSeconds,
    timestamp: timestamps[`statusReread_${nextAtSeconds}s`],
    ok: reread.ok,
    refusalCode: reread.ok ? null : reread.refusalCode,
    rawStatusResult: reread.rawStatusResult ?? null,
    statusArgsUsed: reread.statusArgsUsed ?? null,
    enrollmentState: enrollmentStateFromRawStatus(reread.rawStatusResult),
  };
  const statusReads = [...record.statusReads, newRead];

  const submissionRejected = record.normalizedSubmission?.semanticStatus === 'rejected';
  const submissionConfirmed = record.normalizedSubmission?.semanticStatus === 'confirmed';
  const { classification, reason } = classifyTrace({
    reachedPartnerSubmission: true,
    localContractError: null,
    submissionRejected,
    submissionConfirmed,
    statusReads,
  });
  const complete = computeComplete(true, statusReads, classification);

  await updateTraceStatusReads(attemptId, { statusReads, classification, classificationReason: reason, complete, timestamps });

  return {
    ok: true,
    record: { ...record, statusReads, classification, classificationReason: reason, complete, timestamps },
  };
}
