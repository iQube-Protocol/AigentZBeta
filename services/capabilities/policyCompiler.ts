/**
 * Capability Gateway — policy compiler.
 *
 * Compiles the adapter-visible `CapabilityPolicyEnvelope` from:
 *   - the server-side `PolicyEnvelope` (carries T0)
 *   - the persona's `ActivePersonaContext` (carries T0)
 *   - the requested `CapabilityClass` + `cartridge`
 *
 * Decision axes (intersection — ALL must be satisfied):
 *   1. Identifiability  — actor authority (anonymous → identifiable)
 *   2. disclosure_class — information / surface sensitivity
 *   3. allowed_surfaces — which surfaces may emit the request
 *   4. forbidden_actions — explicit deny list (always wins)
 *   5. cartridge_scope  — which cartridge the policy belongs to
 *
 * Phase 1 implements the axes and a minimum allow/deny table. The full
 * matrix lands in Phase 2 alongside the first adapter wiring.
 */

import { createHash } from 'crypto';
import { computeAliasCommitment } from '@/services/identity/cohortAliasService';
import type { ActivePersonaContext, Identifiability } from '@/types/access';
import type {
  CapabilityClass,
  CapabilityPolicyEnvelope,
  DisclosureClass,
  PolicyEnvelope,
} from './types';

// ─── Identifiability authority ranks ─────────────────────────────────────────

const IDENTIFIABILITY_RANK: Record<Identifiability, number> = {
  anonymous: 0,
  semi_anonymous: 1,
  semi_identifiable: 2,
  identifiable: 3,
};

/** Minimum identifiability needed to invoke each capability class. */
const MIN_IDENTIFIABILITY_BY_CLASS: Record<CapabilityClass, Identifiability> = {
  read: 'anonymous',
  search: 'anonymous',
  compose: 'semi_anonymous',
  send: 'semi_identifiable',
  write: 'semi_identifiable',
  payment: 'identifiable',
  execute: 'semi_identifiable',
};

// ─── Disclosure class authority ──────────────────────────────────────────────
//
// disclosure_class describes the sensitivity of the surface / data the
// capability is going to touch. The ranks below define which classes a
// given identifiability tier is allowed to act on.

const DISCLOSURE_RANK: Record<DisclosureClass, number> = {
  public: 0,
  tenant: 1,
  persona: 2,
  sovereign: 3,
};

const MAX_DISCLOSURE_BY_IDENTIFIABILITY: Record<Identifiability, DisclosureClass> = {
  anonymous: 'public',
  semi_anonymous: 'tenant',
  semi_identifiable: 'persona',
  identifiable: 'sovereign',
};

// ─── Decision API ────────────────────────────────────────────────────────────

export type CompiledCapabilityDecision =
  | { ok: true; envelope: CapabilityPolicyEnvelope }
  | { ok: false; reason: CapabilityDenyReason; detail?: string };

export type CapabilityDenyReason =
  | 'identifiability-too-low'
  | 'disclosure-class-too-high'
  | 'surface-not-allowed'
  | 'action-forbidden'
  | 'cartridge-scope-mismatch'
  | 'alias-service-not-configured';

export interface CompilePolicyInput {
  envelope: PolicyEnvelope;
  persona: ActivePersonaContext;
  capability_class: CapabilityClass;
  /** The surface emitting the request (e.g. 'aigentMe/welcome'). */
  surface: string;
  /** Target cartridge for this capability (e.g. 'metame', 'knyt'). */
  cartridge: string;
  /** Adapter tool name; baked into the policy hash for traceability. */
  tool_name: string;
  /** Optional T1 session token to surface to the adapter (UI continuations). */
  personaSessionToken?: string;
  /** Cohort id used to derive the T2 alias. Defaults to 'default'. */
  cohortId?: string;
}

export function compileCapabilityPolicy(
  input: CompilePolicyInput,
): CompiledCapabilityDecision {
  const {
    envelope,
    persona,
    capability_class,
    surface,
    cartridge,
    tool_name,
    personaSessionToken,
    cohortId = 'default',
  } = input;

  // 1. Identifiability — actor authority floor.
  const requiredIdentifiability = MIN_IDENTIFIABILITY_BY_CLASS[capability_class];
  if (IDENTIFIABILITY_RANK[persona.identifiability] < IDENTIFIABILITY_RANK[requiredIdentifiability]) {
    return {
      ok: false,
      reason: 'identifiability-too-low',
      detail: `capability '${capability_class}' requires '${requiredIdentifiability}', got '${persona.identifiability}'`,
    };
  }

  // 2. disclosure_class — sensitivity ceiling for this identifiability.
  const maxDisclosure = MAX_DISCLOSURE_BY_IDENTIFIABILITY[persona.identifiability];
  if (DISCLOSURE_RANK[envelope.disclosure_class] > DISCLOSURE_RANK[maxDisclosure]) {
    return {
      ok: false,
      reason: 'disclosure-class-too-high',
      detail: `disclosure_class '${envelope.disclosure_class}' exceeds '${maxDisclosure}' allowed for '${persona.identifiability}'`,
    };
  }

  // 3. allowed_surfaces — surface allowlist (empty array = no restriction).
  if (envelope.allowed_surfaces.length > 0 && !envelope.allowed_surfaces.includes(surface)) {
    return { ok: false, reason: 'surface-not-allowed', detail: `surface '${surface}' not in allowlist` };
  }

  // 4. forbidden_actions — explicit deny on `${capability_class}:${tool_name}`.
  const fingerprint = `${capability_class}:${tool_name}`;
  if (envelope.forbidden_actions.includes(fingerprint) || envelope.forbidden_actions.includes(capability_class)) {
    return { ok: false, reason: 'action-forbidden', detail: `denied by forbidden_actions: ${fingerprint}` };
  }

  // 5. cartridge_scope — null = cross-cartridge OK; otherwise must match.
  if (envelope.cartridge_scope && envelope.cartridge_scope !== cartridge) {
    return {
      ok: false,
      reason: 'cartridge-scope-mismatch',
      detail: `envelope scoped to '${envelope.cartridge_scope}', got '${cartridge}'`,
    };
  }

  // Derive T2 alias commitment. Fail closed if service isn't configured.
  let cohortAliasCommitment: string;
  try {
    cohortAliasCommitment = computeAliasCommitment(persona.personaId, cohortId);
  } catch (err) {
    return {
      ok: false,
      reason: 'alias-service-not-configured',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const compiled: CapabilityPolicyEnvelope = {
    personaSessionToken,
    cohortAliasCommitment,
    disclosure_class: envelope.disclosure_class,
    allowed_surfaces: envelope.allowed_surfaces,
    forbidden_actions: envelope.forbidden_actions,
    requires_guardian_approval: envelope.requires_guardian_approval,
    identifiability: persona.identifiability,
    cartridge_scope: envelope.cartridge_scope,
    policyHash: hashPolicy({
      disclosure_class: envelope.disclosure_class,
      allowed_surfaces: envelope.allowed_surfaces,
      forbidden_actions: envelope.forbidden_actions,
      requires_guardian_approval: envelope.requires_guardian_approval,
      identifiability: persona.identifiability,
      cartridge_scope: envelope.cartridge_scope,
      capability_class,
      tool_name,
    }),
  };

  return { ok: true, envelope: compiled };
}

function hashPolicy(canonical: Record<string, unknown>): string {
  const sorted = Object.keys(canonical)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = canonical[k];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 32);
}
