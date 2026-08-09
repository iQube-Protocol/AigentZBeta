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
import type { CapabilityInvocation, InvocationDecision } from "@/types/capabilityInvocation";
import {
  evaluateLoopAndDepthGuard,
  resolveProviderForGates,
  evaluateIdentityAndAuthorityGate,
  evaluateCapabilityAndRuntimeGate,
  evaluatePolicyAndConsequenceGate,
} from "./capabilityInvocationGates";
import { createActivityReceipt, type ActivityActionType } from "@/services/receipts/activityReceiptService";

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
// Governed CAPABILITY invocation — Phase 4, 2026-08-06. A second discriminated
// mode alongside `invokeAsset` above, per inv.engineering.036/037 (extend this
// gateway, never build a third gate). Design doc: codexes/packs/agentiq/
// updates/2026-08-06_governed-capability-invocation-design.md — every gate,
// refusal code and the depth/loop guard below is that doc transcribed into
// code. `invokeAsset` above is UNCHANGED by this addition.
//
// `invokeCapability` returns a DECISION, not a dispatch result (design doc
// §8's own scoping) — it does not itself call the resolved provider's
// runtime. The caller (MoneyPenny's proposal path, Agent Bench's invoke
// action, or `askSpecialist`'s direct-consultation branch) is what actually
// invokes the runtime after receiving `{decision:'allow', envelope}`; none of
// those call sites exist yet (design doc §8 — named, not built, in this
// pass) so this function's contract is exercised by its own tests today.
// ─────────────────────────────────────────────────────────────────────────────

async function recordCapabilityInvocation(
  req: CapabilityInvocation,
  registryAssetId: string,
  status: string,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  const inputHash = createHash("sha256").update(JSON.stringify(req.input)).digest("hex");
  await supabase
    .from("registry_invocations")
    .upsert(
      {
        invocation_id: req.invocationId,
        asset_id: registryAssetId,
        invoked_by: req.principalRef,
        tenant_id: req.originatingSurface,
        wrapper_strategy: "agent_capability",
        policy_class: req.executionMode,
        input_hash: inputHash,
        status,
        invoked_at: new Date().toISOString(),
        completed_at: status === "pending" ? null : new Date().toISOString(),
      },
      { onConflict: "invocation_id" },
    )
    .then(
      () => undefined,
      () => undefined, // best-effort — mirrors recordInvocationStart/End's no-throw convention
    );
}

const CAPABILITY_RECEIPT_ACTION_TYPE: Record<
  "requested" | "authorized" | "refused" | "completed",
  ActivityActionType
> = {
  requested: "capability_invocation_requested",
  authorized: "capability_invocation_authorized",
  refused: "capability_invocation_refused",
  completed: "capability_invocation_completed",
};

/**
 * Deliberately NOT `emitReceipt`/`ReceiptEventType` (the registry ingestion
 * factory's double-write projection) — that map is intentionally coarse
 * (every ingestion-pipeline event folds into `artifact_created` /
 * `knowledge_curated`, `asset.published` the one named exception —
 * tests/artifact-runtime-service.test.ts pins this) because it exists to
 * keep pipeline noise off fine-grained action types. A capability invocation
 * is not a registry-ingestion event, and its authorize/refuse/complete
 * outcomes ARE meant to be individually anchorable — so this calls
 * `createActivityReceipt` directly, its own real action types, same as every
 * other non-registry constitutional event class in this codebase (passport,
 * governance, agreement, ...).
 *
 * `personaId` is the caller's OWN resolved T0 identifier (from
 * `getActivePersona`), passed separately from the envelope's T1-safe
 * `principalRef` — never derived from `principalRef` itself, and never
 * placed in the receipt's `actionInput` payload. Omitted (no caller wired
 * yet, per design doc §8) means the receipt write is skipped — best-effort,
 * a missing receipt must never break the decision it describes.
 */
async function emitCapabilityReceipt(
  outcome: "requested" | "authorized" | "refused" | "completed",
  req: CapabilityInvocation,
  personaId: string | undefined,
  extra: Record<string, unknown>,
): Promise<void> {
  if (!personaId) return;
  await createActivityReceipt({
    personaId,
    activeCartridge: req.originatingSurface,
    actionType: CAPABILITY_RECEIPT_ACTION_TYPE[outcome],
    summary: `Capability invocation ${outcome} — '${req.capabilityId}' requested by '${req.requestingAgentId}'${req.orchestratorAgentId ? ` (orchestrated by '${req.orchestratorAgentId}')` : ''}`,
    agentsInvoked: [req.requestingAgentId, req.orchestratorAgentId, extra.resolvedProviderId as string | undefined].filter(
      (id): id is string => Boolean(id),
    ),
    actionInput: {
      invocationId: req.invocationId,
      principalRef: req.principalRef,
      originatingSurface: req.originatingSurface,
      capabilityId: req.capabilityId,
      executionMode: req.executionMode,
      delegationRef: req.delegationRef ?? null,
      policyBindingRefs: req.policyBindingRefs,
      delegationDepth: req.delegationDepth,
      ...extra,
    },
  }).catch(() => undefined); // best-effort — a receipt failure must never break the decision it describes
}

/**
 * Governed capability invocation — resolves `capabilityId` to its current
 * provider (never a caller-named agent directly), runs the depth/loop guard
 * and the three gates in the design doc's documented order, and returns a
 * decision. Never throws — a resolution/DB failure surfaces as a `refuse`
 * decision, consistent with `invokeAsset`'s fail-closed posture.
 *
 * `personaId` is the caller's already-resolved T0 persona id (from
 * `getActivePersona`) — used ONLY for receipt attribution, never part of the
 * envelope/decision returned. Optional so this function's own unit tests
 * (and any future caller that hasn't wired receipts yet) can omit it; the
 * decision logic is identical either way.
 */
export async function invokeCapability(req: CapabilityInvocation, personaId?: string): Promise<InvocationDecision> {
  await emitCapabilityReceipt("requested", req, personaId, {});

  const depthGuard = evaluateLoopAndDepthGuard(req);
  if (!depthGuard.ok) {
    await emitCapabilityReceipt("refused", req, personaId, { code: depthGuard.code, reason: depthGuard.reason });
    return { decision: "refuse", code: depthGuard.code, reason: depthGuard.reason };
  }

  const resolution = await resolveProviderForGates(req);
  if ("gate" in resolution) {
    await emitCapabilityReceipt("refused", req, personaId, { code: resolution.gate.code, reason: resolution.gate.reason });
    return { decision: "refuse", code: resolution.gate.code, reason: resolution.gate.reason };
  }
  const { provider } = resolution;

  // §6 — re-run the circular check now that the provider is known (the
  // pre-resolution pass in evaluateLoopAndDepthGuard could only catch a
  // caller naming itself; this catches the provider already being in path).
  if (req.invocationPath.includes(provider.providerAgentId)) {
    const refusal = { code: "CIRCULAR_INVOCATION", reason: `resolved provider '${provider.providerAgentId}' already appears in invocationPath` };
    await emitCapabilityReceipt("refused", req, personaId, refusal);
    return { decision: "refuse", ...refusal };
  }

  const identityGate = await evaluateIdentityAndAuthorityGate(req, provider);
  if (!identityGate.ok) {
    await emitCapabilityReceipt("refused", req, personaId, { code: identityGate.code, reason: identityGate.reason, registryAssetId: provider.registryAssetId });
    return { decision: "refuse", code: identityGate.code, reason: identityGate.reason };
  }

  const capabilityGate = evaluateCapabilityAndRuntimeGate(req, provider);
  if (!capabilityGate.ok) {
    await emitCapabilityReceipt("refused", req, personaId, { code: capabilityGate.code, reason: capabilityGate.reason, registryAssetId: provider.registryAssetId });
    return { decision: "refuse", code: capabilityGate.code, reason: capabilityGate.reason };
  }

  const policyGate = evaluatePolicyAndConsequenceGate(req);
  if (!policyGate.ok) {
    await emitCapabilityReceipt("refused", req, personaId, { code: policyGate.code, reason: policyGate.reason, registryAssetId: provider.registryAssetId });
    return { decision: "refuse", code: policyGate.code, reason: policyGate.reason };
  }

  // §5 — bounded context: echo exactly what was requested and why. No
  // per-capability "minimum required fields" declaration exists yet (design
  // doc §5's deeper mechanism), so today's honest bound is "only the refs the
  // caller explicitly named, nothing implicitly widened" — never the whole
  // parent conversation.
  const sharedContext = (req.contextRefs ?? []).map((ref) => ({
    ref,
    justification: `explicitly requested by originatingSurface '${req.originatingSurface}'`,
  }));

  await recordCapabilityInvocation(req, provider.registryAssetId, "authorized");
  await emitCapabilityReceipt("authorized", req, personaId, {
    registryAssetId: provider.registryAssetId,
    resolvedProviderId: provider.providerAgentId,
  });

  return {
    decision: "allow",
    envelope: {
      invocationId: req.invocationId,
      capabilityId: req.capabilityId,
      resolvedProviderId: provider.providerAgentId,
      resolvedRegistryAssetId: provider.registryAssetId,
      executionMode: req.executionMode,
      sharedContext,
    },
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
