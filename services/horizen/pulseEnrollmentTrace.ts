/**
 * Pulse enrollment correlation trace — "Close Nakamoto Pulse Enrollment —
 * Final Correlated Trace" (operator directive, 2026-08-06).
 *
 * Constraint on that directive, verbatim: "Do not change agreement
 * identifiers, ratification, Standing, Agent Bench, wallet selection,
 * signature generation, message selection or health routing. The sole
 * objective is to determine why a fresh, locally valid
 * enable_pulse_monitoring submission does not become an enrolled state."
 *
 * This module NEVER duplicates the build/select/sign/submit mechanics —
 * every one of those stays exactly as `services/horizen/authorizationClient.ts`
 * already implements it (`runHorizenTransparencyAuthorization`, which itself
 * composes prepare -> crossCheckRegistryOwner -> sign -> verifySignatureIntegrity
 * (the local EIP-191 recovery check) -> submit -> first authoritative reread,
 * unchanged). This module's only two additions are:
 *
 *   1. Three FURTHER authoritative rereads at +5s/+15s/+30s after the first
 *      one `runHorizenTransparencyAuthorization` already performs — using
 *      the SAME `verifyHorizenTransparencyActivation` function, the SAME
 *      `pulseStatusCandidates` schema-matched arguments, with
 *      `allowStates: RECONCILABLE_STATES` so a reread that already flipped
 *      the row to REFUSED (e.g. PARTNER_NOT_ENROLLED) does not block the
 *      next one.
 *   2. A five-way DECISION CONTRACT built purely from what those calls
 *      returned (never re-deriving or second-guessing the classifications
 *      `classifyPulseEnrollmentState`/`normalizeMcpSubmissionResult` already
 *      compute), persisted as one correlation record per attempt.
 *
 * "Invalidate/supersede any earlier refused authorization" (the required
 * sequence's step 1) needs no code here — `createPartnerAuthorizationRequest`
 * (partnerAuthorizationStore.ts) already resets a non-CONFIRMED/non-recent-
 * SUBMITTED row on every fresh `prepareHorizenTransparencyAuthorization` call,
 * which `runHorizenTransparencyAuthorization` invokes unchanged.
 *
 * NEVER THE RAW SIGNATURE — see the migration's own header
 * (20260930001900_horizen_pulse_correlation_traces.sql) for why this mirrors
 * `partner_authorization_requests.signature_ref`'s existing "commitment, not
 * the bearer signature" discipline rather than inventing a laxer one.
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
  /** 0 = the reread `runHorizenTransparencyAuthorization` already performed as part of its own ceremony; 5/15/30 = this module's additional rereads. */
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
  timestamps: Record<string, string>;
  createdAt: string;
}

export type RunPulseEnrollmentTraceResult =
  | { ok: true; record: PulseCorrelationRecord }
  | { ok: false; reason: string };

export interface RunPulseEnrollmentTraceInput {
  agentSlug: string;
  actorPersonaId: string;
  /** The scheme+host this request arrived on — for the self-fetch of the agent's own Agent Card, same as verify/authorize/route.ts's resolveRequestOrigin. */
  origin: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistTrace(record: PulseCorrelationRecord): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) {
    console.error('[PULSE CORRELATION TRACE] no Supabase client available — trace NOT persisted:', JSON.stringify(record));
    return;
  }
  const { error } = await admin.from('horizen_pulse_correlation_traces').insert({
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
    timestamps: record.timestamps,
    created_at: record.createdAt,
  });
  if (error) {
    // A migration not yet applied (20260930001900) is the expected shape of
    // this failure until the operator runs it — never let a persistence
    // failure discard the trace the operator is waiting on.
    console.error(`[PULSE CORRELATION TRACE] persistence failed (apply migration 20260930001900?): ${error.message}. Record: ${JSON.stringify(record)}`);
  }
}

/**
 * Fetch the most recent persisted trace(s) for an agent — read path for the
 * UI, never re-running the ceremony.
 */
export async function getLatestPulseCorrelationTraces(agentSlug: string, limit = 5): Promise<PulseCorrelationRecord[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const { data, error } = await admin
    .from('horizen_pulse_correlation_traces')
    .select('*')
    .eq('agent_slug', agentSlug)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => ({
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
    timestamps: (row.timestamps as Record<string, string> | null) ?? {},
    createdAt: String(row.created_at),
  }));
}

function enrollmentStateFromRawStatus(raw: unknown): 'CONFIRMED' | 'NOT_ENROLLED' | 'PENDING_CONVERGENCE' | null {
  if (raw === null || raw === undefined) return null;
  return classifyPulseEnrollmentState(flattenToolResultText(raw as McpToolResult));
}

/**
 * The five-way decision contract, applied to already-computed evidence only
 * — never a second interpretation of raw text (that stays
 * `classifyPulseEnrollmentState`'s and `normalizeMcpSubmissionResult`'s job,
 * both unchanged, both reused as-is).
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
  if (args.submissionConfirmed) {
    return {
      classification: 'PARTNER_ACCEPTED_NOT_PERSISTED',
      reason: 'the submission explicitly reported success/accepted/enabled, but every status reread (t+0/5/15/30s) reported not enrolled — Horizen accepted the attempt but did not persist or expose it',
    };
  }
  return {
    classification: 'PARTNER_RESPONSE_UNRESOLVED',
    reason: 'the submission response did not clearly state success or failure, and status remained not enrolled through every reread (t+0/5/15/30s)',
  };
}

export async function runPulseEnrollmentTrace(
  input: RunPulseEnrollmentTraceInput,
  deps: AuthorizationDeps = {},
): Promise<RunPulseEnrollmentTraceResult> {
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
  const registry = { network, tokenId: binding.token_id, registryAlias: binding.registry_alias ?? undefined };
  stamp('inputsResolved');

  /*
   * THE ENTIRE build -> crossCheckRegistryOwner -> sign -> verifySignatureIntegrity
   * -> submit -> first reread ceremony, UNCHANGED. This is the ONE call to
   * enable_pulse_monitoring the required sequence asks for — nothing in this
   * module calls it a second time. Same scope as the existing "Authorize
   * Pulse monitoring & P&L disclosure" button, so this is the SAME
   * authorizationId and the SAME ceremony an operator's click would run, not
   * a parallel one.
   */
  const result = await runHorizenTransparencyAuthorization(
    {
      authorizationId,
      actorPersonaId: input.actorPersonaId,
      aigentQubeId: agent.aigentQubeId,
      agentCardHash,
      controllerWallet: addresses.evmAddress,
      keyRef: agent.runtimeAgentId,
      registry,
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
      timestamps,
      createdAt: new Date().toISOString(),
    };
    await persistTrace(record);
    return { ok: true, record };
  }

  // Reached Horizen. The reread `runHorizenTransparencyAuthorization` itself
  // already ran IS this trace's t=0 read — captured via the same additive
  // rawStatusResult/statusArgsUsed fields, never re-invoked.
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

  // Three FURTHER rereads at +5s/+15s/+30s — the required sequence's step 8.
  // `allowStates: RECONCILABLE_STATES` so a row the t=0 reread already
  // flipped to REFUSED (PARTNER_NOT_ENROLLED) does not block these.
  const delays: Array<5 | 15 | 30> = [5, 15, 30];
  let previousElapsedMs = 0;
  for (const atSeconds of delays) {
    const waitMs = atSeconds * 1000 - previousElapsedMs;
    if (waitMs > 0) await sleep(waitMs);
    previousElapsedMs = atSeconds * 1000;

    const reread = await verifyHorizenTransparencyActivation(
      resolvedAuthorizationId,
      {
        actorPersonaId: input.actorPersonaId,
        registry,
        controllerWallet: addresses.evmAddress,
        allowStates: RECONCILABLE_STATES,
      },
      deps,
    );
    stamp(`statusReread_${atSeconds}s`);
    statusReads.push({
      atSeconds,
      timestamp: timestamps[`statusReread_${atSeconds}s`],
      ok: reread.ok,
      refusalCode: reread.ok ? null : reread.refusalCode,
      rawStatusResult: reread.rawStatusResult ?? null,
      statusArgsUsed: reread.statusArgsUsed ?? null,
      enrollmentState: enrollmentStateFromRawStatus(reread.rawStatusResult),
    });
  }

  const normalizedSubmission = result.partnerResponse ?? null;
  const { classification, reason } = classifyTrace({
    reachedPartnerSubmission: true,
    localContractError: null,
    submissionRejected: normalizedSubmission?.semanticStatus === 'rejected' || (!result.ok && result.refusalCode === 'HORIZEN_SUBMISSION_REJECTED'),
    submissionConfirmed: normalizedSubmission?.semanticStatus === 'confirmed',
    statusReads,
  });

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
    timestamps,
    createdAt: new Date().toISOString(),
  };
  await persistTrace(record);
  return { ok: true, record };
}
