/**
 * n8n Workflow Engine Adapter
 *
 * Implements the WorkflowEngineAdapter contract for n8n (self-hosted or cloud).
 * A WorkflowEngineBinding for n8n must have backendIds.webhookPath set.
 * For status polling, backendIds.workflowId is also required.
 *
 * Env vars (fallback when credentialPolicy does not supply values):
 *   N8N_BASE_URL    — e.g. https://n8n.example.com
 *   N8N_API_KEY     — n8n API key for status/cancel calls
 */

import {
  WorkflowEngineAdapter,
  WorkflowEngineBinding,
  AdapterInvokeResult,
  AdapterValidateResult,
  AdapterHealthResult,
} from "../bindingTypes";

function resolveBaseUrl(binding: WorkflowEngineBinding): string {
  return (
    (binding.credentialPolicy as any)?.n8n_base_url ||
    process.env.N8N_BASE_URL ||
    ""
  );
}

function resolveApiKey(binding: WorkflowEngineBinding): string | undefined {
  return (
    (binding.credentialPolicy as any)?.n8n_api_key ||
    process.env.N8N_API_KEY
  );
}

function apiHeaders(binding: WorkflowEngineBinding): Record<string, string> {
  const key = resolveApiKey(binding);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-N8N-API-KEY"] = key;
  return headers;
}

export const n8nAdapter: WorkflowEngineAdapter = {
  engine: "n8n",

  async validate(binding: WorkflowEngineBinding): Promise<AdapterValidateResult> {
    const webhookPath = binding.backendIds?.webhookPath;
    if (!webhookPath) {
      return { valid: false, errors: ["backendIds.webhookPath is required for n8n bindings"] };
    }
    const baseUrl = resolveBaseUrl(binding);
    if (!baseUrl) {
      return { valid: false, errors: ["N8N_BASE_URL not configured"] };
    }
    // Basic reachability check against the n8n healthz endpoint
    try {
      const res = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return { valid: true };
      return { valid: false, errors: [`n8n healthz returned HTTP ${res.status}`] };
    } catch (err: any) {
      return { valid: false, errors: [err?.message ?? "n8n reachability check failed"] };
    }
  },

  async invoke(binding: WorkflowEngineBinding, input?: unknown): Promise<AdapterInvokeResult> {
    const webhookPath = binding.backendIds?.webhookPath;
    const baseUrl = resolveBaseUrl(binding);
    if (!webhookPath || !baseUrl) {
      return { ok: false, error: "backendIds.webhookPath and N8N_BASE_URL are required to invoke an n8n workflow" };
    }
    try {
      const url = `${baseUrl}/${webhookPath.replace(/^\//, "")}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: (body as any)?.message ?? `n8n webhook returned HTTP ${res.status}` };
      }
      // n8n webhook responses don't return a stable execution ID unless the workflow
      // returns one explicitly — surface whatever is in the response body.
      const executionId = (body as any)?.executionId ?? (body as any)?.data?.executionId;
      return { ok: true, executionId, output: body };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "n8n invoke failed" };
    }
  },

  async getStatus(binding: WorkflowEngineBinding, executionId: string): Promise<{ status: string; output?: unknown; error?: string }> {
    const baseUrl = resolveBaseUrl(binding);
    if (!baseUrl) return { status: "unknown", error: "N8N_BASE_URL not configured" };
    try {
      const res = await fetch(`${baseUrl}/api/v1/executions/${executionId}`, {
        headers: apiHeaders(binding),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { status: "unknown", error: `HTTP ${res.status}` };
      const status = (body as any)?.data?.status ?? (body as any)?.status ?? "unknown";
      return { status, output: body };
    } catch (err: any) {
      return { status: "unknown", error: err?.message };
    }
  },

  async cancel(binding: WorkflowEngineBinding, executionId: string): Promise<{ ok: boolean; error?: string }> {
    const baseUrl = resolveBaseUrl(binding);
    if (!baseUrl) return { ok: false, error: "N8N_BASE_URL not configured" };
    try {
      const res = await fetch(`${baseUrl}/api/v1/executions/${executionId}/stop`, {
        method: "POST",
        headers: apiHeaders(binding),
      });
      return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  },

  async healthCheck(binding: WorkflowEngineBinding): Promise<AdapterHealthResult> {
    const baseUrl = resolveBaseUrl(binding);
    if (!baseUrl) return { state: "unreachable", detail: "N8N_BASE_URL not configured" };
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/healthz`, {
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) return { state: "healthy", latencyMs };
      return { state: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    } catch (err: any) {
      return { state: "unreachable", latencyMs: Date.now() - start, detail: err?.message };
    }
  },

  normalizeOutput(raw: unknown): unknown {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    return r.data ?? r.output ?? r.body ?? raw;
  },
};
