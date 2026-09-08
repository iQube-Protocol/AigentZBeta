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
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

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
  /** When supplied, a genuinely new or reactivated binding emits the
   *  `bankr_provider_bound` receipt attributed to this persona. Optional —
   *  a caller with no accountable actor (or a routine idempotent refresh
   *  of an already-active binding) emits no receipt, never a fabricated one. */
  actorPersonaId?: string;
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

  // A binding is newly ESTABLISHED (worth a `bankr_provider_bound` receipt)
  // exactly when it did not exist before, or existed but was not 'active' —
  // never on a routine idempotent refresh of an already-active binding
  // (the existing insert/update above already re-resolves the canonical
  // addresses every call; that alone is not a new binding event).
  const isNewOrReactivated = !existing || existing.status !== 'active';

  if (existing) {
    const { data, error } = await admin
      .from('provider_wallet_bindings')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`provisionProviderWalletBinding update failed: ${error.message}`);
    if (input.actorPersonaId && isNewOrReactivated) {
      await createActivityReceipt({
        personaId: input.actorPersonaId,
        activeCartridge: 'moneypenny',
        actionType: 'bankr_provider_bound',
        summary: `Bankr provider-wallet binding (re)established for ${input.agentRuntimeId} in tenant ${input.tenantId}`,
        agentsInvoked: [input.agentRuntimeId],
        actionInput: { tenantId: input.tenantId, agentRuntimeId: input.agentRuntimeId, provider: input.provider, bindingId: (data as ProviderWalletBindingRow).id },
      });
    }
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
  if (input.actorPersonaId) {
    await createActivityReceipt({
      personaId: input.actorPersonaId,
      activeCartridge: 'moneypenny',
      actionType: 'bankr_provider_bound',
      summary: `Bankr provider-wallet binding established for ${input.agentRuntimeId} in tenant ${input.tenantId}`,
      agentsInvoked: [input.agentRuntimeId],
      actionInput: { tenantId: input.tenantId, agentRuntimeId: input.agentRuntimeId, provider: input.provider, bindingId: (data as ProviderWalletBindingRow).id },
    });
  }
  return data as ProviderWalletBindingRow;
}

/**
 * Effective binding state — the ONE derivation every consumer (readiness
 * projections, receipts, UI surfaces) must use instead of reading
 * `binding.status` alone (2026-09-08 correction). `status` is a LIFECYCLE
 * value only (`active` vs `revoked`, per the schema's own CHECK constraint —
 * there is no third lifecycle value); it says nothing about whether the
 * binding was ever actually verified against a real provider account.
 * `verification_evidence.simulated`/`verified` is the SEPARATE, orthogonal
 * fact this function folds in: a binding can be lifecycle-`active` and
 * simultaneously carry zero real provider verification (e.g. one inserted
 * by a rehearsal, or simply provisioned while Bankr is unconfigured).
 * Never displayed/reported as "Active" alone when this returns
 * 'active-simulated' — that reads as a confirmed real provider relationship
 * when none exists.
 */
export type ProviderWalletBindingEffectiveState = 'none' | 'active-verified' | 'active-simulated' | 'revoked';

export function deriveBindingEffectiveState(binding: ProviderWalletBindingRow | null): ProviderWalletBindingEffectiveState {
  if (!binding) return 'none';
  if (binding.status === 'revoked') return 'revoked';
  const evidence = binding.verification_evidence as { verified?: boolean; simulated?: boolean } | null;
  const simulated = evidence?.simulated === true || evidence?.verified !== true;
  return simulated ? 'active-simulated' : 'active-verified';
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
