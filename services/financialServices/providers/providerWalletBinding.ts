/**
 * Provider-wallet binding — generic, tenant-scoped model for "which
 * external provider is this agent's wallet bound to" (Factor + Aegis Bankr
 * PRD, Phase 3). Bankr is the first real provider; the schema and this
 * service are provider-neutral by construction (a future second provider
 * adds a CHECK-constraint value and a provider-side identifier set, never a
 * second binding table).
 *
 * CRITICAL INVARIANT — never overwrite Factor's canonical MetaMe addresses:
 * `metameOwnerWalletAddress`/`metameSettlementWalletAddress` are RESOLVED
 * here by reading `agent_keys`/`agent_wallet_bindings` (via
 * `AgentPurposeWalletService`) — they are never accepted as caller input.
 * A caller cannot pass an arbitrary address into this table pretending it
 * is the agent's owner/settlement wallet; the only way those fields get a
 * value is by this module reading the real, already-provisioned wallet.
 *
 * Server-side only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { AgentPurposeWalletService } from '@/services/wallet/agentPurposeWalletService';

export type ProviderName = 'bankr';

export interface ProviderWalletBindingRow {
  id: string;
  tenant_id: string;
  agent_runtime_id: string;
  provider: ProviderName;
  metame_owner_wallet_address: string;
  metame_settlement_wallet_address: string | null;
  provider_org_id: string | null;
  provider_wallet_address: string | null;
  provider_external_profile_id: string | null;
  allowed_capabilities: string[];
  status: 'active' | 'revoked';
  non_secret_credential_ref: string | null;
  verification_evidence: Record<string, unknown> | null;
  created_at: string;
  revoked_at: string | null;
  updated_at: string;
}

export class ProviderWalletBindingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderWalletBindingError';
  }
}

/** Injectable so tests never need a real Supabase-backed AgentPurposeWalletService. */
export interface CanonicalWalletResolver {
  getOwnerWalletAddress(runtimeAgentId: string): Promise<string | null>;
  getSettlementWalletAddress(runtimeAgentId: string): Promise<string | null>;
}

export function defaultCanonicalWalletResolver(): CanonicalWalletResolver {
  const service = new AgentPurposeWalletService();
  return {
    getOwnerWalletAddress: (runtimeAgentId) => service.getOwnerWalletAddress(runtimeAgentId),
    getSettlementWalletAddress: async (runtimeAgentId) => {
      const binding = await service.getBinding(runtimeAgentId, 'settlement');
      return binding?.address ?? null;
    },
  };
}

export interface ProvisionProviderWalletBindingInput {
  tenantId: string;
  agentRuntimeId: string;
  provider: ProviderName;
  providerOrgId?: string | null;
  providerWalletAddress?: string | null;
  providerExternalProfileId?: string | null;
  allowedCapabilities?: string[];
  nonSecretCredentialRef?: string | null;
  verificationEvidence?: Record<string, unknown> | null;
}

/**
 * Idempotent create-or-return: a second call with the same
 * (tenantId, agentRuntimeId, provider) returns the EXISTING row (upserted
 * with any newly-supplied provider-side fields), never a duplicate. Refuses
 * outright when the agent has no canonical owner wallet yet — this binding
 * can only ever REFERENCE a real, already-provisioned MetaMe wallet, never
 * imply one into existence.
 */
export async function provisionProviderWalletBinding(
  admin: SupabaseClient,
  input: ProvisionProviderWalletBindingInput,
  resolver: CanonicalWalletResolver = defaultCanonicalWalletResolver(),
): Promise<ProviderWalletBindingRow> {
  const ownerAddress = await resolver.getOwnerWalletAddress(input.agentRuntimeId);
  if (!ownerAddress) {
    throw new ProviderWalletBindingError(
      'no-canonical-owner-wallet',
      `Cannot bind ${input.agentRuntimeId} to provider '${input.provider}': no canonical MetaMe owner wallet exists yet. ` +
        'Provision the owner wallet first (services/wallet/agentPurposeWalletService.ts) — this module never invents one.',
    );
  }
  const settlementAddress = await resolver.getSettlementWalletAddress(input.agentRuntimeId);

  const { data: existing, error: readErr } = await admin
    .from('provider_wallet_bindings')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('agent_runtime_id', input.agentRuntimeId)
    .eq('provider', input.provider)
    .maybeSingle();
  if (readErr) throw new Error(`provisionProviderWalletBinding read failed: ${readErr.message}`);

  const row = {
    tenant_id: input.tenantId,
    agent_runtime_id: input.agentRuntimeId,
    provider: input.provider,
    // Always the FRESH read of the canonical addresses — never the
    // previously-stored value, so a wallet rotation is reflected on the
    // next provisioning call rather than silently going stale.
    metame_owner_wallet_address: ownerAddress,
    metame_settlement_wallet_address: settlementAddress,
    provider_org_id: input.providerOrgId ?? (existing?.provider_org_id ?? null),
    provider_wallet_address: input.providerWalletAddress ?? (existing?.provider_wallet_address ?? null),
    provider_external_profile_id: input.providerExternalProfileId ?? (existing?.provider_external_profile_id ?? null),
    allowed_capabilities: input.allowedCapabilities ?? (existing?.allowed_capabilities ?? []),
    non_secret_credential_ref: input.nonSecretCredentialRef ?? (existing?.non_secret_credential_ref ?? null),
    verification_evidence: input.verificationEvidence ?? (existing?.verification_evidence ?? null),
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await admin
      .from('provider_wallet_bindings')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`provisionProviderWalletBinding update failed: ${error.message}`);
    return data as ProviderWalletBindingRow;
  }

  const { data, error } = await admin
    .from('provider_wallet_bindings')
    .insert({ id: randomUUID(), created_at: new Date().toISOString(), ...row })
    .select('*')
    .single();
  if (error) {
    // A concurrent caller may have won the unique-constraint race — re-read
    // and return that row rather than failing the second, equally-valid
    // provisioning attempt.
    if ((error as { code?: string }).code === '23505') {
      const { data: raceWinner, error: raceErr } = await admin
        .from('provider_wallet_bindings')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('agent_runtime_id', input.agentRuntimeId)
        .eq('provider', input.provider)
        .single();
      if (raceErr) throw new Error(`provisionProviderWalletBinding race-recovery read failed: ${raceErr.message}`);
      return raceWinner as ProviderWalletBindingRow;
    }
    throw new Error(`provisionProviderWalletBinding insert failed: ${error.message}`);
  }
  return data as ProviderWalletBindingRow;
}

export async function getProviderWalletBinding(
  admin: SupabaseClient,
  tenantId: string,
  agentRuntimeId: string,
  provider: ProviderName,
): Promise<ProviderWalletBindingRow | null> {
  const { data, error } = await admin
    .from('provider_wallet_bindings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('agent_runtime_id', agentRuntimeId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw new Error(`getProviderWalletBinding failed: ${error.message}`);
  return (data as ProviderWalletBindingRow) ?? null;
}

/** Immediate — status flips to 'revoked' on the next read; the row is never deleted (history preserved). */
export async function revokeProviderWalletBinding(
  admin: SupabaseClient,
  tenantId: string,
  agentRuntimeId: string,
  provider: ProviderName,
): Promise<void> {
  const { error } = await admin
    .from('provider_wallet_bindings')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('agent_runtime_id', agentRuntimeId)
    .eq('provider', provider);
  if (error) throw new Error(`revokeProviderWalletBinding failed: ${error.message}`);
}
