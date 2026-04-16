/**
 * InvocationGateway — governed entry point for all asset invocations.
 *
 * No raw imported asset code is executed directly. Every invocation goes
 * through a wrapper strategy and is subject to PolicyQube enforcement.
 *
 * Policy enforcement:
 * - Unpublished assets → blocked
 * - human_approval_required → blocked pending approval
 * - Policy class mismatches → blocked
 *
 * For MVP, actual wrapper execution is scaffolded with safe extension seams.
 * Full worker dispatch is deferred to a controlled execution environment.
 */

import { createHash } from "crypto";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { getAsset } from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import { PolicyClass, WrapperStrategy } from "@/types/registryIngestion";
import { evaluateSkillQubePolicy } from "@/services/policy/skillQubePolicyGate";

function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface InvocationRequest {
  assetId: string;
  invokedBy: string;
  tenantId: string;
  input: Record<string, unknown>;
  /** Override the default wrapper strategy if the caller needs a specific path */
  wrapperOverride?: WrapperStrategy;
}

export interface InvocationResult {
  ok: boolean;
  invocationId?: string;
  output?: Record<string, unknown>;
  status: "completed" | "failed" | "blocked_policy" | "blocked_approval" | "deferred";
  error?: string;
}

export async function invokeAsset(req: InvocationRequest): Promise<InvocationResult> {
  const asset = await getAsset(req.assetId);
  if (!asset) {
    return { ok: false, status: "failed", error: `Asset not found: ${req.assetId}` };
  }

  // Policy gate 1: asset must be published
  if (asset.publicationStatus !== "published") {
    return {
      ok: false,
      status: "blocked_policy",
      error: `Asset is not published (status: ${asset.publicationStatus})`,
    };
  }

  // Policy gate 2: human approval required
  if (asset.policyClass === "human_approval_required") {
    return {
      ok: false,
      status: "blocked_approval",
      error: "This asset requires human approval before each invocation.",
    };
  }

  // Policy gate 3: SkillQube curated alpha policy
  if (asset.assetClass === "SkillQube") {
    const policyEval = evaluateSkillQubePolicy({
      skillId: asset.assetId,
      trustBand: asset.trustBand,
      policyClass: asset.policyClass,
      publicationStatus: asset.publicationStatus,
      cartridgeId: (asset.metadata?.cartridge as string) ?? undefined,
      requiredCartridge: (req.input?.cartridgeId as string) ?? undefined,
      personaId: req.invokedBy,
      tenantId: req.tenantId,
    });
    if (!policyEval.allowed) {
      return {
        ok: false,
        status: "blocked_policy",
        error: `SkillQube policy gate: ${policyEval.reasons.join("; ")}`,
      };
    }
  }

  const invocationId = generateId();
  const inputHash = createHash("sha256").update(JSON.stringify(req.input)).digest("hex");
  const wrapperStrategy = req.wrapperOverride ?? asset.wrapperStrategy;

  // Record invocation start
  await recordInvocationStart(invocationId, req, wrapperStrategy as WrapperStrategy, inputHash, asset.tenantId ?? req.tenantId);

  let output: Record<string, unknown> = {};
  let status: InvocationResult["status"] = "deferred";
  let error: string | undefined;

  try {
    const result = await dispatchWrapper(wrapperStrategy as WrapperStrategy, asset, req.input);
    output = result.output;
    status = result.deferred ? "deferred" : "completed";
  } catch (err) {
    error = err instanceof Error ? err.message : "Invocation error";
    status = "failed";
  }

  const outputHash = createHash("sha256").update(JSON.stringify(output)).digest("hex");

  // Record invocation end
  await recordInvocationEnd(invocationId, status, outputHash, error);

  // Emit receipt
  await emitReceipt({
    eventType: "asset.invoked",
    actorId: req.invokedBy,
    tenantId: req.tenantId,
    assetId: req.assetId,
    invocationId,
    payload: {
      invocationId,
      assetId: req.assetId,
      wrapperStrategy,
      policyClass: asset.policyClass,
      status,
      inputHash,
      outputHash,
    },
  });

  return {
    ok: status !== "failed",
    invocationId,
    output: status === "completed" ? output : undefined,
    status,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper dispatch — safe extension seams
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchWrapper(
  strategy: WrapperStrategy,
  asset: { metadata: Record<string, unknown>; policyClass: PolicyClass },
  input: Record<string, unknown>
): Promise<{ output: Record<string, unknown>; deferred: boolean }> {
  switch (strategy) {
    case "http":
      return dispatchHttpWrapper(asset.metadata, input);
    case "skill":
      return dispatchSkillWrapper(asset.metadata, input);
    case "workflow":
      return dispatchWorkflowWrapper(asset.metadata, input);
    case "mcp":
      return dispatchMcpWrapper(asset.metadata, input);
    case "cli_container":
      // CLI/container dispatch deferred — requires sandbox worker
      return { output: { status: "deferred", reason: "CLI/container dispatch requires sandbox worker" }, deferred: true };
    case "browser":
      // Browser dispatch deferred — requires browser operator
      return { output: { status: "deferred", reason: "Browser dispatch requires browser operator" }, deferred: true };
    default:
      return { output: {}, deferred: true };
  }
}

async function dispatchHttpWrapper(
  metadata: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<{ output: Record<string, unknown>; deferred: boolean }> {
  const endpointUrl = metadata.endpointUrl as string | undefined;
  if (!endpointUrl) {
    return { output: { status: "deferred", reason: "No endpointUrl configured" }, deferred: true };
  }
  // HTTP wrapper: forward input to configured endpoint
  // Network is already constrained by policy class enforcement at the API layer
  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { output: parsed, deferred: false };
}

async function dispatchSkillWrapper(
  metadata: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<{ output: Record<string, unknown>; deferred: boolean }> {
  // Skill wrapper: resolve steps and produce a structured output descriptor
  const steps = (metadata.steps as Array<{ name: string }>) ?? [];
  return {
    output: {
      status: "deferred",
      reason: "Skill step execution requires Aigent Z orchestration",
      steps: steps.map((s) => s.name),
      input,
    },
    deferred: true,
  };
}

async function dispatchWorkflowWrapper(
  metadata: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<{ output: Record<string, unknown>; deferred: boolean }> {
  const engine = metadata.workflowEngine as string | undefined;
  return {
    output: {
      status: "deferred",
      reason: `Workflow execution via ${engine ?? "unknown engine"} requires engine adapter`,
      input,
    },
    deferred: true,
  };
}

/**
 * MCP wrapper — calls a remote MCP endpoint using the JSON-RPC tools/call format.
 *
 * Expected metadata fields:
 *   endpointUrl  — the MCP server base URL (e.g. https://brave-search.mcp.run)
 *   toolName     — the MCP tool name to invoke (e.g. "search")
 *   mcpHeaders   — optional Record<string, string> of extra HTTP headers (e.g. auth)
 *
 * Protocol: POST to endpointUrl with body:
 *   { "jsonrpc": "2.0", "method": "tools/call", "params": { "name": toolName, "arguments": input } }
 */
async function dispatchMcpWrapper(
  metadata: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<{ output: Record<string, unknown>; deferred: boolean }> {
  const endpointUrl = metadata.endpointUrl as string | undefined;
  if (!endpointUrl) {
    return { output: { status: "deferred", reason: "No endpointUrl configured for MCP asset" }, deferred: true };
  }

  const toolName = (metadata.toolName as string | undefined) ?? "default";
  const mcpHeaders = (metadata.mcpHeaders as Record<string, string> | undefined) ?? {};

  const body = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: input,
    },
  };

  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...mcpHeaders,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

  // MCP JSON-RPC: unwrap result.content or return error
  if (parsed.error) {
    const err = parsed.error as Record<string, unknown>;
    return {
      output: { status: "error", code: err.code, message: err.message, raw: parsed },
      deferred: false,
    };
  }

  const result = (parsed.result as Record<string, unknown>) ?? parsed;
  return { output: result, deferred: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invocation persistence helpers
// ─────────────────────────────────────────────────────────────────────────────

async function recordInvocationStart(
  invocationId: string,
  req: InvocationRequest,
  wrapperStrategy: WrapperStrategy,
  inputHash: string,
  tenantId: string
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase.from("registry_invocations").insert({
    invocation_id: invocationId,
    asset_id: req.assetId,
    invoked_by: req.invokedBy,
    tenant_id: tenantId,
    wrapper_strategy: wrapperStrategy,
    policy_class: "read_only",
    input_hash: inputHash,
    status: "running",
    invoked_at: new Date().toISOString(),
  });
}

async function recordInvocationEnd(
  invocationId: string,
  status: string,
  outputHash: string,
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase.from("registry_invocations").update({
    status,
    output_hash: outputHash,
    error_message: errorMessage ?? null,
    completed_at: new Date().toISOString(),
  }).eq("invocation_id", invocationId);
}
