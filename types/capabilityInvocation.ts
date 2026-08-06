/**
 * Governed Capability Invocation — envelope + decision types (Phase 4 of the
 * Agent Bench / aigentMe Specialist Orchestration brief).
 *
 * Design doc: codexes/packs/agentiq/updates/
 * 2026-08-06_governed-capability-invocation-design.md — read that before
 * changing anything here; this file is the §2 envelope transcribed into
 * code, not a fresh design. `services/registry/invocationGateway.ts`'s
 * `invokeCapability()` is the only function that constructs a decision from
 * one of these envelopes — do not build a second decision path.
 */

export type CapabilityExecutionMode = 'preview' | 'shadow' | 'authoritative';

export interface CapabilityInvocation {
  mode: 'capability';

  invocationId: string;

  principalRef: string;
  personaRef?: string;
  passportRef?: string;

  originatingSurface: 'aigentme' | 'wallet-copilot' | 'financial-services' | 'agent-bench' | string;

  /**
   * §0 of the design doc: requester is always present; orchestrator is
   * present only when a domain expert sits between the request and the
   * resolved provider.
   *   - Direct specialist:  requestingAgentId === resolved provider, orchestratorAgentId absent
   *   - Orchestrated:       requestingAgentId === orchestratorAgentId (this phase), target resolved separately
   */
  requestingAgentId: string;
  orchestratorAgentId?: string;

  /**
   * The constitutional object being invoked. `targetAgentId` is a HINT, not
   * an instruction — the gateway resolves the current provider from
   * `capabilityId` (services/registry/capabilityProviderResolution.ts) and
   * refuses (`PROVIDER_MISMATCH`) if a supplied hint disagrees with that
   * resolution. Never execute against a caller-supplied agent id directly.
   */
  capabilityId: string;
  targetAgentId?: string;

  runtimeMembershipRef: string;

  executionMode: CapabilityExecutionMode;

  intent: string;
  input: Record<string, unknown>;

  delegationRef?: string;
  policyBindingRefs: string[];

  contextRefs?: string[];

  /** Loop/depth guard (design doc §6) — required, not optional. */
  delegationDepth: number;
  invocationPath: string[];
  maxInvocationDepth: number;
}

export interface ExecutionEnvelope {
  invocationId: string;
  capabilityId: string;
  resolvedProviderId: string;
  resolvedRegistryAssetId: string;
  executionMode: CapabilityExecutionMode;
  /** What context was actually resolved and shared, and why — design doc §5. */
  sharedContext: Array<{ ref: string; justification: string }>;
}

export interface ApprovalRequest {
  invocationId: string;
  capabilityId: string;
  resolvedProviderId: string;
  reason: string;
}

export type InvocationDecision =
  | { decision: 'allow'; envelope: ExecutionEnvelope }
  | { decision: 'allow-with-approval'; approvalRequest: ApprovalRequest }
  | { decision: 'shadow-only'; reason: string }
  | { decision: 'refuse'; code: string; reason: string };
