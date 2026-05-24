/**
 * Capability Gateway — Phase 1 entry point.
 *
 * The single function any caller (specialistRouter, future
 * /api/capabilities/* routes, OpenClaw adapter) uses to obtain a
 * `CapabilityWorkOrder`. Every adapter invocation MUST flow through
 * this gateway; direct calls into MCP execution are forbidden by
 * convention and will fail the `managedMcpProxy` canary added in
 * Phase 2.
 *
 * Hard guarantees (enforced by this file + the `_AssertNoT0` canary
 * in `./types.ts`):
 *
 *   - Rejects requests without an `ActivePersonaContext`.
 *   - Rejects requests without a `PolicyEnvelope`.
 *   - Compiles a T0-free `CapabilityPolicyEnvelope` via the policy
 *     compiler (Identifiability × disclosure_class × surface ×
 *     cartridge × capability).
 *   - The returned `CapabilityWorkOrder` is the only object adapters
 *     ever see. T0 ids never leave the gateway.
 *
 * Phase 1 does not execute anything. Adapters land in Phase 2.
 */

import { randomUUID } from 'crypto';
import type { ActivePersonaContext } from '@/types/access';
import { compileCapabilityPolicy, type CapabilityDenyReason } from './policyCompiler';
import type {
  CapabilityClass,
  CapabilityWorkOrder,
  PolicyEnvelope,
} from './types';

export interface IssueWorkOrderInput {
  /** Server-resolved persona context. T0 — never leaves the gateway. */
  persona: ActivePersonaContext | null;

  /** Server-side policy envelope. T0 (tenant_id, persona_id) allowed here. */
  envelope: PolicyEnvelope | null;

  /** Adapter that will execute. Phase 1 only registers 'openclaw'. */
  adapter: 'openclaw';

  /** Coarse class for allowlist gating. */
  capability_class: CapabilityClass;

  /** Adapter-specific tool name (e.g. 'web-search', 'gmail.draft'). */
  tool_name: string;

  /** Tool-specific input. */
  input: Record<string, unknown>;

  /** Surface emitting the request (e.g. 'aigentMe/welcome'). */
  origin_surface: string;

  /** Target cartridge for this capability. */
  cartridge: string;

  /** Optional T1 session token to forward to the adapter. */
  personaSessionToken?: string;

  /** Optional cohort id for T2 alias derivation. Defaults to 'default'. */
  cohortId?: string;

  /**
   * Set true when the caller has already obtained second-tier approval
   * (e.g. the user clicked Approve in a SecondTierApprovalCard). When
   * false + envelope.requires_guardian_approval = true, the work order
   * is issued in 'pending' state and the adapter MUST wait.
   */
  hasGuardianApproval?: boolean;
}

export type IssueWorkOrderResult =
  | { ok: true; workOrder: CapabilityWorkOrder }
  | { ok: false; reason: GatewayDenyReason; detail?: string };

export type GatewayDenyReason =
  | 'persona-required'
  | 'policy-envelope-required'
  | 'unknown-adapter'
  | CapabilityDenyReason;

/**
 * Issue a `CapabilityWorkOrder` after policy compilation. T0 stops here.
 *
 * Callers are responsible for resolving `persona` via the spine
 * (`getActivePersona(req)`) and for handing in a real `PolicyEnvelope`
 * — the gateway never invents either.
 */
export function issueCapabilityWorkOrder(
  input: IssueWorkOrderInput,
): IssueWorkOrderResult {
  if (!input.persona) {
    return { ok: false, reason: 'persona-required' };
  }
  if (!input.envelope) {
    return { ok: false, reason: 'policy-envelope-required' };
  }
  if (input.adapter !== 'openclaw') {
    return { ok: false, reason: 'unknown-adapter', detail: `adapter '${input.adapter}' not registered` };
  }

  const decision = compileCapabilityPolicy({
    envelope: input.envelope,
    persona: input.persona,
    capability_class: input.capability_class,
    surface: input.origin_surface,
    cartridge: input.cartridge,
    tool_name: input.tool_name,
    personaSessionToken: input.personaSessionToken,
    cohortId: input.cohortId,
  });
  if (!decision.ok) {
    return { ok: false, reason: decision.reason, detail: decision.detail };
  }

  const approval_state: CapabilityWorkOrder['approval_state'] =
    decision.envelope.requires_guardian_approval
      ? input.hasGuardianApproval
        ? 'granted'
        : 'pending'
      : 'auto';

  const workOrder: CapabilityWorkOrder = {
    workOrderId: randomUUID(),
    adapter: input.adapter,
    capability_class: input.capability_class,
    tool_name: input.tool_name,
    input: input.input,
    policy: decision.envelope,
    origin_surface: input.origin_surface,
    approval_state,
    issued_at: new Date().toISOString(),
  };

  return { ok: true, workOrder };
}
