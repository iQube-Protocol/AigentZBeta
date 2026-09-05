/**
 * Agent purpose-bound wallet bindings (operator directive, 2026-08-09 —
 * Horizen Pilot Closure part 2: "Authorize a dedicated Nakamoto trading
 * wallet").
 *
 * ── Why this exists, and what it is not ─────────────────────────────────────
 *
 * `agent_keys` / `AgentKeyService` is — and remains — the ONE canonical
 * agent-control / ERC-8004 owner-wallet custody path, keyed by
 * `runtimeAgentId` alone (see registrableAgents.ts's own doctrine). This
 * module never overwrites, expands, or reinterprets that row.
 *
 * Horizen's Verifiable-PnL service requires a wallet distinct from the
 * owner wallet for trading/PnL disclosure. Before this module existed, no
 * generic structure in this codebase could name a second, purpose-bound
 * wallet for an agent — every existing "wallet role" concept found in a
 * repo-wide search (SmartWalletNode, linked_external_wallets,
 * signing_requests' `wallet_ref`) was either persona-scoped, zero-key
 * (execution-instrument only), or assumed one wallet per agent outright.
 * `agent_wallet_bindings` (migration 20260930001300) is the smallest
 * generic table that fills that gap: one row per (agent_runtime_id,
 * wallet_role), extensible to 'settlement' / 'treasury' later without
 * touching this shape.
 *
 * ── Custody, concretely ──────────────────────────────────────────────────────
 *
 * The private key for a purpose wallet is stored through the EXACT SAME
 * AgentKeyService AES-256-CBC mechanism the canonical owner wallet uses —
 * just under a distinct, namespaced `agent_keys.agent_id` (the
 * `custody_ref`) that can never collide with a real runtimeAgentId. This
 * table never holds key material; it holds the public address and the
 * pointer to where the key lives.
 */

import { ethers } from 'ethers';
import { randomUUID } from 'crypto';
import { initAgentiqClient } from '@/services/core/agentiqClient';

export type AgentWalletRole = 'owner' | 'trading' | 'settlement' | 'treasury';

export interface AgentWalletBinding {
  id: string;
  agentRuntimeId: string;
  walletRole: AgentWalletRole;
  address: string;
  network: string;
  chainId: number | null;
  custodyRef: string;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
}

/**
 * `owner` deliberately excluded — the owner wallet's custody path is
 * `agent_keys` addressed directly by `runtimeAgentId`; provisioning it
 * through this table would create the exact second, parallel
 * owner-wallet path the operator ruled out (Part 2/6, 2026-08-09).
 */
const PROVISIONABLE_ROLES: ReadonlySet<AgentWalletRole> = new Set(['trading', 'settlement', 'treasury']);

/**
 * Namespaced so this string can never collide with a real
 * `agent_keys.agent_id` (which are always bare runtimeAgentIds like
 * `aigent-nakamoto`, with no `::` in them anywhere in this codebase).
 */
export function deriveWalletCustodyRef(agentRuntimeId: string, walletRole: AgentWalletRole): string {
  return `${agentRuntimeId}::wallet::${walletRole}`;
}

function rowToBinding(row: Record<string, any>): AgentWalletBinding {
  return {
    id: row.id,
    agentRuntimeId: row.agent_runtime_id,
    walletRole: row.wallet_role,
    address: row.address,
    network: row.network,
    chainId: row.chain_id ?? null,
    custodyRef: row.custody_ref,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The exact insecure fallback AgentKeyService's own constructor still
 *  carries (services/identity/agentKeyService.ts) — checked here so this
 *  service can refuse BEFORE ever calling into AgentKeyService, rather
 *  than relying on that class's own (still-silent) default. Never used as
 *  a value; only compared against. */
const AGENT_KEY_ENCRYPTION_INSECURE_DEFAULT = 'default-insecure-key-change-in-production-32bytes';

export type WalletProvisionRefusalCode =
  | 'ROLE_NOT_PROVISIONABLE'
  | 'SUPABASE_SERVICE_ROLE_KEY_MISSING'
  | 'AGENT_KEY_ENCRYPTION_SECRET_MISSING'
  | 'AGENT_KEY_ENCRYPTION_SECRET_INSECURE_DEFAULT';

export class AgentPurposeWalletService {
  private supabase;

  /**
   * FAIL CLOSED (operator security correction, 2026-09-05): requires
   * SUPABASE_SERVICE_ROLE_KEY specifically — never falls back to an anon
   * key the way this constructor (and AgentKeyService's own) previously
   * did. A wallet-custody service running under an anon key would either
   * error opaquely against service-role-only RLS or, worse, silently
   * degrade — neither is acceptable for a class that generates and stores
   * private keys.
   */
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'AgentPurposeWalletService requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. ' +
          'This service never falls back to an anon key.',
      );
    }
    this.supabase = initAgentiqClient({ supabaseUrl, supabaseAnonKey: supabaseKey }).supabase;
  }

  /** Fail-closed check every wallet-generating method runs before touching
   *  AgentKeyService — refuses if the real secret is absent OR equals the
   *  known insecure default, so a misconfigured environment never silently
   *  encrypts a fresh private key with a hardcoded, source-visible value. */
  private static assertEncryptionSecretConfigured(): { ok: true } | { ok: false; refusalCode: WalletProvisionRefusalCode; detail: string } {
    const secret = process.env.AGENT_KEY_ENCRYPTION_SECRET;
    if (!secret) {
      return {
        ok: false,
        refusalCode: 'AGENT_KEY_ENCRYPTION_SECRET_MISSING',
        detail: 'AGENT_KEY_ENCRYPTION_SECRET is not set. Refusing to generate a wallet rather than fall back to AgentKeyService\'s insecure default.',
      };
    }
    if (secret === AGENT_KEY_ENCRYPTION_INSECURE_DEFAULT) {
      return {
        ok: false,
        refusalCode: 'AGENT_KEY_ENCRYPTION_SECRET_INSECURE_DEFAULT',
        detail: 'AGENT_KEY_ENCRYPTION_SECRET is set to the known insecure default value. Refusing to generate a wallet.',
      };
    }
    return { ok: true };
  }

  /** Never fabricates — returns null when no binding has been provisioned for this (agent, role). */
  async getBinding(agentRuntimeId: string, walletRole: AgentWalletRole): Promise<AgentWalletBinding | null> {
    const { data, error } = await this.supabase
      .from('agent_wallet_bindings')
      .select('*')
      .eq('agent_runtime_id', agentRuntimeId)
      .eq('wallet_role', walletRole)
      .maybeSingle();

    if (error || !data) return null;
    return rowToBinding(data);
  }

  async getBindingByAddress(address: string): Promise<AgentWalletBinding | null> {
    const { data, error } = await this.supabase
      .from('agent_wallet_bindings')
      .select('*')
      .ilike('address', address)
      .maybeSingle();

    if (error || !data) return null;
    return rowToBinding(data);
  }

  /**
   * Provision a purpose-bound wallet for an agent, or return the existing
   * one if already provisioned — idempotent, never regenerates a wallet
   * that already exists. Refuses 'owner' outright (see PROVISIONABLE_ROLES).
   *
   * Generates a fresh random EVM keypair, stores the private key via the
   * EXISTING AgentKeyService mechanism under a derived, namespaced
   * custody_ref (never touching the agent's real owner-wallet row), then
   * records the public address + role binding here. Never returns the
   * private key.
   */
  async provisionPurposeWallet(input: {
    agentRuntimeId: string;
    walletRole: AgentWalletRole;
    network: string;
    chainId?: number;
  }): Promise<{ ok: true; binding: AgentWalletBinding; created: boolean } | { ok: false; refusalCode: WalletProvisionRefusalCode; detail: string }> {
    if (!PROVISIONABLE_ROLES.has(input.walletRole)) {
      return {
        ok: false,
        refusalCode: 'ROLE_NOT_PROVISIONABLE',
        detail:
          `'${input.walletRole}' wallets are not provisioned through agent_wallet_bindings. The owner/control ` +
          'wallet lives solely in agent_keys, addressed directly by runtimeAgentId — provisioning it here would ' +
          'create a second, parallel owner-wallet path.',
      };
    }

    const existing = await this.getBinding(input.agentRuntimeId, input.walletRole);
    if (existing) {
      return { ok: true, binding: existing, created: false };
    }

    const secretCheck = AgentPurposeWalletService.assertEncryptionSecretConfigured();
    if (!secretCheck.ok) return secretCheck;

    const custodyRef = deriveWalletCustodyRef(input.agentRuntimeId, input.walletRole);
    const wallet = ethers.Wallet.createRandom();

    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    await new AgentKeyService().storeAgentKeys({
      agentId: custodyRef,
      agentName: `${input.agentRuntimeId} (${input.walletRole} wallet)`,
      evmPrivateKey: wallet.privateKey,
      evmAddress: wallet.address,
    });

    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('agent_wallet_bindings')
      .insert({
        id: randomUUID(),
        agent_runtime_id: input.agentRuntimeId,
        wallet_role: input.walletRole,
        address: wallet.address,
        network: input.network,
        chain_id: input.chainId ?? null,
        custody_ref: custodyRef,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to persist agent_wallet_bindings row for ${input.agentRuntimeId}/${input.walletRole}: ${error?.message}`);
    }

    return { ok: true, binding: rowToBinding(data), created: true };
  }

  /**
   * Resolve the private key for a purpose wallet via its custody_ref —
   * NEVER exposed to any client, server-side only, mirroring
   * AgentKeyService.getAgentKeys' own custody boundary.
   */
  async resolvePurposeWalletPrivateKey(agentRuntimeId: string, walletRole: AgentWalletRole): Promise<string | null> {
    const binding = await this.getBinding(agentRuntimeId, walletRole);
    if (!binding) return null;
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const keys = await new AgentKeyService().getAgentKeys(binding.custodyRef);
    return keys?.evmPrivateKey ?? null;
  }

  /**
   * Same resolution, keyed by the wallet's own address rather than
   * (agent, role) — the shape `PnlOnboardingDeps.resolveTradingWalletPrivateKey`
   * expects. Refuses (returns null) if the address doesn't match any
   * provisioned binding, rather than guessing which binding was meant.
   */
  async resolvePurposeWalletPrivateKeyByAddress(address: string): Promise<string | null> {
    const binding = await this.getBindingByAddress(address);
    if (!binding) return null;
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const keys = await new AgentKeyService().getAgentKeys(binding.custodyRef);
    return keys?.evmPrivateKey ?? null;
  }

  /**
   * The canonical OWNER/CONTROL wallet — the ONE `agent_keys` row addressed
   * directly by `runtimeAgentId` (never a `custody_ref`), used for Horizen
   * Register/Verify/Claim signing (operator directive, 2026-09-05 security
   * correction). This is the ONLY method in this codebase that may create
   * that row for a NEW agent — it never routes through
   * `agent_wallet_bindings` (see `PROVISIONABLE_ROLES`'s own exclusion of
   * `'owner'` above).
   *
   * Never fabricates addresses to fill BTC/Solana fields — no real,
   * reusable multi-chain provisioner exists in this codebase (verified
   * 2026-09-05: the only code that ever wrote btc_address/solana_address,
   * app/api/admin/register-multichain-keys/route.ts, derives them from a
   * sha256 hash, not a real keypair — those columns are left null here,
   * honestly, rather than repeating that pattern).
   */
  async getOwnerWalletAddress(runtimeAgentId: string): Promise<string | null> {
    const { data, error } = await this.supabase.from('agent_keys').select('evm_address').eq('agent_id', runtimeAgentId).maybeSingle();
    if (error || !data) return null;
    return (data as { evm_address: string | null }).evm_address ?? null;
  }

  /**
   * Provision the owner/control wallet, or return the existing one —
   * idempotent, NEVER rotates a key that already exists (checked BEFORE
   * any generation, mirroring `provisionPurposeWallet`'s own check-first
   * order). Returns ONLY the public address; the private key never leaves
   * `storeAgentKeys`' encrypted write.
   */
  async provisionOwnerWallet(input: {
    runtimeAgentId: string;
    agentName: string;
    fioHandle?: string;
  }): Promise<{ ok: true; address: string; created: boolean } | { ok: false; refusalCode: WalletProvisionRefusalCode; detail: string }> {
    const existing = await this.getOwnerWalletAddress(input.runtimeAgentId);
    if (existing) {
      return { ok: true, address: existing, created: false };
    }

    const secretCheck = AgentPurposeWalletService.assertEncryptionSecretConfigured();
    if (!secretCheck.ok) return secretCheck;

    const wallet = ethers.Wallet.createRandom();
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    await new AgentKeyService().storeAgentKeys({
      agentId: input.runtimeAgentId,
      agentName: input.agentName,
      fioHandle: input.fioHandle,
      entityType: 'agent',
      evmPrivateKey: wallet.privateKey,
      evmAddress: wallet.address,
      // btcAddress/solanaAddress intentionally omitted — left null. See
      // this method's own header note.
    });

    return { ok: true, address: wallet.address, created: true };
  }
}
