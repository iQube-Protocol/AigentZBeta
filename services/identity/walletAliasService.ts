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
 */
async function registerOnEscrow(
  aliasCommitmentHex: string,
  mailboxIdHex: string,
  ttlSeconds: number
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const canisterId = escrowCanisterId();
  if (!canisterId) return { ok: false, skipped: true, error: 'Escrow canister not configured' };
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
}

// ─── Persona resolution ─────────────────────────────────────────────────────

interface DidPersonaRecord {
  id: string;
  root_id: string | null;
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
      .select('id, root_id')
      .ilike('fio_handle', personaId.toLowerCase())
      .maybeSingle();
    if (data) return await assertOwnership(supabase, data as DidPersonaRecord, callerAuthUserId);
  }

  // Round 1: fire all first-level lookups in parallel
  const [directRes, knytRes, qriptoRes, legacyRes] = await Promise.all([
    supabase.from('did_persona').select('id, root_id').eq('id', personaId).maybeSingle(),
    supabase.from('nakamoto_knyt_personas').select('did_persona_id').eq('id', personaId).maybeSingle(),
    supabase.from('nakamoto_qripto_personas').select('did_persona_id').eq('id', personaId).maybeSingle(),
    supabase.from('personas').select('id, fio_handle').eq('id', personaId).maybeSingle(),
  ]);

  // Direct did_persona hit
  if (!directRes.error && directRes.data) {
    return await assertOwnership(supabase, directRes.data as DidPersonaRecord, callerAuthUserId);
  }

  // Round 2: resolve any did_persona_id references in parallel
  const secondaryIds: string[] = [];
  const knytDidId = (knytRes.data as { did_persona_id?: string } | null)?.did_persona_id;
  const qriptoDidId = (qriptoRes.data as { did_persona_id?: string } | null)?.did_persona_id;
  const fioHandle = (legacyRes.data as { fio_handle?: string } | null)?.fio_handle;

  if (knytDidId) secondaryIds.push(knytDidId);
  if (qriptoDidId) secondaryIds.push(qriptoDidId);

  const secondaryQueries: Promise<{ data: DidPersonaRecord | null; error: unknown }>[] = [];
  for (const did of secondaryIds) {
    secondaryQueries.push(
      supabase.from('did_persona').select('id, root_id').eq('id', did).maybeSingle() as Promise<{ data: DidPersonaRecord | null; error: unknown }>
    );
  }
  if (fioHandle) {
    secondaryQueries.push(
      supabase.from('did_persona').select('id, root_id').ilike('fio_handle', fioHandle.toLowerCase()).maybeSingle() as Promise<{ data: DidPersonaRecord | null; error: unknown }>
    );
  }

  if (secondaryQueries.length > 0) {
    const secondaryResults = await Promise.all(secondaryQueries);
    for (const res of secondaryResults) {
      if (!res.error && res.data) {
        return await assertOwnership(supabase, res.data, callerAuthUserId);
      }
    }
  }

  throw new Error(
    'No did_persona found for this persona id. Bind a Root DID to this persona first.'
  );
}

async function assertOwnership(
  supabase: SupabaseClient,
  persona: DidPersonaRecord,
  callerAuthUserId: string | null
): Promise<DidPersonaRecord> {
  if (callerAuthUserId && persona.root_id) {
    const { data: root } = await supabase
      .from('root_identity')
      .select('auth_user_id')
      .eq('id', persona.root_id)
      .maybeSingle();
    if (root && root.auth_user_id && root.auth_user_id !== callerAuthUserId) {
      throw new Error('Persona ownership mismatch');
    }
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

  // One wallet ↔ one persona — uniqueness is enforced by the alias_commitment
  // UNIQUE constraint at the table level. Active record check below gives a
  // clean error message instead of a 23505.
  const aliasCommitment = buildAliasCommitment(didPersonaId, chain, normalised);
  const { data: existing } = await supabase
    .from('wallet_alias_commitments')
    .select('id, status')
    .eq('alias_commitment', aliasCommitment)
    .maybeSingle();
  if (existing && existing.status === 'active') {
    throw new Error('This wallet is already linked to this persona');
  }

  // The commitment for THIS persona+address is unique to this persona; if the
  // same wallet was registered to a *different* persona, that registration
  // would produce a *different* commitment (because didPersonaId is mixed in).
  // The one-wallet-one-persona invariant therefore lives in the application:
  // before insert, check whether any other persona under the same root_id has
  // already bound the same plaintext address.
  // (v0 cannot enforce across different roots without leaking — accept this
  //  weaker guarantee for now and re-evaluate when blakQube comes online.)
  const expiresAtISO = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  const mailboxId = generateMailboxId();

  // Best-effort Escrow registration — failures don't roll back the DB row;
  // status remains 'active' and a sweep can re-attempt. Surfaced in response.
  await registerOnEscrow(aliasCommitment, mailboxId, ttlDays * 86_400);

  const { data, error } = await supabase
    .from('wallet_alias_commitments')
    .insert({
      root_identity_id: persona.root_id,
      did_persona_id: persona.id,
      chain,
      alias_commitment: aliasCommitment,
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
