/**
 * Capability adapters — Phase 2 of the Universal Capability Gateway.
 *
 * An adapter is what actually executes a `CapabilityWorkOrder`. The
 * gateway issues the work order; an adapter consumes it. Adapters are
 * registered once at module load (see `./registry.ts`) and dispatched
 * by the `workOrder.adapter` field.
 *
 * Phase 2 ships the OpenClaw adapter only. Future adapters (e.g. a
 * managed-MCP HTTP proxy, a sidecar OpenClaw worker over RPC) plug in
 * by implementing this same interface — the gateway and receipt
 * pipeline do not change.
 *
 * Hard invariants (mirror Phase 1):
 *   - Adapters receive `CapabilityWorkOrder` only. They never see
 *     `ActivePersonaContext`, `PolicyEnvelope`, or any T0 surface.
 *   - Adapters MUST honour `workOrder.approval_state === 'pending'`
 *     by refusing to execute until the work order's approval state
 *     is `'auto'` or `'granted'`.
 *   - Adapters MUST honour `workOrder.policy.forbidden_actions` —
 *     even if a tool would execute, refuse when the fingerprint is
 *     in the forbidden list (defence in depth; gateway also checks).
 */

import type { CapabilityWorkOrder } from '../types';

export interface AdapterArtifactRef {
  /** Stable id (registry id, content qube id, etc.). */
  id: string;
  /** Short label for receipt summaries. */
  label: string;
  /** Optional MIME / kind hint. */
  kind?: string;
}

export type AdapterResult =
  | {
      ok: true;
      /** Tool-specific result payload. Caller knows the shape per tool_name. */
      data: unknown;
      /** Artifacts created or consulted during execution. */
      artifacts?: AdapterArtifactRef[];
      /** Short summary for the receipt line. */
      summary: string;
    }
  | {
      ok: false;
      /** Adapter-stable error code (e.g. 'tool-not-found', 'tool-failed'). */
      reason: string;
      /** Human-readable detail. */
      detail?: string;
    };

export interface CapabilityAdapter {
  /** Matches `CapabilityWorkOrder.adapter`. */
  id: 'openclaw';

  /**
   * Execute the work order. Adapters should:
   *   1. Check `workOrder.approval_state` (refuse if 'pending').
   *   2. Resolve `workOrder.tool_name` against the adapter's tool table.
   *   3. Run the tool with `workOrder.input` (and `serverContext` for
   *      tools that need T0 — see AdapterServerContext below).
   *   4. Return an AdapterResult — never throw for tool-level failure;
   *      reserve throws for adapter-internal bugs.
   */
  execute(
    workOrder: CapabilityWorkOrder,
    serverContext?: AdapterServerContext,
  ): Promise<AdapterResult>;

  /** List of tool names this adapter knows about. Used by smoke tests. */
  listTools(): string[];
}

/**
 * Server-internal context handed to in-process adapters only. Carries
 * T0 (`personaId`) so tools like owned-content-scan can call the
 * existing T0-keyed services without us inventing parallel resolvers.
 *
 * IMPORTANT — this is intentionally NOT covered by the work-order T0
 * canary. The work order JSON stays T0-free. serverContext is a side-
 * channel that exists ONLY because the adapter runs in the same Node
 * process as the gateway. A future out-of-process sidecar adapter
 * would receive `undefined` here and tools that depend on T0 would
 * have to use a T2-aliased server-side resolver instead.
 */
export interface AdapterServerContext {
  /** T0 — server-internal only. Never serialise, never log. */
  personaId: string;
}
