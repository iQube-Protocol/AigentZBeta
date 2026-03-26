/**
 * Make.com Workflow Engine Adapter
 *
 * Implements the WorkflowEngineAdapter contract for Make.com (formerly Integromat).
 * A WorkflowEngineBinding for Make must have backendIds.scenarioId set and
 * the tenant must supply a Make API token via credentialPolicy or env vars.
 *
 * Env vars (fallback when credentialPolicy does not supply a token):
 *   MAKE_API_TOKEN    — personal / service account token
 *   MAKE_API_BASE_URL — defaults to https://us1.make.com/api/v2
 */

import {
  WorkflowEngineAdapter,
  WorkflowEngineBinding,
  AdapterInvokeResult,
  AdapterValidateResult,
  AdapterHealthResult,
} from "../bindingTypes";

const DEFAULT_BASE_URL = "https://us1.make.com/api/v2";

function resolveToken(binding: WorkflowEngineBinding): string {
  const fromPolicy = (binding.credentialPolicy as any)?.make_api_token as string | undefined;
  const fromEnv = process.env.MAKE_API_TOKEN;
  const token = fromPolicy || fromEnv;
  if (!token) throw new Error("Make API token not configured (set MAKE_API_TOKEN or binding credentialPolicy.make_api_token)");
  return token;
}

function resolveBaseUrl(binding: WorkflowEngineBinding): string {
  return (
    (binding.credentialPolicy as any)?.make_base_url ||
    process.env.MAKE_API_BASE_URL ||
    DEFAULT_BASE_URL
  );
}

function makeHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };
}

export const makeAdapter: WorkflowEngineAdapter = {
  engine: "make",

  async validate(binding: WorkflowEngineBinding): Promise<AdapterValidateResult> {
    const scenarioId = binding.backendIds?.scenarioId;
    if (!scenarioId) {
      return { valid: false, errors: ["backendIds.scenarioId is required for Make bindings"] };
    }
    try {
      const token = resolveToken(binding);
      const baseUrl = resolveBaseUrl(binding);
      const res = await fetch(`${baseUrl}/scenarios/${scenarioId}`, {
        headers: makeHeaders(token),
      });
      if (res.status === 200) return { valid: true };
      if (res.status === 404) return { valid: false, errors: [`Scenario ${scenarioId} not found in Make`] };
      return { valid: false, errors: [`Make returned HTTP ${res.status}`] };
    } catch (err: any) {
      return { valid: false, errors: [err?.message ?? "Validation request failed"] };
    }
  },

  async invoke(binding: WorkflowEngineBinding, input?: unknown): Promise<AdapterInvokeResult> {
    const scenarioId = binding.backendIds?.scenarioId;
    if (!scenarioId) {
      return { ok: false, error: "backendIds.scenarioId is required to invoke a Make scenario" };
    }
    try {
      const token = resolveToken(binding);
      const baseUrl = resolveBaseUrl(binding);
      const res = await fetch(`${baseUrl}/scenarios/${scenarioId}/run`, {
        method: "POST",
        headers: makeHeaders(token),
        body: JSON.stringify({ responsive: false, data: input ?? {} }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: (body as any)?.message ?? `Make returned HTTP ${res.status}` };
      }
      const executionId = (body as any)?.executionId ?? (body as any)?.data?.executionId;
      return { ok: true, executionId, output: body };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Make invoke failed" };
    }
  },

  async getStatus(binding: WorkflowEngineBinding, executionId: string): Promise<{ status: string; output?: unknown; error?: string }> {
    try {
      const token = resolveToken(binding);
      const baseUrl = resolveBaseUrl(binding);
      const res = await fetch(`${baseUrl}/scenarios/${binding.backendIds?.scenarioId}/executions/${executionId}`, {
        headers: makeHeaders(token),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { status: "unknown", error: `HTTP ${res.status}` };
      const status = (body as any)?.data?.status ?? "unknown";
      return { status, output: body };
    } catch (err: any) {
      return { status: "unknown", error: err?.message };
    }
  },

  async healthCheck(binding: WorkflowEngineBinding): Promise<AdapterHealthResult> {
    const start = Date.now();
    try {
      const token = resolveToken(binding);
      const baseUrl = resolveBaseUrl(binding);
      const res = await fetch(`${baseUrl}/scenarios/${binding.backendIds?.scenarioId ?? ""}`, {
        headers: makeHeaders(token),
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) return { state: "healthy", latencyMs };
      if (res.status === 401 || res.status === 403) return { state: "degraded", latencyMs, detail: "Auth error" };
      return { state: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    } catch (err: any) {
      return { state: "unreachable", latencyMs: Date.now() - start, detail: err?.message };
    }
  },

  normalizeOutput(raw: unknown): unknown {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    return r.data ?? r.output ?? raw;
  },
};
