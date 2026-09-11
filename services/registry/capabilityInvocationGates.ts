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
 *
 * REPAIRED 2026-08-23 (operator directive): every admission check in this
 * gate now reads `AgentAdmissionState.registryActivated` (canonical
 * constitutional admission), never `.delegationActive` (the runtime
 * execution grant). "Do not treat 'no current bounded delegation' as
 * 'provider not admitted.'" Current delegation/mandate checks for
 * CONSEQUENTIAL execution remain — downstream, through the frozen
 * ConstitutionalAuthority / ActionAuthorisation path
 * (services/constitutionalCommerce/actionAuthorisation.ts) — this gate never
 * duplicated that check and still doesn't.
 *
 * Three invocation shapes are now recognised (Gate 2 remains completely
 * unchanged by this repair):
 *   - orchestrated:        requestingAgentId === orchestratorAgentId, a
 *                           separately-resolved provider (MoneyPenny, this
 *                           phase's only orchestrator)
 *   - principal-directed
 *     consumer (NEW):      orchestratorAgentId absent, requestingAgentId !==
 *                           resolved provider — an admitted CONSUMER agent
 *                           (e.g. Aigent Nakamoto) requests a capability from
 *                           a separately-resolved provider (e.g. MoneyPenny),
 *                           directed by the human principal's own
 *                           constitutional context (`principalRef`, checked
 *                           above). NOT orchestration — no agent here manages
 *                           a further hop. Phase 3's genuine missing case;
 *                           previously faked by setting
 *                           `orchestratorAgentId = requestingAgentId`, which
 *                           misrepresented a consumer as an orchestrator.
 *   - direct specialist:   orchestratorAgentId absent, requestingAgentId ===
 *                           resolved provider
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
    if (orchestratorAdmission?.registryActivated === undefined) {
      return refuse('ORCHESTRATOR_ADMISSION_UNRESOLVED', `orchestrator '${req.orchestratorAgentId}' admission state could not be determined`);
    }
    if (orchestratorAdmission.registryActivated === false) {
      return refuse('ORCHESTRATOR_NOT_ADMITTED', `orchestrator '${req.orchestratorAgentId}' has no established constitutional admission`);
    }
    // §6 — a resolved provider may never itself be the orchestrator of a
    // further hop in this phase.
    if (req.orchestratorAgentId === provider.providerAgentId) {
      return refuse('PROVIDER_MAY_NOT_ORCHESTRATE', `resolved provider '${provider.providerAgentId}' cannot also be the orchestrator of this same call`);
    }
  } else if (req.requestingAgentId !== provider.providerAgentId) {
    // NEW — principal-directed consumer pattern (see header). The consumer's
    // own constitutional admission is checked independently; its CURRENT
    // delegation/mandate is a separate, downstream Authority Plane concern.
    const consumerAdmission = await resolveAgentAdmissionState(supabase, requesterAgent).catch(() => null);
    if (consumerAdmission?.registryActivated === undefined) {
      return refuse('CONSUMER_ADMISSION_UNRESOLVED', `consumer '${req.requestingAgentId}' admission state could not be determined`);
    }
    if (consumerAdmission.registryActivated === false) {
      return refuse('CONSUMER_NOT_ADMITTED', `consumer '${req.requestingAgentId}' has no established constitutional admission`);
    }
  }
  // else: direct specialist pattern — requester === resolved provider; the
  // provider admission check below covers this agent too.

  const providerAgent = resolveRegistrableAgentByRuntimeId(provider.providerAgentId);
  if (!providerAgent) {
    return refuse('UNKNOWN_AGENT', `resolved provider '${provider.providerAgentId}' is not a canonical registrable agent`);
  }
  const providerAdmission = await resolveAgentAdmissionState(supabase, providerAgent).catch(() => null);
  if (providerAdmission?.registryActivated === undefined) {
    return refuse('PROVIDER_ADMISSION_UNRESOLVED', `resolved provider '${provider.providerAgentId}' admission state could not be determined`);
  }
  if (providerAdmission.registryActivated === false) {
    return refuse('PROVIDER_NOT_ADMITTED', `resolved provider '${provider.providerAgentId}' has no independently established constitutional admission`);
  }

  return OK;
}

/**
 * The one capability whose admission into `authoritative` mode is
 * conditioned on an attached unified consequence projection, rather than
 * refused outright (VELA-001 Slice 2F). Naming it as a single constant here
 * — not a config list, not a wildcard — keeps the exception narrow and
 * auditable at a glance: every other capability's `authoritative` refusal
 * below is completely unaffected.
 */
const CONSEQUENCE_PROJECTION_GATED_CAPABILITY = 'CONFIDENTIAL_CONSEQUENCE_PROJECTION';

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
    // VELA-001 Slice 2F: the ONE narrow, structural exception. Every other
    // capability still falls straight through to MODE_NOT_PERMITTED below —
    // this does not open authoritative mode generally, and it is not a
    // second decision path: it is one additional condition inside the SAME
    // gate, for the SAME capability id, checked before the same unconditional
    // refusal every other capability still hits.
    if (req.capabilityId === CONSEQUENCE_PROJECTION_GATED_CAPABILITY) {
      const projection = req.consequenceProjection;
      if (!projection) {
        return refuse(
          'CONSEQUENCE_PROJECTION_UNRESOLVED',
          `authoritative '${CONSEQUENCE_PROJECTION_GATED_CAPABILITY}' requires an attached ConsequenceProjection; none was supplied`,
        );
      }
      // An ACCEPTABLE projection lets this gate pass. It does NOT itself mean
      // the invocation is authorised — `allow` from invokeCapability() is a
      // governance-layer permission to dispatch; the financial-domain
      // ActionAuthorisation is derived separately, downstream, from this same
      // projection plus ConstitutionalAuthority
      // (services/constitutionalCommerce/actionAuthorisation.ts).
      if (projection.disposition === 'ACCEPTABLE') {
        return OK;
      }
      if (projection.disposition === 'UNACCEPTABLE') {
        return refuse('CONSEQUENCE_PROJECTION_UNACCEPTABLE', projection.compositionRationale);
      }
      return refuse('CONSEQUENCE_PROJECTION_UNRESOLVED', projection.compositionRationale);
    }
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
