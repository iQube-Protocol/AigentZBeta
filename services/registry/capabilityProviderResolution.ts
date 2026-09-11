/**
 * Capability provider resolution — "who currently provides capability X" —
 * the concrete seam realizing the design doc's "Agent Bench is the registry
 * of governed capability providers" reframing (§3 of
 * codexes/packs/agentiq/updates/2026-08-06_governed-capability-invocation-design.md).
 *
 * This is a FILTER over the same read model Agent Bench itself renders
 * (`services/marketa/activation/agentBenchReadModel.ts::buildAgentBenchRow`)
 * — never a parallel provider store. Today it returns at most one row (Aigent
 * Nakamoto, for `bitcoin_decentralisation_expertise`); returning more than
 * one later needs no caller-visible change here, only a selection policy in
 * whatever calls this (out of scope for this phase — see the design doc's
 * scope note).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listRegistrableAgents, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { buildAgentBenchRow, type AgentBenchRow } from '@/services/marketa/activation/agentBenchReadModel';

export interface ResolvedCapabilityProvider {
  capabilityId: string;
  providerAgentId: string;
  registryAssetId: string;
  runtimeMembershipRef: string;
  benchRow: AgentBenchRow;
}

/** Lifecycle states eligible to provide a capability at all — a candidate or invited row has no runtime to call. */
const ELIGIBLE_LIFECYCLE_STATES = new Set(['service-ready', 'engaged']);

function rowProvidesCapability(row: AgentBenchRow, capabilityId: string): boolean {
  const needle = capabilityId.trim().toLowerCase();
  return row.capabilityDescriptors.some((d) => d.name.trim().toLowerCase() === needle);
}

/**
 * Resolve every eligible provider of `capabilityId` right now. Registrable
 * agents only (§3 — the same set Agent Bench itself draws its
 * registrable-agent rows from); Marketa-only candidates with no registrable
 * link have no runtime to invoke, so they are excluded from provider
 * resolution the same way Agent Bench's own Service Ready condition already
 * excludes them.
 */
export async function resolveCapabilityProviders(
  capabilityId: string,
  admin?: SupabaseClient,
): Promise<ResolvedCapabilityProvider[]> {
  const supabase = admin ?? getSupabaseServer();
  if (!supabase) return [];

  const agents: RegistrableAgentConfig[] = listRegistrableAgents();
  const rows = await Promise.all(
    agents.map(async (agent) => ({
      agent,
      row: await buildAgentBenchRow(supabase, { kind: 'registrable-agent', agent }, { hasInvitation: false }).catch(() => null),
    })),
  );

  const resolved: ResolvedCapabilityProvider[] = [];
  for (const { agent, row } of rows) {
    if (!row) continue;
    if (!ELIGIBLE_LIFECYCLE_STATES.has(row.lifecycleState)) continue;
    if (!rowProvidesCapability(row, capabilityId)) continue;
    const membership = row.runtimeMemberships.find((m) => m.status === 'approved' || m.status === 'active');
    if (!membership) continue;
    resolved.push({
      capabilityId,
      providerAgentId: row.candidateId, // === agent.runtimeAgentId for a registrable-agent row
      registryAssetId: agent.aigentQubeId, // registry_assets.asset_id — the real FK target, never the runtime agent id
      runtimeMembershipRef: membership.runtimeId,
      benchRow: row,
    });
  }
  return resolved;
}

/**
 * Convenience for the common single-provider path (this phase's scope —
 * exactly one provider per capability). Returns null, never a fabricated
 * pick, when zero or more than one provider resolves — a caller that needs
 * to disambiguate among several is a future selection-policy phase, not
 * this one.
 */
export async function resolveSingleCapabilityProvider(
  capabilityId: string,
  admin?: SupabaseClient,
): Promise<ResolvedCapabilityProvider | null> {
  const providers = await resolveCapabilityProviders(capabilityId, admin);
  return providers.length === 1 ? providers[0] : null;
}
