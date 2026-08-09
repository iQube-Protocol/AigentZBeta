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

export class AgentPurposeWalletService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    this.supabase = initAgentiqClient({ supabaseUrl, supabaseAnonKey: supabaseKey }).supabase;
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
  }): Promise<{ ok: true; binding: AgentWalletBinding; created: boolean } | { ok: false; refusalCode: 'ROLE_NOT_PROVISIONABLE'; detail: string }> {
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
}
