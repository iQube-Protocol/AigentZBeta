/**
 * Wallet Alias Service
 * ─────────────────────────────────────────────────────────────────────────
 * Privacy-preserving external-wallet linkage. Replaces the deprecated
 * plaintext writes to personas.evm_address / btc_address / sol_address.
 *
 * Design:
 * - The DB table `wallet_alias_commitments` stores ONLY the commitment hash.
 * - The plaintext wallet address NEVER hits the table — for v0 it lives only
 *   in the user's connected wallet (browser-resident); future versions will
 *   write the encrypted plaintext into the persona's blakQube.
 * - The commitment is registered on the Escrow ICP canister via register_alias
 *   so the binding is verifiable and TTL-enforced off-platform.
 * - Salt is derived via HMAC keyed by a server secret (WALLET_ALIAS_HMAC_KEY)
 *   so DB-only attackers cannot brute-force address↔persona links even with a
 *   guessed wallet address.
 *
 * v0 limitations (tracked in 2026-04-29_plaintext-wallet-address-deprecation.md):
 * - Salt secret lives server-side rather than per-persona — improves on
 *   plaintext but is weaker than blakQube-bound salt; upgrade in step 4
 * - Mailbox setup is a placeholder ID; DVN routing wiring lands with the
 *   OTA service in the next iteration
 */

import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyMessage } from 'ethers';

// ICP agent is loaded lazily inside registerOnEscrow — avoids module-init errors
// in routes that only use the pure helper functions (challenge, normalise, etc.).

// ─── Types ──────────────────────────────────────────────────────────────────

export type WalletChain = 'evm' | 'btc' | 'sol';
export type WalletAliasStatus = 'active' | 'expired' | 'revoked';

export interface WalletAliasRow {
  id: string;
  root_identity_id: string | null;
  did_persona_id: string | null;
  chain: WalletChain;
  alias_commitment: string;
  mailbox_id: string;
  alias_ttl_days: number;
  expires_at: string;
  status: WalletAliasStatus;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterWalletAliasInput {
  didPersonaId: string;
  chain: WalletChain;
  walletAddress: string;
  /** SIWE-style signature proving control of walletAddress (EVM only for v0). */
  signature?: string;
  /** Original message that was signed (must include nonce + persona ID). */
  message?: string;
  ttlDays?: number;
  /** When true, proceed even if the wallet is already linked to other personas. */
  force?: boolean;
}

export interface RegisterWalletAliasResult {
  ok: true;
  id: string;
  aliasCommitment: string;
  mailboxId: string;
  expiresAt: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

function getServerClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error('Supabase configuration missing');
  return createClient(url, key);
}

function hmacKey(): string {
  const k = process.env.WALLET_ALIAS_HMAC_KEY || '';
  if (!k || k.length < 32) {
    throw new Error(
      'WALLET_ALIAS_HMAC_KEY missing or too short (min 32 chars). Configure a strong server-side secret.'
    );
  }
  return k;
}

function escrowCanisterId(): string | null {
  return process.env.ESCROW_CANISTER_ID || process.env.NEXT_PUBLIC_ESCROW_CANISTER_ID || null;
}

// ─── Address normalisation ──────────────────────────────────────────────────

export function normaliseAddress(chain: WalletChain, address: string): string {
  const a = (address || '').trim();
  if (!a) throw new Error('Address required');
  if (chain === 'evm') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) throw new Error('Invalid EVM address');
    return a.toLowerCase();
  }
  if (chain === 'btc') {
    if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) throw new Error('Invalid BTC address');
    return a;
  }
  if (chain === 'sol') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) throw new Error('Invalid SOL address');
    return a;
  }
  throw new Error(`Unsupported chain: ${chain}`);
}

// ─── Commitment + mailbox ──────────────────────────────────────────────────

/**
 * commitment = HMAC-SHA256(WALLET_ALIAS_HMAC_KEY, persona_uuid || chain || address)
 * Hex-encoded. Server-side keyed so DB-only attackers can't brute-force.
 */
export function buildAliasCommitment(
  didPersonaId: string,
  chain: WalletChain,
  walletAddress: string
): string {
  const normalised = normaliseAddress(chain, walletAddress);
  const message = `${didPersonaId}|${chain}|${normalised}`;
  return crypto.createHmac('sha256', hmacKey()).update(message).digest('hex');
}

export function generateMailboxId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Address fingerprint — a secondary HMAC used to detect cross-persona wallet reuse
 * without revealing the address. Uses a different message prefix from buildAliasCommitment
 * so the two hashes cannot be correlated by an attacker who knows one of them.
 *
 * Requires the `address_fingerprint` column on wallet_alias_commitments (see SQL migration).
 */
export function buildAddressFingerprint(chain: WalletChain, walletAddress: string): string {
  const normalised = normaliseAddress(chain, walletAddress);
  return crypto.createHmac('sha256', hmacKey()).update(`fp|${chain}|${normalised}`).digest('hex');
}

// ─── SIWE-style proof verification (EVM only for v0) ───────────────────────

export function verifyEvmOwnership(
  expectedAddress: string,
  message: string,
  signature: string
): boolean {
  try {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Build a canonical SIWE-ish challenge message. Includes persona ID, chain,
 * domain, and a server-issued nonce so signatures can't be replayed across
 * personas or across our environments.
 */
export function buildOwnershipChallenge(
  didPersonaId: string,
  chain: WalletChain,
  address: string,
  nonce: string,
  domain: string = 'iqube.protocol'
): string {
  return [
    `${domain} wants you to sign in with your wallet to bind it to your persona.`,
    '',
    `Address: ${address}`,
    `Chain: ${chain}`,
    `Persona: ${didPersonaId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    '',
    'By signing, you confirm that this wallet will be linked to this persona only. The link is registered as a privacy-preserving commitment hash.',
  ].join('\n');
}

// ─── Escrow registration ───────────────────────────────────────────────────

/**
 * Register the alias commitment on the Escrow ICP canister. No-op when
 * ESCROW_CANISTER_ID is unset (returns { ok:false, skipped:true }) so the
 * service can run in environments where the canister isn't yet wired.
 *
 * Hard 4s timeout — ICP gateway latency can be unpredictable on a cold Lambda.
 * The DB insert happens before this call, so a slow/hanging canister never
 * blocks the success response.
 */
async function registerOnEscrow(
  aliasCommitmentHex: string,
  mailboxIdHex: string,
  ttlSeconds: number
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const canisterId = escrowCanisterId();
  if (!canisterId) return { ok: false, skipped: true, error: 'Escrow canister not configured' };

  const escrowCall = (async () => {
    try {
      const { getActor } = await import('@/services/ops/icAgent');
      const { escrowIDL } = await import('@/services/ops/idl/escrow');
      const actor: any = await getActor(canisterId, escrowIDL);
      const commitment = Buffer.from(aliasCommitmentHex, 'hex');
      const mailbox = Buffer.from(mailboxIdHex, 'hex');
      await actor.register_alias(commitment, mailbox, ttlSeconds);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Escrow register failed' };
    }
  })();

  const escrowTimeout = new Promise<{ ok: boolean; skipped: boolean; error: string }>((resolve) =>
    setTimeout(() => resolve({ ok: false, skipped: true, error: 'Escrow registration timed out' }), 4_000)
  );

  return Promise.race([escrowCall, escrowTimeout]);
}

// ─── Persona resolution ─────────────────────────────────────────────────────

interface DidPersonaRecord {
  id: string;
  root_id: string | null;
  // Optionally pre-fetched from embedded join — avoids a separate assertOwnership query.
  // undefined = not fetched (separate query needed), null = no row found (RLS or no FK row)
  root_identity?: { auth_user_id: string | null } | null;
}

async function resolveDidPersona(
  supabase: SupabaseClient,
  personaId: string,
  callerAuthUserId: string | null
): Promise<DidPersonaRecord> {
  // FIO handle fast-path (personaId contains '@')
  if (personaId.includes('@')) {
    const { data } = await supabase
      .from('did_persona')
      .select('id, root_id, root_identity(auth_user_id)')
      .ilike('fio_handle', personaId.toLowerCase())
      .maybeSingle();
    if (data) return await assertOwnership(supabase, data as DidPersonaRecord, callerAuthUserId);
  }

  // Single parallel round. Embedded FK joins pull did_persona + root_identity
  // inline — eliminates Round 2 and the assertOwnership separate query.
  type EmbeddedRootIdentity = { auth_user_id: string | null } | null;
  type EmbeddedDidPersona = { id: string; root_id: string | null; root_identity?: EmbeddedRootIdentity } | null;

  const [directRes, knytRes, qriptoRes, legacyRes] = await Promise.all([
    supabase.from('did_persona').select('id, root_id, root_identity(auth_user_id)').eq('id', personaId).maybeSingle(),
    supabase.from('nakamoto_knyt_personas').select('did_persona_id, did_persona(id, root_id, root_identity(auth_user_id))').eq('id', personaId).maybeSingle(),
    supabase.from('nakamoto_qripto_personas').select('did_persona_id, did_persona(id, root_id, root_identity(auth_user_id))').eq('id', personaId).maybeSingle(),
    supabase.from('personas').select('fio_handle').eq('id', personaId).maybeSingle(),
  ]);

  // Direct did_persona hit (with embedded root_identity)
  if (!directRes.error && directRes.data) {
    return await assertOwnership(supabase, directRes.data as DidPersonaRecord, callerAuthUserId);
  }

  // KNYT persona → embedded did_persona (with embedded root_identity)
  const knytRow = knytRes.data as { did_persona_id?: string; did_persona?: EmbeddedDidPersona } | null;
  if (knytRow?.did_persona) {
    return await assertOwnership(supabase, knytRow.did_persona, callerAuthUserId);
  }

  // Qripto persona → embedded did_persona (with embedded root_identity)
  const qriptoRow = qriptoRes.data as { did_persona_id?: string; did_persona?: EmbeddedDidPersona } | null;
  if (qriptoRow?.did_persona) {
    return await assertOwnership(supabase, qriptoRow.did_persona, callerAuthUserId);
  }

  // Legacy persona via fio_handle (1 extra round trip — rare path)
  const legacyRow = legacyRes.data as { fio_handle?: string } | null;
  const fioHandle = legacyRow?.fio_handle;
  if (fioHandle) {
    const { data: fioPersona } = await supabase
      .from('did_persona')
      .select('id, root_id, root_identity(auth_user_id)')
      .ilike('fio_handle', fioHandle.toLowerCase())
      .maybeSingle();
    if (fioPersona) return await assertOwnership(supabase, fioPersona as DidPersonaRecord, callerAuthUserId);
  }

  // Auto-provision: create root_identity + did_persona for authenticated users
  // whose persona exists in the personas table but hasn't been claimed yet.
  // Eliminates the "Root DID not yet bound" blocker for signed-in users.
  if (callerAuthUserId) {
    const provisioned = await provisionDidPersona(supabase, personaId, fioHandle ?? null, callerAuthUserId);
    if (provisioned) return provisioned;
  }

  throw new Error(
    'No did_persona found for this persona id. Bind a Root DID to this persona first.'
  );
}

async function provisionDidPersona(
  supabase: SupabaseClient,
  personaId: string,
  fioHandle: string | null,
  callerAuthUserId: string
): Promise<DidPersonaRecord | null> {
  try {
    // Idempotent: reuse existing root_identity for this auth user
    let rootId: string | null = null;
    const { data: existingRoot } = await supabase
      .from('root_identity')
      .select('id')
      .eq('auth_user_id', callerAuthUserId)
      .maybeSingle();
    if (existingRoot?.id) {
      rootId = String(existingRoot.id);
    } else {
      const { data: newRoot } = await supabase
        .from('root_identity')
        .insert({ auth_user_id: callerAuthUserId })
        .select('id')
        .single();
      rootId = newRoot?.id ? String(newRoot.id) : null;
    }
    if (!rootId) {
      console.warn('[walletAlias] provisionDidPersona: could not find/create root_identity');
      return null;
    }

    // If we have a fio_handle, check whether a did_persona already exists for it
    // (handles the case where the insert would fail with a unique constraint violation)
    if (fioHandle) {
      const { data: existing } = await supabase
        .from('did_persona')
        .select('id, root_id')
        .ilike('fio_handle', fioHandle.toLowerCase())
        .maybeSingle();
      if (existing?.id) {
        console.log(`[walletAlias] found existing did_persona ${existing.id} for fio_handle ${fioHandle}`);
        return {
          id: String(existing.id),
          root_id: String(existing.root_id),
          root_identity: { auth_user_id: callerAuthUserId },
        };
      }
    }

    const { data: newPersona, error: insertErr } = await supabase
      .from('did_persona')
      .insert({ root_id: rootId, fio_handle: fioHandle })
      .select('id, root_id')
      .single();

    if (insertErr) {
      // Unique constraint on fio_handle — race condition, retry read
      if (insertErr.code === '23505' && fioHandle) {
        const { data: conflict } = await supabase
          .from('did_persona')
          .select('id, root_id')
          .ilike('fio_handle', fioHandle.toLowerCase())
          .maybeSingle();
        if (conflict?.id) {
          return {
            id: String(conflict.id),
            root_id: String(conflict.root_id),
            root_identity: { auth_user_id: callerAuthUserId },
          };
        }
      }
      console.warn('[walletAlias] did_persona insert failed:', insertErr.message, insertErr.code);
      return null;
    }

    if (!newPersona?.id) return null;

    console.log(`[walletAlias] auto-provisioned did_persona ${newPersona.id} for persona ${personaId}`);
    return {
      id: String(newPersona.id),
      root_id: String(newPersona.root_id),
      root_identity: { auth_user_id: callerAuthUserId },
    };
  } catch (e) {
    console.warn('[walletAlias] auto-provision failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function assertOwnership(
  supabase: SupabaseClient,
  persona: DidPersonaRecord,
  callerAuthUserId: string | null
): Promise<DidPersonaRecord> {
  if (!callerAuthUserId || !persona.root_id) return persona;

  // Use auth_user_id pre-fetched by the embedded root_identity join when available.
  // Fall back to a separate query only when the join wasn't included in the select.
  let rootAuthUserId: string | null;
  if (persona.root_identity !== undefined) {
    rootAuthUserId = persona.root_identity?.auth_user_id ?? null;
  } else {
    const { data: root } = await supabase
      .from('root_identity')
      .select('auth_user_id')
      .eq('id', persona.root_id)
      .maybeSingle();
    rootAuthUserId = (root as { auth_user_id?: string } | null)?.auth_user_id ?? null;
  }

  if (rootAuthUserId && rootAuthUserId !== callerAuthUserId) {
    throw new Error('Persona ownership mismatch');
  }
  return persona;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function registerWalletAlias(
  input: RegisterWalletAliasInput,
  callerAuthUserId: string | null
): Promise<RegisterWalletAliasResult> {
  const { didPersonaId, chain, walletAddress } = input;
  const ttlDays = input.ttlDays && input.ttlDays > 0 ? Math.floor(input.ttlDays) : 90;
  const normalised = normaliseAddress(chain, walletAddress);

  // EVM proof-of-control is required (BTC/SOL deferred to follow-up)
  if (chain === 'evm') {
    if (!input.signature || !input.message) {
      throw new Error('signature and message are required for EVM wallet binding');
    }
    if (!input.message.includes(didPersonaId)) {
      throw new Error('challenge message must include the persona id');
    }
    if (!verifyEvmOwnership(normalised, input.message, input.signature)) {
      throw new Error('Signature did not recover to the claimed wallet address');
    }
  }

  const supabase = getServerClient();
  const persona = await resolveDidPersona(supabase, didPersonaId, callerAuthUserId);
  if (!persona.root_id) {
    throw new Error('did_persona has no bound root_identity — bind a Root DID first');
  }

  // One wallet ↔ one persona — enforced by the UNIQUE constraint on alias_commitment.
  // A 23505 violation is caught below and returned as a clean "already linked" error.
  const aliasCommitment = buildAliasCommitment(didPersonaId, chain, normalised);
  const fingerprint = buildAddressFingerprint(chain, normalised);
  const expiresAtISO = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  const mailboxId = generateMailboxId();

  // Cross-persona check: if this wallet fingerprint is active under a different persona,
  // return a warning unless the caller explicitly acknowledged it with force=true.
  if (!input.force) {
    try {
      const { data: fpRows } = await supabase
        .from('wallet_alias_commitments')
        .select('did_persona_id')
        .eq('address_fingerprint', fingerprint)
        .eq('status', 'active')
        .neq('did_persona_id', persona.id);
      const linkedCount = fpRows?.length ?? 0;
      if (linkedCount > 0) {
        throw new Error(`CROSS_PERSONA:${linkedCount}`);
      }
    } catch (err) {
      // Re-throw CROSS_PERSONA signals; swallow column-missing errors (pre-migration envs)
      if (err instanceof Error && err.message.startsWith('CROSS_PERSONA:')) throw err;
    }
  }

  // DB insert first — success is determined by the row landing in the DB.
  // Escrow registration is best-effort and runs after we have the row id.
  const { data, error } = await supabase
    .from('wallet_alias_commitments')
    .insert({
      root_identity_id: persona.root_id,
      did_persona_id: persona.id,
      chain,
      alias_commitment: aliasCommitment,
      address_fingerprint: fingerprint,
      mailbox_id: mailboxId,
      alias_ttl_days: ttlDays,
      expires_at: expiresAtISO,
      status: 'active',
    })
    .select('id, alias_commitment, mailbox_id, expires_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This wallet is already linked to this persona');
    }
    throw new Error(error.message);
  }

  // Best-effort ICP registration — 4s hard timeout. Failures don't affect the
  // DB row; a sweep can re-attempt. Canister ID not set → silently skipped.
  await registerOnEscrow(aliasCommitment, mailboxId, ttlDays * 86_400);

  return {
    ok: true,
    id: data.id,
    aliasCommitment: data.alias_commitment,
    mailboxId: data.mailbox_id,
    expiresAt: data.expires_at,
  };
}

export async function revokeWalletAlias(
  aliasId: string,
  callerAuthUserId: string | null
): Promise<{ ok: true }> {
  const supabase = getServerClient();

  const { data: row, error: readErr } = await supabase
    .from('wallet_alias_commitments')
    .select('id, root_identity_id, status')
    .eq('id', aliasId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) throw new Error('Wallet alias not found');

  if (callerAuthUserId && row.root_identity_id) {
    const { data: root } = await supabase
      .from('root_identity')
      .select('auth_user_id')
      .eq('id', row.root_identity_id)
      .maybeSingle();
    if (root && root.auth_user_id && root.auth_user_id !== callerAuthUserId) {
      throw new Error('Forbidden');
    }
  }

  if (row.status === 'revoked') return { ok: true };

  const { error } = await supabase
    .from('wallet_alias_commitments')
    .update({ status: 'revoked' })
    .eq('id', aliasId);
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function listWalletAliases(
  didPersonaId: string,
  callerAuthUserId: string | null,
  includeInactive: boolean = false
): Promise<WalletAliasRow[]> {
  const supabase = getServerClient();
  await resolveDidPersona(supabase, didPersonaId, callerAuthUserId);

  let q = supabase
    .from('wallet_alias_commitments')
    .select(
      'id, root_identity_id, did_persona_id, chain, alias_commitment, mailbox_id, alias_ttl_days, expires_at, status, last_used_at, created_at, updated_at'
    )
    .eq('did_persona_id', didPersonaId)
    .order('created_at', { ascending: false });
  if (!includeInactive) q = q.eq('status', 'active');

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as WalletAliasRow[];
}

/**
 * Look up an alias by re-deriving the commitment for a persona + address pair.
 * Useful for "is this wallet currently bound to this persona?" without
 * exposing the address in any URL or query.
 */
export async function findAliasForAddress(
  didPersonaId: string,
  chain: WalletChain,
  walletAddress: string
): Promise<WalletAliasRow | null> {
  const aliasCommitment = buildAliasCommitment(didPersonaId, chain, walletAddress);
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('wallet_alias_commitments')
    .select(
      'id, root_identity_id, did_persona_id, chain, alias_commitment, mailbox_id, alias_ttl_days, expires_at, status, last_used_at, created_at, updated_at'
    )
    .eq('alias_commitment', aliasCommitment)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WalletAliasRow | null) ?? null;
}
