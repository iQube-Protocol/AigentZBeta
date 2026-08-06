/**
 * The three governed-capability-invocation gates + the loop/depth guard —
 * factored out of `invocationGateway.ts` for isolated testing, mirroring how
 * `evaluateSkillQubePolicy` is its own module rather than inlined in
 * `invokeAsset`. Design doc: codexes/packs/agentiq/updates/
 * 2026-08-06_governed-capability-invocation-design.md §4/§6 — every refusal
 * code and check below is that doc transcribed into code, not a fresh design.
 *
 * Gate order matters for which refusal code a caller sees FIRST, but capability
 * resolution (naming who the provider even is) has to happen before Gate 1
 * can check "is the provider admitted" — so `evaluateGates` resolves the
 * provider once at the top, then runs the checks in the documented order.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilityInvocation } from '@/types/capabilityInvocation';
import { resolveCapabilityProviders, type ResolvedCapabilityProvider } from './capabilityProviderResolution';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export type GateResult = { ok: true } | { ok: false; code: string; reason: string };

function refuse(code: string, reason: string): GateResult {
  return { ok: false, code, reason };
}
const OK: GateResult = { ok: true };

/**
 * First-phase depth limit (design doc §6): aigentMe/the requesting surface
 * is depth 0, an orchestrator→provider hop is depth 1. Fixed, not
 * caller-configurable, until a future phase has a real reason to widen it.
 */
export const FIRST_PHASE_MAX_INVOCATION_DEPTH = 2;

/**
 * §6 — loop/depth guard. Runs before any resolution work: a circular or
 * over-deep request should never even reach a DB call.
 */
export function evaluateLoopAndDepthGuard(req: CapabilityInvocation): GateResult {
  if (req.delegationDepth >= req.maxInvocationDepth) {
    return refuse('DEPTH_EXCEEDED', `delegationDepth ${req.delegationDepth} >= maxInvocationDepth ${req.maxInvocationDepth}`);
  }
  // The circular check needs the RESOLVED PROVIDER (invocationPath tracks
  // providers already invoked in this chain, not requesters) — it runs in
  // `invokeCapability` once resolution completes, not here.
  return OK;
}

/**
 * Capability resolution (the prerequisite Gate 2 performs before its own
 * eligibility checks — see the module header). Also enforces the
 * `targetAgentId` hint cross-check ("do not accept an unconstrained
 * arbitrary agent" — design doc §2).
 */
export async function resolveProviderForGates(
  req: CapabilityInvocation,
  admin?: SupabaseClient,
): Promise<{ provider: ResolvedCapabilityProvider } | { gate: GateResult }> {
  const providers = await resolveCapabilityProviders(req.capabilityId, admin ?? getSupabaseServer() ?? undefined);
  if (providers.length === 0) {
    return { gate: refuse('CAPABILITY_NOT_PROVIDED', `no eligible Service Ready/Engaged provider declares capability '${req.capabilityId}'`) };
  }
  // First phase never needs to disambiguate among several providers for one
  // capability (design doc scope note) — if more than one somehow resolves,
  // refuse rather than silently pick one; a selection policy is a future
  // phase's job, not an implicit default here.
  if (providers.length > 1) {
    return { gate: refuse('PROVIDER_AMBIGUOUS', `${providers.length} eligible providers resolved for '${req.capabilityId}'; no selection policy exists yet`) };
  }
  const provider = providers[0];
  if (req.targetAgentId && req.targetAgentId !== provider.providerAgentId) {
    return { gate: refuse('PROVIDER_MISMATCH', `targetAgentId hint '${req.targetAgentId}' does not match resolved provider '${provider.providerAgentId}'`) };
  }
  return { provider };
}

/**
 * Gate 1 — identity and authority (design doc §4). Requires the resolved
 * provider so it can check the provider's own admission independently of
 * the requester/orchestrator's.
 */
export async function evaluateIdentityAndAuthorityGate(
  req: CapabilityInvocation,
  provider: ResolvedCapabilityProvider,
  admin?: SupabaseClient,
): Promise<GateResult> {
  const supabase = admin ?? getSupabaseServer();
  if (!supabase) return refuse('DB_UNAVAILABLE', 'no database client available to resolve admission facts');

  if (!req.principalRef) {
    return refuse('PRINCIPAL_UNRESOLVED', 'principalRef is empty — the caller must resolve the active persona before constructing the envelope');
  }

  const requesterAgent = resolveRegistrableAgentByRuntimeId(req.requestingAgentId);
  if (!requesterAgent) {
    return refuse('UNKNOWN_AGENT', `requestingAgentId '${req.requestingAgentId}' is not a canonical registrable agent`);
  }

  if (req.orchestratorAgentId) {
    // Orchestrated pattern — MoneyPenny (this phase's only orchestrator).
    if (req.orchestratorAgentId !== req.requestingAgentId) {
      return refuse('ORCHESTRATOR_REQUESTER_MISMATCH', 'this phase requires orchestratorAgentId === requestingAgentId — a separated role split is a future phase');
    }
    const orchestratorAdmission = await resolveAgentAdmissionState(supabase, requesterAgent).catch(() => null);
    if (!orchestratorAdmission?.delegationActive) {
      return refuse('ORCHESTRATOR_NOT_DELEGATED', `orchestrator '${req.orchestratorAgentId}' has no active delegation under the current principal`);
    }
    // §6 — a resolved provider may never itself be the orchestrator of a
    // further hop in this phase.
    if (req.orchestratorAgentId === provider.providerAgentId) {
      return refuse('PROVIDER_MAY_NOT_ORCHESTRATE', `resolved provider '${provider.providerAgentId}' cannot also be the orchestrator of this same call`);
    }
  } else {
    // Direct specialist pattern — requester must equal the resolved provider;
    // a direct request naming a capability it does not itself provide is the
    // structural form of "a helper may not orchestrate," applied requester-side.
    if (req.requestingAgentId !== provider.providerAgentId) {
      return refuse('DIRECT_REQUEST_TARGET_MISMATCH', `direct request from '${req.requestingAgentId}' but capability resolves to '${provider.providerAgentId}'`);
    }
  }

  const providerAgent = resolveRegistrableAgentByRuntimeId(provider.providerAgentId);
  if (!providerAgent) {
    return refuse('UNKNOWN_AGENT', `resolved provider '${provider.providerAgentId}' is not a canonical registrable agent`);
  }
  const providerAdmission = await resolveAgentAdmissionState(supabase, providerAgent).catch(() => null);
  if (!providerAdmission?.delegationActive) {
    return refuse('PROVIDER_NOT_ADMITTED', `resolved provider '${provider.providerAgentId}' has no independently active admission`);
  }

  return OK;
}

/**
 * Gate 2 — capability and runtime eligibility (design doc §4), the part
 * beyond resolution (already run in `resolveProviderForGates`).
 */
export function evaluateCapabilityAndRuntimeGate(req: CapabilityInvocation, provider: ResolvedCapabilityProvider): GateResult {
  const membership = provider.benchRow.runtimeMemberships.find((m) => m.runtimeId === provider.runtimeMembershipRef);
  if (!membership) {
    return refuse('RUNTIME_NOT_ELIGIBLE', `no runtime membership '${provider.runtimeMembershipRef}' resolved for provider '${provider.providerAgentId}'`);
  }
  if (req.executionMode !== 'preview' && membership.status !== 'active' && membership.status !== 'approved') {
    return refuse('RUNTIME_NOT_ELIGIBLE', `runtime membership status '${membership.status}' is not eligible for executionMode '${req.executionMode}'`);
  }
  // Mode permission — no per-capability policy-binding store exists yet
  // (design doc §4 Gate 3 names this as a future-owned signal). Until one
  // does, the safe, honest default is: preview/shadow always allowed,
  // authoritative NEVER allowed by default. This is the structural
  // enforcement behind the scope note's "no authoritative mode is
  // reachable from any gate above" — not a hardcoded exemption list.
  if (req.executionMode === 'authoritative') {
    return refuse('MODE_NOT_PERMITTED', 'authoritative execution has no declared policy binding permitting it in this phase');
  }
  return OK;
}

/**
 * Gate 3 — policy and consequence (design doc §4). See the Gate 2 comment
 * above re: no real per-capability policy-binding store existing yet — this
 * gate's job for THIS phase is therefore the human-approval + spend-cap
 * checks that ARE reachable, evaluated against what real data exists
 * (policyBindingRefs is currently always empty for the pilot capability, so
 * this gate always passes once Gates 1-2 pass and executionMode is
 * preview/shadow).
 */
export function evaluatePolicyAndConsequenceGate(req: CapabilityInvocation): GateResult {
  // No money-moving capability is reachable in this phase (Gate 2 already
  // refuses `authoritative`), so no spend/settlement check applies. Reserved
  // for the phase that adds a real policy-binding store per the design doc.
  return OK;
}
