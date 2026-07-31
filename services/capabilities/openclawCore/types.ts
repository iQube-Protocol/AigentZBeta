/**
 * openclawCore — shared types for the OpenClaw tool execution loop.
 *
 * Phase 2b extracts the generic tool registry / invocation pattern
 * from `clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts` so both
 * the in-process Capability Gateway adapter (`adapters/openclawAdapter.ts`)
 * and the long-running CLI worker (`clawhack-group-agents/run.ts`) can
 * eventually share one tool table.
 *
 * Today's extract is unilateral: the gateway adapter uses these types;
 * the CLI worker continues to use its existing MCPInvoker class. The
 * convergence (worker → import from openclawCore) is a separate
 * follow-up flagged with `@todo phase 2b-convergence` markers in the
 * worker.
 *
 * Hard rule: openclawCore tool handlers receive `(input, serverContext)`.
 * - `input` is the work order's tool-specific JSON payload (T0-free).
 * - `serverContext` carries T0 only because the gateway adapter runs
 *   in-process. Future remote / sidecar adapters MUST NOT depend on it.
 */

export interface OpenClawToolServerContext {
  /** T0 — server-internal only. */
  personaId: string;
}

export type OpenClawToolResult =
  | {
      ok: true;
      data: unknown;
      summary: string;
      artifacts?: Array<{ id: string; label: string; kind?: string }>;
    }
  | {
      ok: false;
      reason: string;
      detail?: string;
    };

export type OpenClawToolHandler = (
  input: Record<string, unknown>,
  serverContext?: OpenClawToolServerContext,
) => Promise<OpenClawToolResult>;

export interface OpenClawTool {
  /** Tool id — matches `CapabilityWorkOrder.tool_name`. */
  name: string;
  /** Human-readable description. Useful for adapter listing / diagnostics. */
  description: string;
  /** True when the handler needs T0 (`personaId`) to do its job. */
  needsServerContext: boolean;
  /** The implementation. */
  handler: OpenClawToolHandler;
}
