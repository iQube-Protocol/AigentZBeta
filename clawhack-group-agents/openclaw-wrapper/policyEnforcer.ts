import type { DataClassification } from "../schemas/bridgeEvents";
import type { RegistryTool, ToolInvocationContext } from "./types";

interface ToolPolicyEnforcerConfig {
  allowlistEnabled?: boolean;
  threadWindowMs?: number;
}

interface PolicyContext extends ToolInvocationContext {
  allowedToolIds: Set<string>;
}

const CLASSIFICATION_RANK: Record<DataClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export class ToolPolicyEnforcer {
  private config: Required<ToolPolicyEnforcerConfig>;
  private callsByRequestAndTool: Map<string, Map<string, number>> = new Map();
  private callsByThreadAndTool: Map<string, Map<string, { count: number; lastUpdatedMs: number }>> =
    new Map();

  constructor(config: ToolPolicyEnforcerConfig = {}) {
    this.config = {
      allowlistEnabled: true,
      threadWindowMs: 30 * 60 * 1000,
      ...config,
    };
  }

  assertCanInvoke(toolId: string, tool: RegistryTool, context: PolicyContext): void {
    if (this.config.allowlistEnabled && !context.allowedToolIds.has(toolId)) {
      throw new Error(`Tool ${toolId} is outside the curated shelf allowlist`);
    }

    if (tool.policy?.requires_approval) {
      throw new Error(`Tool ${toolId} requires approval and cannot auto-run`);
    }

    const allowedScopes = tool.policy?.allowed_scopes ?? [];
    if (allowedScopes.length > 0 && !allowedScopes.includes(context.scope)) {
      throw new Error(`Tool ${toolId} does not allow scope ${context.scope}`);
    }

    if (tool.policy?.data_classification_max) {
      const requestedRank = CLASSIFICATION_RANK[context.dataClassification];
      const maxRank = CLASSIFICATION_RANK[tool.policy.data_classification_max];
      if (requestedRank > maxRank) {
        throw new Error(
          `Tool ${toolId} classification cap exceeded (${context.dataClassification} > ${tool.policy.data_classification_max})`
        );
      }
    }

    const requestToolMap = this.callsByRequestAndTool.get(context.requestId) ?? new Map<string, number>();
    const currentJobCalls = requestToolMap.get(toolId) ?? 0;
    const maxCallsPerJob = tool.policy?.constraints?.max_calls_per_job;
    if (typeof maxCallsPerJob === "number" && currentJobCalls >= maxCallsPerJob) {
      throw new Error(`Tool ${toolId} max_calls_per_job exceeded (${maxCallsPerJob})`);
    }

    const threadToolMap = this.callsByThreadAndTool.get(context.threadKey) ?? new Map<string, { count: number; lastUpdatedMs: number }>();
    const currentThreadToolMeta = threadToolMap.get(toolId);
    const now = Date.now();
    const currentThreadToolCalls =
      currentThreadToolMeta && now - currentThreadToolMeta.lastUpdatedMs < this.config.threadWindowMs
        ? currentThreadToolMeta.count
        : 0;
    const maxCallsPerThread = tool.policy?.constraints?.max_calls_per_thread;
    if (typeof maxCallsPerThread === "number" && currentThreadToolCalls >= maxCallsPerThread) {
      throw new Error(`Tool ${toolId} max_calls_per_thread exceeded (${maxCallsPerThread})`);
    }
  }

  registerInvocation(toolId: string, context: ToolInvocationContext): void {
    const requestToolMap = this.callsByRequestAndTool.get(context.requestId) ?? new Map<string, number>();
    requestToolMap.set(toolId, (requestToolMap.get(toolId) ?? 0) + 1);
    this.callsByRequestAndTool.set(context.requestId, requestToolMap);

    const threadToolMap =
      this.callsByThreadAndTool.get(context.threadKey) ??
      new Map<string, { count: number; lastUpdatedMs: number }>();
    const now = Date.now();
    const currentThreadMeta = threadToolMap.get(toolId);
    const nextCount =
      currentThreadMeta && now - currentThreadMeta.lastUpdatedMs < this.config.threadWindowMs
        ? currentThreadMeta.count + 1
        : 1;
    threadToolMap.set(toolId, { count: nextCount, lastUpdatedMs: now });
    this.callsByThreadAndTool.set(context.threadKey, threadToolMap);
  }

  resetRequest(requestId: string): void {
    this.callsByRequestAndTool.delete(requestId);
  }
}
