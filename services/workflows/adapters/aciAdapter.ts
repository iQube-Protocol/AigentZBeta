/**
 * ACI (Agent-Computer Interface) Workflow Engine Adapter — stub
 *
 * Placeholder for the ACI execution engine. All methods return graceful
 * not-implemented responses until the ACI API contract is finalised.
 *
 * Expected backendIds:
 *   agentId    — ACI agent identifier
 *   taskType   — ACI task category
 *
 * Env vars (to be configured when ACI is integrated):
 *   ACI_BASE_URL  — ACI service base URL
 *   ACI_API_KEY   — ACI service API key
 */

import {
  WorkflowEngineAdapter,
  WorkflowEngineBinding,
  AdapterInvokeResult,
  AdapterValidateResult,
  AdapterHealthResult,
} from "../bindingTypes";

export const aciAdapter: WorkflowEngineAdapter = {
  engine: "aci",

  async validate(_binding: WorkflowEngineBinding): Promise<AdapterValidateResult> {
    const hasConfig = !!(process.env.ACI_BASE_URL && process.env.ACI_API_KEY);
    if (!hasConfig) {
      return { valid: false, errors: ["ACI_BASE_URL and ACI_API_KEY are not configured — ACI adapter is a stub"] };
    }
    return { valid: true };
  },

  async invoke(_binding: WorkflowEngineBinding, _input?: unknown): Promise<AdapterInvokeResult> {
    return {
      ok: false,
      error: "ACI adapter is not yet implemented. Configure ACI_BASE_URL and ACI_API_KEY when ready.",
    };
  },

  async healthCheck(_binding: WorkflowEngineBinding): Promise<AdapterHealthResult> {
    const baseUrl = process.env.ACI_BASE_URL;
    if (!baseUrl) return { state: "unreachable", detail: "ACI_BASE_URL not configured" };
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(4000) });
      const latencyMs = Date.now() - start;
      return res.ok
        ? { state: "healthy", latencyMs }
        : { state: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    } catch (err: any) {
      return { state: "unreachable", latencyMs: Date.now() - start, detail: err?.message };
    }
  },

  normalizeOutput(raw: unknown): unknown {
    return raw;
  },
};
