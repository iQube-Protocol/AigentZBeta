/**
 * Persistence for SigningRequest rows (Wallet Signing Topology, operator
 * ruling 2026-08-01). See types/signingRequest.ts for the full contract and
 * why this is a new table, not an extension of partnerAuthorizationStore.ts.
 *
 * One row per request, carried through its own state machine
 * (`pending -> approved -> executed`, or a terminal `refused`/`expired`).
 * Mirrors services/horizen/partnerAuthorizationStore.ts's injectable-client
 * shape so tests can pass a fake SupabaseClient directly.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateSigningRequestInput,
  SigningRequest,
  SigningRequestStatus,
} from '@/types/signingRequest';

const TABLE = 'signing_requests';

interface DbRow {
  id: string;
  action_kind: SigningRequest['actionKind'];
  signer_role: SigningRequest['signerRole'];
  principal_persona_id: string;
  subject_agent_ref: string | null;
  subject_aigentqube_id: string | null;
  authority_credential: string | null;
  wallet_ref: string;
  network: string;
  payload: string;
  payload_hash: string;
  consequence: string;
  nonce: string;
  expires_at: string;
  receipt_destination: string;
  status: SigningRequestStatus;
  signature: string | null;
  signer_address: string | null;
  refusal_code: string | null;
  refusal_detail: string | null;
  related_activity_receipt_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

function rowToRecord(row: DbRow): SigningRequest {
  return {
    id: row.id,
    actionKind: row.action_kind,
    signerRole: row.signer_role,
    principalPersonaId: row.principal_persona_id,
    subjectAgentRef: row.subject_agent_ref,
    subjectAigentQubeId: row.subject_aigentqube_id,
    authorityCredential: row.authority_credential,
    walletRef: row.wallet_ref,
    network: row.network,
    payload: row.payload,
    payloadHash: row.payload_hash,
    consequence: row.consequence,
    nonce: row.nonce,
    expiresAt: row.expires_at,
    receiptDestination: row.receipt_destination,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    signature: row.signature,
    signerAddress: row.signer_address,
    refusalCode: row.refusal_code,
    refusalDetail: row.refusal_detail,
    relatedActivityReceiptId: row.related_activity_receipt_id,
  };
}

function adminOrDefault(admin?: SupabaseClient): SupabaseClient {
  const client = admin ?? getSupabaseServer();
  if (!client) throw new Error('signingRequestStore: Supabase configuration missing');
  return client;
}

function sha256Hex(input: string): string {
  // Lazy require to keep this module isomorphic-shaped like its siblings
  // (partnerAuthorizationSigner.ts imports createHash the same way).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require('crypto');
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generates a nonce a caller can embed into a payload's TEXT before creating
 * the request — required whenever the signer's signature must cover the
 * nonce (standard signature-binding practice). Pass the SAME value to
 * `createSigningRequest`'s `nonce` field so the stored row matches what was
 * actually signed.
 */
export function generateSigningNonce(walletRef: string, actionKind: string): string {
  return `${walletRef}:${actionKind}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export type CreateSigningRequestResult =
  | { ok: true; record: SigningRequest }
  | { ok: false; refusalCode: 'NONCE_REPLAYED'; detail: string };

/** Creates the row in `pending` state. Uses `input.nonce` verbatim when supplied (so a pre-signed payload's embedded nonce matches the stored row); otherwise generates one. */
export async function createSigningRequest(
  input: CreateSigningRequestInput,
  admin?: SupabaseClient,
): Promise<CreateSigningRequestResult> {
  const client = adminOrDefault(admin);
  const now = new Date();
  const nonce = input.nonce ?? generateSigningNonce(input.walletRef, input.actionKind);
  const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString();
  const id = `sr_${sha256Hex(`${nonce}:${input.payload}`).slice(0, 24)}`;

  const { data, error } = await client
    .from(TABLE)
    .insert({
      id,
      action_kind: input.actionKind,
      signer_role: input.signerRole,
      principal_persona_id: input.principalPersonaId,
      subject_agent_ref: input.subjectAgentRef,
      subject_aigentqube_id: input.subjectAigentQubeId,
      authority_credential: input.authorityCredential,
      wallet_ref: input.walletRef,
      network: input.network,
      payload: input.payload,
      payload_hash: sha256Hex(input.payload),
      consequence: input.consequence,
      nonce,
      expires_at: expiresAt,
      receipt_destination: input.receiptDestination,
      status: 'pending' as SigningRequestStatus,
      created_at: now.toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, refusalCode: 'NONCE_REPLAYED', detail: `nonce collision for wallet "${input.walletRef}" — retry` };
    }
    throw new Error(`createSigningRequest failed: ${error.message}`);
  }
  return { ok: true, record: rowToRecord(data as DbRow) };
}

export async function getSigningRequest(id: string, admin?: SupabaseClient): Promise<SigningRequest | null> {
  const client = adminOrDefault(admin);
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getSigningRequest failed: ${error.message}`);
  return data ? rowToRecord(data as DbRow) : null;
}

/** Lists pending requests for a principal's OWN self-view (owner self-view exception, CLAUDE.md) — never another persona's. */
export async function listPendingSigningRequestsForPrincipal(
  principalPersonaId: string,
  admin?: SupabaseClient,
): Promise<SigningRequest[]> {
  const client = adminOrDefault(admin);
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('principal_persona_id', principalPersonaId)
    .eq('wallet_ref', 'principal')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPendingSigningRequestsForPrincipal failed: ${error.message}`);
  return (data as DbRow[]).map(rowToRecord);
}

/**
 * Lists pending requests for an agent's wallet UI. Deliberately does NOT
 * select principal_persona_id into the returned shape's normal display path
 * — callers rendering the agent wallet should not surface a raw persona UUID
 * there; this still returns the full record (T0 field included) because
 * server-side orchestration (e.g. approve-agent) needs it, but UI code must
 * not render `principalPersonaId` on an agent-wallet surface.
 */
export async function listPendingSigningRequestsForAgent(
  agentRuntimeId: string,
  admin?: SupabaseClient,
): Promise<SigningRequest[]> {
  const client = adminOrDefault(admin);
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('wallet_ref', agentRuntimeId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPendingSigningRequestsForAgent failed: ${error.message}`);
  return (data as DbRow[]).map(rowToRecord);
}

/**
 * Everything waiting on ONE operator, across every wallet they control.
 *
 * Deliberately a third question, not a widening of the two above it.
 * `listPendingSigningRequestsForPrincipal` answers "what is waiting in my
 * principal wallet" and `…ForAgent` answers "what is waiting in this agent's
 * wallet". Neither answers "what is waiting on ME", and the Pending Actions
 * surface needs exactly that — an operator who must sign a principal mandate
 * and then approve an agent invocation has two acts in two wallets and one
 * queue.
 *
 * Scoped by `principal_persona_id`, which the ceremony sets on the agent-role
 * request too: an agent request created under this operator's mandate belongs
 * in their queue, and one created under someone else's does not. The grouping
 * by `wallet_ref` happens in the surface, where the distinction between
 * signing domains is rendered — never here, which would flatten it.
 */
export async function listPendingSigningRequestsForOperator(
  principalPersonaId: string,
  admin?: SupabaseClient,
): Promise<SigningRequest[]> {
  const client = adminOrDefault(admin);
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('principal_persona_id', principalPersonaId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listPendingSigningRequestsForOperator failed: ${error.message}`);
  return (data as DbRow[]).map(rowToRecord);
}

export interface SigningRequestStateUpdate {
  status: SigningRequestStatus;
  signature?: string;
  signerAddress?: string;
  refusalCode?: string;
  refusalDetail?: string;
}

/** Loads the row and refuses if it does not exist — never guesses which row to update. */
export async function updateSigningRequest(
  id: string,
  patch: SigningRequestStateUpdate,
  admin?: SupabaseClient,
): Promise<SigningRequest> {
  const client = adminOrDefault(admin);
  const existing = await getSigningRequest(id, client);
  if (!existing) throw new Error(`updateSigningRequest: no row for id "${id}"`);

  const row: Record<string, unknown> = { status: patch.status };
  if (patch.status !== 'pending') row.resolved_at = new Date().toISOString();
  if (patch.signature !== undefined) row.signature = patch.signature;
  if (patch.signerAddress !== undefined) row.signer_address = patch.signerAddress;
  if (patch.refusalCode !== undefined) row.refusal_code = patch.refusalCode;
  if (patch.refusalDetail !== undefined) row.refusal_detail = patch.refusalDetail;

  const { data, error } = await client.from(TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw new Error(`updateSigningRequest failed: ${error.message}`);
  return rowToRecord(data as DbRow);
}

export { sha256Hex };
