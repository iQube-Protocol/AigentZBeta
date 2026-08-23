/**
 * The first Financial Services -> ConstitutionalAuthority adapter (Repair C,
 * 2026-08-23 repair pass).
 *
 * Composes existing canonical records into the frozen `ConstitutionalAuthority`
 * shape (`types/constitutionalCommerce.ts`) — it is NOT a new authority
 * system. Per operator directive:
 *
 *   "do not derive state: ACTIVE merely because readActiveGrant() returns an
 *   unexpired grant. That grant proves the bounded-delegation/Authority
 *   portion. It does not prove the exact Mandate."
 *
 * State mapping:
 *   registryActivated !== true                                -> NONE / PENDING
 *   registryActivated === true, no CURRENT delegation to       -> PENDING
 *     this exact agent (Authority Plane fact — NEVER the
 *     structural admission/assignment fact eligibility uses)
 *   + current delegation, no authorized Constitutional
 *     Agreement (mandate) for this exact capability+agent      -> BOUNDED
 *   + an authorized Constitutional Agreement                   -> ACTIVE
 *
 * `hasCurrentDelegationToAgent` (`agentEligibilityContext.ts`) is an
 * AUTHORITY-PLANE fact only — it is NEVER used to decide discoverability/
 * eligibility (operator correction, 2026-08-23: the delegation_grants store
 * allows exactly one active grant per persona, so it cannot serve as a
 * multi-agent eligibility roster). A service can be `eligible` while this
 * authority remains `PENDING`/`BOUNDED` — that is the expected, honest state
 * for "eligible but a consequential action isn't currently authorised yet."
 *
 * The mandate itself is resolved via the EXISTING agreement primitive
 * (`services/constitutional/constitutionalAgreement.ts`'s
 * `requireAuthorizedAgreement`) — never a synthesized
 * `mandate-fsvc-oversight-*` string. `principalRef` is the T2-safe
 * `personaPublicRef(personaId)` (never the raw personaId — this object flows
 * into DVN-anchored commerce receipts via
 * `services/constitutionalCommerce/commerceReceipts.ts`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConstitutionalAuthority } from '@/types/constitutionalCommerce';
import type { FinancialServiceDefinition } from '@/types/financialServices';
import type { FinancialServiceAgentContext } from './agentEligibilityContext';
import { personaPublicRef, constitutionalRef } from '@/services/identity/personaReferences';
import { requireAuthorizedAgreement, type AgreementGateResult } from '@/services/constitutional/constitutionalAgreement';

export interface ConstitutionalAuthorityResolution {
  authority: ConstitutionalAuthority;
  agreementGate: AgreementGateResult;
}

export async function resolveConstitutionalAuthorityForService(
  admin: SupabaseClient,
  ctx: FinancialServiceAgentContext,
  definition: FinancialServiceDefinition,
): Promise<ConstitutionalAuthorityResolution> {
  const { agent, admission, activeGrant, hasCurrentDelegationToAgent, standingPersonaId, callerPersonaId } = ctx;

  const noPrincipalGate: AgreementGateResult = {
    ok: false,
    status: 409,
    reason: 'no authenticated principal directing this agent',
    remediation: 'authenticate as the persona directing this agent before requesting a Financial Service on its behalf',
  };

  if (!callerPersonaId) {
    return {
      authority: {
        // Empty, never a truthy placeholder like 'unresolved-principal' —
        // Gate 1 (services/registry/capabilityInvocationGates.ts) refuses
        // PRINCIPAL_UNRESOLVED on an empty principalRef, and a placeholder
        // string here would defeat that fail-closed check by construction.
        principalRef: '',
        actorRef: agent.runtimeAgentId,
        authoritySource: 'none',
        mandateRef: constitutionalRef('mandate-unresolved', `${agent.runtimeAgentId}:${definition.capabilityId}`),
        state: 'NONE',
      },
      agreementGate: noPrincipalGate,
    };
  }

  const principalRef = personaPublicRef(callerPersonaId);

  // Passport ref — the caller's own active citizen passport, if any. A single,
  // targeted read (not the full ConstitutionalContext composition, which
  // requires a NextRequest this service-layer module never holds).
  let passportRef: string | undefined;
  try {
    const { data } = await admin
      .from('polity_passport_records')
      .select('passport_id')
      .eq('persona_id', callerPersonaId)
      .eq('passport_class', 'citizen')
      .in('citizen_status', ['active', 'renewal_due'])
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const passportId = (data as { passport_id?: string } | null)?.passport_id;
    if (passportId) passportRef = constitutionalRef('passport', String(passportId));
  } catch {
    // Best-effort — a missing passportRef never blocks authority composition;
    // it simply means this authority carries no passport provenance.
  }

  const delegationRef =
    hasCurrentDelegationToAgent === true && activeGrant ? constitutionalRef('delegation', activeGrant.grant_id) : undefined;
  const standingRef = standingPersonaId ? constitutionalRef('agent-standing', standingPersonaId) : undefined;

  const sourceParts: string[] = [];
  if (admission?.registryActivated === true) sourceParts.push('registry-admission');
  if (hasCurrentDelegationToAgent === true) sourceParts.push('bounded-delegation');
  if (standingRef) sourceParts.push('standing');
  const authoritySource = sourceParts.length > 0 ? sourceParts.join('+') : 'none';

  const agreementGate = await requireAuthorizedAgreement({
    capabilityRef: definition.capabilityId,
    selectedAgentRef: agent.runtimeAgentId,
    requestingPersonaId: callerPersonaId,
  });

  // A commitment ref either way — REAL (derived from the authorized
  // agreement id) when one exists, or a stable-but-empty placeholder when it
  // doesn't. Never a fabricated string that could be mistaken for a real
  // mandate.
  const mandateRef = agreementGate.ok
    ? constitutionalRef('mandate', agreementGate.agreementId)
    : constitutionalRef('mandate-unresolved', `${agent.runtimeAgentId}:${definition.capabilityId}`);

  let state: ConstitutionalAuthority['state'];
  if (admission?.registryActivated !== true) {
    state = admission?.registryActivated === undefined ? 'PENDING' : 'NONE';
  } else if (hasCurrentDelegationToAgent !== true) {
    state = 'PENDING';
  } else if (agreementGate.ok) {
    state = 'ACTIVE';
  } else {
    state = 'BOUNDED';
  }

  const authority: ConstitutionalAuthority = {
    principalRef,
    actorRef: agent.runtimeAgentId,
    authoritySource,
    ...(passportRef ? { passportRef } : {}),
    ...(delegationRef ? { delegationRef } : {}),
    ...(standingRef ? { standingRef } : {}),
    mandateRef,
    state,
  };

  return { authority, agreementGate };
}
