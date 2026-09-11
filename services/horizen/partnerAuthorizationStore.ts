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
  | {
      ok: true;
      record: PartnerAuthorizationRequestRecord;
      /**
       * Did this call INSERT a brand-new row, or RESET an existing one under
       * the same deterministic authorizationId? Al's audit brief, 2026-08-06:
       * "Capture and show... whether the row was inserted or reused." A
       * caller that only ever sees `ok: true` cannot otherwise distinguish
       * "first-ever authorization for this agent" from "retry after a
       * refusal" — both look identical without this flag.
       */
      wasReset: boolean;
      /** The row's issuedAt/nonce BEFORE this write — null when wasReset is false (nothing existed to compare against). */
      previousIssuedAt: string | null;
      previousNonce: string | null;
    }
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
  | { ok: false; refusalCode: 'LOCAL_PERSISTENCE_FAILED'; detail: string }
  /**
   * `authorizationId` is DETERMINISTIC per (aigentQubeId, tokenId, network) —
   * see app/api/journey/moneypenny-horizen/verify/authorize/route.ts's
   * `horizen-pulse-auth-${aigentQubeId}-${tokenId}-${network}` — so every
   * retry for the SAME agent targets the SAME primary key, by design (one
   * authorization per agent, not one row per attempt). A row already exists
   * AND has reached SUBMITTED or CONFIRMED — i.e. Horizen may already have
   * this authorization on record — so resetting it here would silently
   * abandon a submission that might still resolve. Refuse and name the
   * existing state; the caller must re-read status, never blindly re-prepare.
   */
  | { ok: false; refusalCode: 'AUTHORIZATION_ALREADY_IN_FLIGHT'; detail: string; existingState: PartnerAuthorizationState };

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

/**
 * `23505` (unique_violation) fires from EITHER of this table's two unique
 * constraints — the PRIMARY KEY on `authorization_id`, or
 * `uq_partner_authorization_requests_partner_nonce` on `(partner, nonce)` —
 * and Postgres/PostgREST names the violated constraint in the error, so
 * which one fired is never a guess. Blindly reporting every 23505 as a nonce
 * replay (fixed 2026-08-04) misattributed a PRIMARY KEY collision — expected
 * on a RETRY, since authorizationId is deterministic per agent — as a
 * coincidental reuse of a nonce that was in fact generated fresh moments
 * earlier and could not possibly have been "used" before.
 */
function isAuthorizationIdCollision(error: { message?: string; details?: string } | null | undefined): boolean {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
  return /authorization_id|_pkey/i.test(text) && !/\bnonce\b/i.test(text);
}

export async function createPartnerAuthorizationRequest(
  input: CreatePartnerAuthorizationRequestInput,
  admin?: SupabaseClient,
  /**
   * `nowFn` is injectable so the staleness comparison below is deterministic
   * under test — defaults to real wall-clock time for production callers
   * (authorizationClient.ts never passes one). A prior version compared
   * against a bare `new Date()` with no way to fix it, which made
   * "is this SUBMITTED row stale" silently depend on how much real time had
   * elapsed since a test fixture's hardcoded issuedAt — passing today,
   * failing two days later with no code change (caught 2026-08-06).
   */
  deps: { nowFn?: () => Date } = {},
): Promise<CreatePartnerAuthorizationRequestResult> {
  if (!input.nonce) {
    return { ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED', detail: 'nonce is empty' };
  }
  const nowFn = deps.nowFn ?? (() => new Date());
  const client = adminOrDefault(admin);
  const now = nowFn().toISOString();
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

  if (!error) {
    console.log(
      `[PULSE AUTHORIZATION LIFECYCLE] authorization "${input.authorizationId}" — row INSERTED (first attempt for ` +
        `this agent/network). nonce=${input.nonce} issuedAt=${input.issuedAt}`,
    );
    return { ok: true, record: rowToRecord(data as DbRow), wasReset: false, previousIssuedAt: null, previousNonce: null };
  }

  if (error.code === '23505' && isAuthorizationIdCollision(error)) {
    /*
     * A RETRY FOR THE SAME AGENT, NOT A DUPLICATE (2026-08-04). One
     * authorization per (aigentQubeId, tokenId, network) is the DESIGN — see
     * this function's own header — so a row already existing under this id
     * is the expected shape of "the operator clicked Authorize again", not
     * an error. What matters is whether Horizen might already have it:
     *   - CONFIRMED: refuse — resetting could silently abandon a confirmed
     *     authorization. Re-read status instead.
     *   - SUBMITTED (recent): refuse — authorization may still be in flight.
     *     Re-read status instead.
     *   - SUBMITTED (stale): the request is old enough that it cannot be in
     *     flight anymore (operator escalation, 2026-08-06: "the request
     *     carries a short validity window... Horizen's server-side
     *     reconstruction refuses a stale issuedAt"). Safe to reset and retry.
     *   - anything else (PREPARED/AWAITING_SIGNATURE/SIGNED/REFUSED/EXPIRED/
     *     QUARANTINED): Horizen's state-changing call was never confirmed to
     *     have landed, so it's safe to reset the row with THIS attempt's
     *     fresh nonce/issuedAt/facts and let the ceremony proceed exactly as
     *     if this were a fresh row.
     */
    const existing = await getPartnerAuthorizationRequest(input.authorizationId, client);
    if (existing && existing.state === 'CONFIRMED') {
      return {
        ok: false,
        refusalCode: 'AUTHORIZATION_ALREADY_IN_FLIGHT',
        detail:
          `authorization "${input.authorizationId}" already exists in state ${existing.state} — Horizen has ` +
          `confirmed activation. Re-read status rather than re-preparing.`,
        existingState: existing.state,
      };
    }

    // SUBMITTED rows are allowed to reset if they are stale (past the Pulse
    // validity window), indicating the request is no longer in flight.
    const PULSE_AUTH_DEFAULT_VALIDITY_MS = 5 * 60 * 1000;
    let isStaleSubmission = false;
    if (existing && existing.state === 'SUBMITTED' && existing.issuedAt) {
      const ageMs = nowFn().getTime() - new Date(existing.issuedAt).getTime();
      isStaleSubmission = ageMs > PULSE_AUTH_DEFAULT_VALIDITY_MS;
      if (!isStaleSubmission) {
        return {
          ok: false,
          refusalCode: 'AUTHORIZATION_ALREADY_IN_FLIGHT',
          detail:
            `authorization "${input.authorizationId}" already exists in state SUBMITTED (recent) — Horizen may already ` +
            `have this authorization on record. Re-read status rather than re-preparing.`,
          existingState: existing.state,
        };
      }
    }
    if (isStaleSubmission) {
      console.log(
        `[PULSE AUTHORIZATION LIFECYCLE] authorization "${input.authorizationId}" was in SUBMITTED state with ` +
          `issuedAt ${existing!.issuedAt} — older than Pulse's validity window. Resetting for a fresh ceremony.`,
      );
    }
    /*
     * FULL AUDIT LINE FOR EVERY RESET, NOT ONLY THE STALE-SUBMITTED CASE
     * (Al's audit brief, 2026-08-06 — "Capture and show the HTTP response for
     * each click, including... whether the row was inserted or reused"). Old
     * vs new nonce/issuedAt named explicitly so a CloudWatch read settles,
     * without inference, whether a given click actually produced different
     * local values before Horizen was ever asked to build a message.
     */
    console.log(
      `[PULSE AUTHORIZATION LIFECYCLE] authorization "${input.authorizationId}" — row RESET (was ${existing?.state ?? 'unknown'}). ` +
        `previousNonce=${existing?.nonce ?? 'null'} previousIssuedAt=${existing?.issuedAt ?? 'null'} -> ` +
        `newNonce=${input.nonce} newIssuedAt=${input.issuedAt}`,
    );
    const { data: resetData, error: resetError } = await client
      .from(TABLE)
      .update({
        nonce: input.nonce,
        expires_at: input.expiresAt,
        agent_id: input.agentId,
        wallet_address: input.walletAddress,
        issued_at: input.issuedAt,
        payload_hash: null,
        state: 'PREPARED' as PartnerAuthorizationState,
        signer_address: null,
        signature_ref: null,
        submission_ref: null,
        partner_status: null,
        receipt_ref: null,
        refusal_code: null,
        refusal_detail: null,
        updated_at: now,
      })
      .eq('authorization_id', input.authorizationId)
      .select('*')
      .single();
    if (resetError) {
      return {
        ok: false,
        refusalCode: 'LOCAL_PERSISTENCE_FAILED',
        detail: `Authorization was not submitted to Horizen because MetaMe could not reset its stalled local authorization record for a retry: ${resetError.message}`,
      };
    }
    return {
      ok: true,
      record: rowToRecord(resetData as DbRow),
      wasReset: true,
      previousIssuedAt: existing?.issuedAt ?? null,
      previousNonce: existing?.nonce ?? null,
    };
  }

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
  /**
   * Optional (2026-08-08) — reconcilePulseConstitutionalState's AGREEMENT
   * path records a reconciliation check (partnerStatus only) against an
   * ALREADY-CONFIRMED row without writing `state` at all, per the operator's
   * "reconciliation never rewrites constitutional history" directive. Every
   * OTHER caller in this codebase still passes `state` explicitly — this
   * relaxation exists for that one caller, never as license to omit it
   * elsewhere.
   */
  state?: PartnerAuthorizationState;
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

  // `state` is omitted from the update payload entirely when the caller did
  // not supply one — never sent as `undefined` and left to whatever the
  // Supabase client's JSON serialization happens to do with that.
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.state !== undefined) row.state = patch.state;
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
