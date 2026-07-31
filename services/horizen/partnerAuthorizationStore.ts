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
}

export type CreatePartnerAuthorizationRequestResult =
  | { ok: true; record: PartnerAuthorizationRequestRecord }
  | { ok: false; refusalCode: 'NONCE_MISSING_OR_REPLAYED'; detail: string };

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
    throw new Error(`createPartnerAuthorizationRequest failed: ${error.message}`);
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
