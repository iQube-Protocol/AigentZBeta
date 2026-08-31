/**
 * CTP transition/refusal evidence — the ONE normalized write path (2026-08-31,
 * "CTP foundation"). Persists to `ctp_transition_evidence`
 * (supabase/migrations/20260930140000_ctp_transition_evidence.sql):
 *
 *   - a SUCCESS row is the canonical transition receipt (delivery amendment
 *     §2.3);
 *   - a REFUSED row is refusal evidence, written WITHOUT ever mutating the
 *     protected state the primitive guards (delivery amendment §2.3 /
 *     charter §11 — "failed attempts are also evidence").
 *
 * One table, one shape, discriminated by `outcome` — never two evidence
 * tables that could drift apart.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthorityResolutionResult,
  AuthorizationResolutionResult,
  ConsequenceProjection,
  ConstitutionalTransitionEvidence,
  CTPChannel,
  CTPStateSnapshot,
} from '@/types/ctp';

const EVIDENCE_TABLE = 'ctp_transition_evidence';

const MIGRATION_HINT =
  "the 'ctp_transition_evidence' table does not exist yet — apply " +
  'supabase/migrations/20260930140000_ctp_transition_evidence.sql before the Constitutional Runtime can write evidence';

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || Boolean(error.message?.includes('does not exist'));
}

export interface WriteTransitionReceiptInput {
  primitiveId: string;
  primitiveVersion: string;
  implementationRef: string;
  implementationHash: string;
  subjectPersonaId: string;
  principalPersonaId: string;
  actorPersonaId: string;
  actorKind: 'principal' | 'delegate';
  delegateGrantRef: string | null;
  channel: CTPChannel;
  channelSessionRef: string | null;
  callerPersonaId: string;
  authorityResolution: AuthorityResolutionResult;
  authorizationResolution: AuthorizationResolutionResult;
  priorState: CTPStateSnapshot;
  projectedConsequence: ConsequenceProjection;
  resultingState: CTPStateSnapshot;
  realizedConsequence: Record<string, unknown> | null;
}

export interface WriteRefusalEvidenceInput {
  primitiveId: string;
  primitiveVersion: string | null;
  subjectPersonaId: string | null;
  callerPersonaId: string;
  channel: CTPChannel;
  channelSessionRef: string | null;
  reasonCode: string;
  reason: string;
}

/**
 * A receipt-write failure must NEVER be silent, and must NEVER be reported
 * as if the transition itself failed — by the time this is called, the
 * canonical transition already happened. Logged loudly (mirrors this
 * repo's own `writeLifecycleReceipt`/bulk-review receipt-failure
 * convention); the caller still gets the receipt object back so evidence is
 * observable in-process even if the durable write failed.
 */
export async function writeTransitionReceipt(
  admin: SupabaseClient,
  input: WriteTransitionReceiptInput,
): Promise<ConstitutionalTransitionEvidence> {
  const evidenceId = randomUUID();
  const timestamp = new Date().toISOString();
  const evidence: ConstitutionalTransitionEvidence = {
    evidenceId,
    primitiveId: input.primitiveId,
    primitiveVersion: input.primitiveVersion,
    implementationRef: input.implementationRef,
    implementationHash: input.implementationHash,
    subjectPersonaId: input.subjectPersonaId,
    principalPersonaId: input.principalPersonaId,
    actorPersonaId: input.actorPersonaId,
    actorKind: input.actorKind,
    delegateGrantRef: input.delegateGrantRef,
    channel: input.channel,
    channelSessionRef: input.channelSessionRef,
    callerPersonaId: input.callerPersonaId,
    authorityResolution: input.authorityResolution,
    authorizationResolution: input.authorizationResolution,
    priorState: input.priorState,
    projectedConsequence: input.projectedConsequence,
    resultingState: input.resultingState,
    realizedConsequence: input.realizedConsequence,
    outcome: 'SUCCESS',
    reasonCode: null,
    reason: null,
    timestamp,
  };
  const { error } = await admin.from(EVIDENCE_TABLE).insert(toRow(evidence));
  if (error) {
    console.error(
      '[CTP EVIDENCE] transition receipt not written',
      evidenceId,
      isMissingTable(error) ? MIGRATION_HINT : error.message,
    );
  }
  return evidence;
}

export async function writeRefusalEvidence(
  admin: SupabaseClient,
  input: WriteRefusalEvidenceInput,
): Promise<ConstitutionalTransitionEvidence> {
  const evidenceId = randomUUID();
  const timestamp = new Date().toISOString();
  const evidence: ConstitutionalTransitionEvidence = {
    evidenceId,
    primitiveId: input.primitiveId,
    primitiveVersion: input.primitiveVersion,
    implementationRef: null,
    implementationHash: null,
    subjectPersonaId: input.subjectPersonaId,
    principalPersonaId: null,
    actorPersonaId: null,
    actorKind: null,
    delegateGrantRef: null,
    channel: input.channel,
    channelSessionRef: input.channelSessionRef,
    callerPersonaId: input.callerPersonaId,
    authorityResolution: null,
    authorizationResolution: null,
    priorState: null,
    projectedConsequence: null,
    resultingState: null,
    realizedConsequence: null,
    outcome: 'REFUSED',
    reasonCode: input.reasonCode,
    reason: input.reason,
    timestamp,
  };
  // Refusal evidence is the ONLY write this path performs — no protected
  // state is ever touched on a refusal (charter §11).
  const { error } = await admin.from(EVIDENCE_TABLE).insert(toRow(evidence));
  if (error) {
    console.error(
      '[CTP EVIDENCE] refusal evidence not written',
      evidenceId,
      isMissingTable(error) ? MIGRATION_HINT : error.message,
    );
  }
  return evidence;
}

function toRow(e: ConstitutionalTransitionEvidence): Record<string, unknown> {
  return {
    id: e.evidenceId,
    primitive_id: e.primitiveId,
    primitive_version: e.primitiveVersion,
    implementation_ref: e.implementationRef,
    implementation_hash: e.implementationHash,
    subject_persona_id: e.subjectPersonaId,
    principal_persona_id: e.principalPersonaId,
    actor_persona_id: e.actorPersonaId,
    actor_kind: e.actorKind,
    delegate_grant_ref: e.delegateGrantRef,
    channel: e.channel,
    channel_session_ref: e.channelSessionRef,
    caller_persona_id: e.callerPersonaId,
    authority_resolution: e.authorityResolution,
    authorization_resolution: e.authorizationResolution,
    prior_state: e.priorState,
    projected_consequence: e.projectedConsequence,
    resulting_state: e.resultingState,
    realized_consequence: e.realizedConsequence,
    outcome: e.outcome,
    reason_code: e.reasonCode,
    reason: e.reason,
    created_at: e.timestamp,
  };
}
