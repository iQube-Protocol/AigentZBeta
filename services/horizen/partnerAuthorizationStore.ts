/**
 * Persistence for partner-authorization requests (GJR-VFY-001 Phase 1).
 *
 * One row per authorization request, carried through its own state machine
 * (`PREPARED → AWAITING_SIGNATURE → SIGNED → SUBMITTED → CONFIRMED`, or a
 * terminal `REFUSED`/`EXPIRED`/`QUARANTINED`) — this is a state MACHINE on one
 * row, not a supersede-chain: unlike an Independent Review, a single
 * authorization request has one lifecycle, not competing later versions.
 *
 * Table is partner-agnostic in shape (`partner` is a column, not a table
 * name) so a second partner never needs a parallel table — but Phase 1 only
 * ever writes `partner: 'horizen'` rows; see
 * `services/horizen/authorizationClient.ts` for the only writer.
 *
 * Never persists plaintext key material. `signatureRef` is a safe reference
 * (a hash) to the produced signature, never the signature's raw private-key
 * origin.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'partner_authorization_requests';

export type PartnerAuthorizationState =
  | 'PREPARED'
  | 'AWAITING_SIGNATURE'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REFUSED'
  | 'EXPIRED'
  | 'QUARANTINED';

export interface PartnerAuthorizationRequestRecord {
  authorizationId: string;
  purpose: string;
  subjectAigentQubeId: string;
  keyRef: string;
  partner: string;
  network: string;
  payloadHash: string | null;
  nonce: string;
  expiresAt: string;
  /**
   * The three facts that produced the signed Pulse message (al / Horizen
   * brief, 2026-08-04) — persisted so a resumed/retried submit reads back the
   * EXACT values, never re-derives them. `null` only for rows created before
   * this correction landed.
   */
  agentId: string | null;
  walletAddress: string | null;
  issuedAt: string | null;
  state: PartnerAuthorizationState;
  signerAddress: string | null;
  signatureRef: string | null;
  submissionRef: string | null;
  partnerStatus: string | null;
  receiptRef: string | null;
  refusalCode: string | null;
  refusalDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  authorization_id: string;
  purpose: string;
  subject_aigent_iqube_id: string;
  key_ref: string;
  partner: string;
  network: string;
  payload_hash: string | null;
  nonce: string;
  expires_at: string;
  agent_id: string | null;
  wallet_address: string | null;
  issued_at: string | null;
  state: PartnerAuthorizationState;
  signer_address: string | null;
  signature_ref: string | null;
  submission_ref: string | null;
  partner_status: string | null;
  receipt_ref: string | null;
  refusal_code: string | null;
  refusal_detail: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: DbRow): PartnerAuthorizationRequestRecord {
  return {
    authorizationId: row.authorization_id,
    purpose: row.purpose,
    subjectAigentQubeId: row.subject_aigent_iqube_id,
    keyRef: row.key_ref,
    partner: row.partner,
    network: row.network,
    payloadHash: row.payload_hash,
    nonce: row.nonce,
    expiresAt: row.expires_at,
    agentId: row.agent_id,
    walletAddress: row.wallet_address,
    issuedAt: row.issued_at,
    state: row.state,
    signerAddress: row.signer_address,
    signatureRef: row.signature_ref,
    submissionRef: row.submission_ref,
    partnerStatus: row.partner_status,
    receiptRef: row.receipt_ref,
    refusalCode: row.refusal_code,
    refusalDetail: row.refusal_detail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreatePartnerAuthorizationRequestInput {
  authorizationId: string;
  purpose: string;
  subjectAigentQubeId: string;
  keyRef: string;
  partner: string;
  network: string;
  nonce: string;
  expiresAt: string;
  /** The exact facts that produced (or will produce) the signed message — see PartnerAuthorizationRequestRecord. */
  agentId: string;
  walletAddress: string;
  issuedAt: string;
}

export type CreatePartnerAuthorizationRequestResult =
  | { ok: true; record: PartnerAuthorizationRequestRecord }
  | { ok: false; refusalCode: 'NONCE_MISSING_OR_REPLAYED'; detail: string }
  /**
   * Any OTHER insert failure (e.g. a schema-drift missing column) — a
   * DEFINITE refusal, never a thrown error (al, 2026-08-04: "the system does
   * know that this attempt did not reach Horizen" — this write happens
   * strictly before signing and before enable_pulse_monitoring, Horizen's
   * only STATE-CHANGING call in this ceremony, is ever invoked. Even though
   * build_pulse_auth_message may already have been called by this point,
   * that call only builds message text — it records nothing on Horizen's
   * side — so a failure here always means Horizen never recorded anything).
   */
  | { ok: false; refusalCode: 'LOCAL_PERSISTENCE_FAILED'; detail: string };

function adminOrDefault(admin?: SupabaseClient): SupabaseClient {
  const client = admin ?? getSupabaseServer();
  if (!client) throw new Error('partnerAuthorizationStore: Supabase configuration missing');
  return client;
}

/**
 * Creates the row in `PREPARED` state. Refuses on nonce reuse for the same
 * partner — the DB's `partner_authorization_requests_partner_nonce_key`
 * unique constraint is the authority; this function interprets that
 * constraint violation as the replay refusal rather than letting a raw
 * Postgres error leak to the caller.
 */
/**
 * Is the authorization store usable RIGHT NOW — asked before, not during, the
 * ceremony.
 *
 * ── WHY THIS EXISTS (operator, 2026-08-03) ───────────────────────────────
 *
 * The Verify ceremony called Horizen FIRST and persisted second, so a missing
 * local table surfaced only after the partner had already been asked to build
 * an authorization message. The operator saw:
 *
 *   createPartnerAuthorizationRequest failed: Could not find the table
 *   'public.partner_authorization_requests' in the schema cache
 *
 * A local prerequisite must be checked locally, before any outbound act. We
 * do not ask a partner to do work we cannot record.
 *
 * The kinds are kept DISTINCT because they have different remedies and the
 * operator has to pick one: a missing migration is a deploy step, a stale
 * PostgREST cache is a reload, a refused write is permissions. Collapsing
 * them into "store unavailable" hands back a fact with no next act.
 */
export type AuthorizationStoreAvailability =
  | { available: true }
  | {
      available: false;
      kind: 'no-client' | 'table-absent' | 'columns-absent' | 'permission-denied' | 'unknown';
      detail: string;
      /** The exact next act, executable — never "check the database". */
      remedy: string;
    };

/**
 * Same detection pair services/receipts/activityReceiptService.ts already
 * uses for its own missing-column canary (inv.engineering.036/037 — one
 * detection method, not a second one invented per table): PostgREST reports
 * an unknown COLUMN as PGRST204, Postgres itself as 42703 (undefined_column)
 * — distinct from PGRST205/42P01 (unknown TABLE) below.
 */
const COLUMN_MISSING_CODES = new Set(['42703', 'PGRST204']);
function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code && COLUMN_MISSING_CODES.has(err.code)) return true;
  return typeof err.message === 'string' && /column .* does not exist|could not find the .* column/i.test(err.message);
}

export async function checkAuthorizationStoreAvailable(
  admin?: SupabaseClient,
): Promise<AuthorizationStoreAvailability> {
  const client = admin ?? getSupabaseServer();
  if (!client) {
    return {
      available: false,
      kind: 'no-client',
      detail: 'no server Supabase client is configured in this environment',
      remedy: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL for this deployment, then redeploy.',
    };
  }

  // `head: true` reads no rows — the cheapest probe that still forces
  // PostgREST to resolve the relation. Selects every column
  // createPartnerAuthorizationRequest's INSERT actually writes (not just
  // authorization_id) — a prior version probed authorization_id alone, which
  // cannot detect a table that exists but is missing agent_id/wallet_address/
  // issued_at (20260930001400's columns). That gap let exactly that drift
  // reach createPartnerAuthorizationRequest's INSERT instead of this
  // pre-flight check — confirmed live, not theoretical (al, 2026-08-04):
  // "Could not find the 'agent_id' column of 'partner_authorization_requests'
  // in the schema cache", surfaced mid-ceremony after Horizen's
  // build_pulse_auth_message had already been called.
  const { error } = await client
    .from(TABLE)
    .select('authorization_id, agent_id, wallet_address, issued_at', { head: true, count: 'exact' })
    .limit(1);
  if (!error) return { available: true };

  /*
   * PostgREST reports an unknown relation as PGRST205 ("Could not find the
   * table … in the schema cache") and Postgres itself as 42P01
   * (undefined_table). Both mean the same thing to an operator — the
   * migration has not reached this database — and both are distinguished
   * here from a permissions refusal (42501 / RLS), which means the table
   * EXISTS and the caller cannot read it. Opposite remedies.
   */
  const code = (error as { code?: string }).code ?? '';
  const message = error.message ?? String(error);
  if (code === 'PGRST205' || code === '42P01' || (/schema cache|does not exist/i.test(message) && !isMissingColumn(error))) {
    return {
      available: false,
      kind: 'table-absent',
      detail: message,
      remedy:
        `Apply supabase/migrations/20260930000500_partner_authorization_requests.sql to this project, ` +
        `then reload PostgREST's schema cache: NOTIFY pgrst, 'reload schema';`,
    };
  }
  if (isMissingColumn(error)) {
    return {
      available: false,
      kind: 'columns-absent',
      detail: message,
      remedy:
        `Apply supabase/migrations/20260930001400_partner_authorization_request_message_facts.sql to this ` +
        `project (adds agent_id/wallet_address/issued_at), then reload PostgREST's schema cache: ` +
        `NOTIFY pgrst, 'reload schema';`,
    };
  }
  if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    return {
      available: false,
      kind: 'permission-denied',
      detail: message,
      remedy: `The table exists but this caller cannot read it — check that the route uses the service-role client, and the RLS policy on ${TABLE}.`,
    };
  }
  return {
    available: false,
    kind: 'unknown',
    detail: message,
    remedy: `Read the error above against ${TABLE}; it is neither a missing table nor a permissions refusal.`,
  };
}

export async function createPartnerAuthorizationRequest(
  input: CreatePartnerAuthorizationRequestInput,
  admin?: SupabaseClient,
): Promise<CreatePartnerAuthorizationRequestResult> {
  if (!input.nonce) {
    return { ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED', detail: 'nonce is empty' };
  }
  const client = adminOrDefault(admin);
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      authorization_id: input.authorizationId,
      purpose: input.purpose,
      subject_aigent_iqube_id: input.subjectAigentQubeId,
      key_ref: input.keyRef,
      partner: input.partner,
      network: input.network,
      nonce: input.nonce,
      expires_at: input.expiresAt,
      agent_id: input.agentId,
      wallet_address: input.walletAddress,
      issued_at: input.issuedAt,
      state: 'PREPARED' as PartnerAuthorizationState,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED', detail: `nonce "${input.nonce}" already used for partner "${input.partner}"` };
    }
    // A DEFINITE refusal, not a thrown error (al, 2026-08-04) — this is the
    // ceremony's local persistence step, strictly before Horizen's
    // state-changing enable_pulse_monitoring call; a failure here always
    // means the authorization was not submitted, never an open question.
    return {
      ok: false,
      refusalCode: 'LOCAL_PERSISTENCE_FAILED',
      detail: `Authorization was not submitted to Horizen because MetaMe could not create its local authorization record: ${error.message}`,
    };
  }
  return { ok: true, record: rowToRecord(data as DbRow) };
}

export async function getPartnerAuthorizationRequest(
  authorizationId: string,
  admin?: SupabaseClient,
): Promise<PartnerAuthorizationRequestRecord | null> {
  const client = adminOrDefault(admin);
  const { data, error } = await client.from(TABLE).select('*').eq('authorization_id', authorizationId).maybeSingle();
  if (error) throw new Error(`getPartnerAuthorizationRequest failed: ${error.message}`);
  return data ? rowToRecord(data as DbRow) : null;
}

export interface PartnerAuthorizationStateUpdate {
  state: PartnerAuthorizationState;
  payloadHash?: string;
  signerAddress?: string;
  signatureRef?: string;
  submissionRef?: string;
  partnerStatus?: string;
  receiptRef?: string;
  refusalCode?: string;
  refusalDetail?: string;
}

/** Loads the row and refuses if it does not exist — never guesses which row to update. */
export async function updatePartnerAuthorizationRequest(
  authorizationId: string,
  patch: PartnerAuthorizationStateUpdate,
  admin?: SupabaseClient,
): Promise<PartnerAuthorizationRequestRecord> {
  const client = adminOrDefault(admin);
  const existing = await getPartnerAuthorizationRequest(authorizationId, client);
  if (!existing) throw new Error(`updatePartnerAuthorizationRequest: no row for authorizationId "${authorizationId}"`);

  const row: Record<string, unknown> = { state: patch.state, updated_at: new Date().toISOString() };
  if (patch.payloadHash !== undefined) row.payload_hash = patch.payloadHash;
  if (patch.signerAddress !== undefined) row.signer_address = patch.signerAddress;
  if (patch.signatureRef !== undefined) row.signature_ref = patch.signatureRef;
  if (patch.submissionRef !== undefined) row.submission_ref = patch.submissionRef;
  if (patch.partnerStatus !== undefined) row.partner_status = patch.partnerStatus;
  if (patch.receiptRef !== undefined) row.receipt_ref = patch.receiptRef;
  if (patch.refusalCode !== undefined) row.refusal_code = patch.refusalCode;
  if (patch.refusalDetail !== undefined) row.refusal_detail = patch.refusalDetail;

  const { data, error } = await client.from(TABLE).update(row).eq('authorization_id', authorizationId).select('*').single();
  if (error) throw new Error(`updatePartnerAuthorizationRequest failed: ${error.message}`);
  return rowToRecord(data as DbRow);
}
