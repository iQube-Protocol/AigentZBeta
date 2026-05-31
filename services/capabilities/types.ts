/**
 * Capability Gateway — Phase 1 types.
 *
 * Sibling types to `PolicyEnvelope` (types/orchestration.ts) and
 * `ActivePersonaContext` (types/access.ts), narrowed to be T0-free so
 * adapters (OpenClaw, future MCP wrappers, third-party agents) never
 * receive server-internal identifiers.
 *
 * Hard invariant:
 *   - `PolicyEnvelope` MAY carry T0 (`persona_id`, `tenant_id`) — used
 *     server-side by the orchestrator.
 *   - `CapabilityPolicyEnvelope` MUST NOT carry T0 — only T1
 *     (`personaSessionToken`) and T2 (`cohortAliasCommitment`).
 *   - `CapabilityWorkOrder` MUST NOT carry T0. Adapters receive
 *     work orders only.
 *
 * Phase 1 scope: types + gateway scaffold + receipt wrapper. No
 * adapter wired. No MCP execution. No managedMcpProxy yet.
 */

import type { Identifiability } from '@/types/access';
import type { PolicyEnvelope } from '@/types/orchestration';

// ─── PRD ↔ repo identifiability terminology ──────────────────────────────────
// Keep this mapping explicit so future contributors don't confuse the PRD
// wording ('identified' / 'verified') with the repo-native enum.

/** Identifiability terms used in PRDs / specs. Surface labels only. */
export type PrdIdentifiability =
  | 'anonymous'
  | 'semi_anonymous'
  | 'identified'
  | 'verified';

/**
 * Canonical PRD → repo Identifiability map.
 *
 * The internal system always uses the repo-native enum
 * (`anonymous | semi_anonymous | semi_identifiable | identifiable`).
 * This map exists only at PRD-translation boundaries and in docs.
 */
export const prdToRepoIdentifiabilityMap: Record<PrdIdentifiability, Identifiability> = {
  anonymous: 'anonymous',
  semi_anonymous: 'semi_anonymous',
  identified: 'semi_identifiable',
  verified: 'identifiable',
} as const;

// ─── Capability axis ─────────────────────────────────────────────────────────

/**
 * Coarse classification of what a capability does. Drives allowlist
 * gating (which Identifiability tier can invoke which class).
 *
 * This is the TOOL TYPE axis. The complementary PATTERN axis lives in
 * `CapabilityIntent` below (Pattern A / B / C in the integration plan).
 */
export type CapabilityClass =
  | 'read'        // pure-read tools (registry lookup, owned-content scan)
  | 'search'      // external search / discovery
  | 'compose'     // draft/generate text or media (no send)
  | 'send'        // outbound (email, channel post, calendar invite)
  | 'write'       // mutate persisted state (db row, registry entry)
  | 'payment'     // initiate / settle a payment
  | 'execute';    // generic tool execution that doesn't fit above

/**
 * Integration pattern axis — orthogonal to `CapabilityClass`. Describes
 * WHERE in the aigentMe pipeline this work order sits. Lets the same
 * gateway entry point serve all three integration patterns.
 *
 *   - 'tool_gather'   Pattern A: pre-flight enrichment before a
 *                     specialist composes its reply. Phase 1/2.
 *   - 'tool_execute'  Pattern B: post-reply execution of a specialist's
 *                     suggested action. Backlog.
 *   - 'plan_step'     Pattern C: one step inside a multi-step NBE
 *                     plan run by `capabilityGateway.runPlan(...)`.
 *                     Backlog.
 *
 * Phase 1 work orders default to 'tool_gather'. Adding a new pattern
 * is an additive change here — no gateway signature churn.
 */
export type CapabilityIntent = 'tool_gather' | 'tool_execute' | 'plan_step';

/** Disclosure tier carried through to gating. Mirrors PolicyEnvelope. */
export type DisclosureClass = 'public' | 'tenant' | 'persona' | 'sovereign';

// ─── CapabilityPolicyEnvelope — T0-free derivation of PolicyEnvelope ─────────

/**
 * Adapter-visible, T0-free policy envelope.
 *
 * Derived from a server-side `PolicyEnvelope` + `ActivePersonaContext`
 * by `derivePolicyEnvelope()`. The gateway computes this once per work
 * order and passes ONLY this envelope to adapters.
 *
 * Receipt keying uses `cohortAliasCommitment` (T2). T1
 * `personaSessionToken` is optional — present when the adapter needs
 * to issue browser-bound continuation links.
 */
export interface CapabilityPolicyEnvelope {
  /** T1 — opaque session token; safe to log/render. Optional. */
  personaSessionToken?: string;

  /** T2 — HMAC-derived alias for this (persona, cohort, epoch). Required. */
  cohortAliasCommitment: string;

  /** Mirror of PolicyEnvelope.disclosure_class. */
  disclosure_class: DisclosureClass;

  /** Mirror of PolicyEnvelope.allowed_surfaces. */
  allowed_surfaces: string[];

  /** Mirror of PolicyEnvelope.forbidden_actions. */
  forbidden_actions: string[];

  /** Mirror of PolicyEnvelope.requires_guardian_approval. */
  requires_guardian_approval: boolean;

  /** Caller-asserted identifiability floor (repo-native enum). */
  identifiability: Identifiability;

  /** Cartridge scope (e.g. 'metame', 'knyt') — null = cross-cartridge. */
  cartridge_scope: string | null;

  /**
   * Deterministic hash of the canonical envelope fields. Used by adapters
   * and receipts so two work orders with identical policy share a key
   * without exposing the full envelope on-chain.
   */
  policyHash: string;
}

// ─── CapabilityWorkOrder — the only thing adapters ever see ──────────────────

/**
 * Adapter-visible work order. T0-free by construction.
 *
 * The gateway issues one of these per inbound capability request. The
 * adapter (OpenClaw, future MCP wrappers) executes it under the
 * embedded `CapabilityPolicyEnvelope` and emits a capability receipt.
 */
export interface CapabilityWorkOrder {
  /** Stable id assigned by the gateway. Used as receipt foreign key. */
  workOrderId: string;

  /** Which adapter should execute this. */
  adapter: 'openclaw' | 'reserved-future';

  /**
   * Integration pattern this work order belongs to. Phase 1 issues
   * only 'tool_gather'; Pattern B / C land via the same gateway with
   * different intents — no new entry point.
   */
  capability_intent: CapabilityIntent;

  /** Coarse class for allowlist gating. */
  capability_class: CapabilityClass;

  /** Adapter-specific tool name (e.g. 'web-search', 'gmail.draft'). */
  tool_name: string;

  /** Tool-specific input. Adapters validate shape against their schema. */
  input: Record<string, unknown>;

  /** Compiled, T0-free policy. */
  policy: CapabilityPolicyEnvelope;

  /** Surface the request originated from (e.g. 'aigentMe/welcome'). */
  origin_surface: string;

  /**
   * Approval state at the moment the work order was issued.
   *   - 'auto'    — no human approval required; adapter may execute.
   *   - 'pending' — adapter must pause and emit a pending_approval event;
   *                 wait for `/api/capabilities/approve` before executing.
   *   - 'granted' — second-tier approval was granted up-front.
   */
  approval_state: 'auto' | 'pending' | 'granted';

  /** ISO timestamp the work order was created. */
  issued_at: string;
}

// ─── Compile-time canary ─────────────────────────────────────────────────────
//
// If anyone ever tries to widen `CapabilityWorkOrder` or
// `CapabilityPolicyEnvelope` with a T0 field, this assertion block
// will fail to compile.

type _AssertNoT0<T> = 'personaId' extends keyof T
  ? never
  : 'authProfileId' extends keyof T
    ? never
    : 'rootDid' extends keyof T
      ? never
      : 'tenant_id' extends keyof T
        ? never
        : 'persona_id' extends keyof T
          ? never
          : T;

// These two lines fail the build if any T0 field leaks into the type.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _CapabilityWorkOrderIsT0Free = _AssertNoT0<CapabilityWorkOrder>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _CapabilityPolicyEnvelopeIsT0Free = _AssertNoT0<CapabilityPolicyEnvelope>;

// Re-export PolicyEnvelope for callers that need to pass the source envelope
// to `derivePolicyEnvelope()` without a separate import.
export type { PolicyEnvelope };
