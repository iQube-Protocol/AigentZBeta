import type { RegistryProvider, RegistrySnapshot, RegistryTool } from "./types";

interface RegistryClientConfig {
  endpoint: string;
  shelfId: string;
  includeFallbackTools?: boolean;
}

interface RegistryDocument {
  providers?: unknown;
  tools?: unknown;
  shelves?: unknown;
  tool_ids?: unknown;
}

const FALLBACK_PROVIDERS: RegistryProvider[] = [
  {
    provider_id: "prov_knyt_creator",
    name: "KNYT Creator Tools",
    connection: { type: "mcp", endpoint: "http://localhost:4011/mcp" },
  },
  {
    provider_id: "prov_dpr",
    name: "DPR Quality Gate",
    connection: { type: "mcp", endpoint: "http://localhost:4012/mcp" },
  },
  {
    provider_id: "prov_marketa",
    name: "Aigent Marketa",
    connection: { type: "mcp", endpoint: "http://localhost:4013/mcp" },
  },
  {
    provider_id: "prov_moltcomics",
    name: "MoltComics",
    connection: {
      type: "direct_api",
      endpoint:
        process.env.MOLTCOMICS_API_BASE_URL ||
        process.env.MOLTCOMICS_API_ENDPOINT ||
        "https://www.moltcomics.com",
      auth: {
        mode: "api_key",
        env_var: "MOLTCOMICS_API_KEY",
      },
    },
  },
];

const FALLBACK_TOOLS: RegistryTool[] = [
  {
    tool_id: "knyt.comic.generate_pack",
    provider_id: "prov_knyt_creator",
    name: "Generate KNYT Comic Pack",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 2, max_calls_per_thread: 4 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "knyt.animation.generate_pack",
    provider_id: "prov_knyt_creator",
    name: "Generate KNYT Animation Pack",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 1, max_calls_per_thread: 2 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "dpr.run",
    provider_id: "prov_dpr",
    name: "Run DPR",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 3, max_calls_per_thread: 6 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "marketa.copy.generate_pack",
    provider_id: "prov_marketa",
    name: "Generate Marketing Copy Pack",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 1, max_calls_per_thread: 2 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "moltcomics.story.create",
    provider_id: "prov_moltcomics",
    name: "Create MoltComics Story",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 1, max_calls_per_thread: 2 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "moltcomics.story.status",
    provider_id: "prov_moltcomics",
    name: "Get MoltComics Story Status",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 2, max_calls_per_thread: 4 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "moltcomics.panel.submit",
    provider_id: "prov_moltcomics",
    name: "Submit MoltComics Panel",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 2, max_calls_per_thread: 4 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "moltcomics.round.result",
    provider_id: "prov_moltcomics",
    name: "Get MoltComics Round Result",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 1, max_calls_per_thread: 2 },
      data_classification_max: "internal",
    },
  },
  {
    tool_id: "moltcomics.export.story",
    provider_id: "prov_moltcomics",
    name: "Export MoltComics Story",
    policy: {
      allowed_scopes: ["thread_only"],
      constraints: { max_calls_per_job: 1, max_calls_per_thread: 2 },
      data_classification_max: "internal",
    },
  },
];

const DEFAULT_SHELF_TOOL_IDS = new Set(FALLBACK_TOOLS.map((tool) => tool.tool_id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export class MCPRegistryClient {
  private config: Required<RegistryClientConfig>;

  constructor(config: RegistryClientConfig) {
    this.config = {
      includeFallbackTools: true,
      ...config,
    };
  }

  async loadSnapshot(): Promise<RegistrySnapshot> {
    const remoteDoc = await this.fetchRegistryDocument(this.config.endpoint);
    const remoteProviders = this.extractProviders(remoteDoc);
    const remoteTools = this.extractTools(remoteDoc);
    const shelfToolIds = this.extractShelfToolIds(remoteDoc, this.config.shelfId);

    const providerMap = new Map<string, RegistryProvider>();
    const toolMap = new Map<string, RegistryTool>();
    let source: "remote" | "fallback" = "remote";

    for (const provider of remoteProviders) {
      providerMap.set(provider.provider_id, provider);
    }

    for (const tool of remoteTools) {
      toolMap.set(tool.tool_id, tool);
    }

    if (providerMap.size === 0 && this.config.includeFallbackTools) {
      source = "fallback";
      for (const provider of FALLBACK_PROVIDERS) {
        providerMap.set(provider.provider_id, provider);
      }
    }

    if (toolMap.size === 0 && this.config.includeFallbackTools) {
      source = "fallback";
      for (const tool of FALLBACK_TOOLS) {
        toolMap.set(tool.tool_id, tool);
      }
    }

    if (this.config.includeFallbackTools) {
      for (const provider of FALLBACK_PROVIDERS) {
        if (!providerMap.has(provider.provider_id)) {
          providerMap.set(provider.provider_id, provider);
        }
      }
      for (const tool of FALLBACK_TOOLS) {
        if (!toolMap.has(tool.tool_id)) {
          toolMap.set(tool.tool_id, tool);
        }
      }
    }

    const allowedToolIds =
      shelfToolIds.size > 0
        ? shelfToolIds
        : this.config.includeFallbackTools
          ? DEFAULT_SHELF_TOOL_IDS
          : new Set(toolMap.keys());

    return {
      providersById: providerMap,
      toolsById: toolMap,
      allowedToolIds,
      shelfId: this.config.shelfId,
      source,
    };
  }

  private async fetchRegistryDocument(endpoint: string): Promise<RegistryDocument | null> {
    const baseDoc = await this.fetchJSON(endpoint);
    if (isRecord(baseDoc)) {
      return baseDoc as RegistryDocument;
    }

    const toolsDoc = await this.fetchJSON(`${endpoint.replace(/\/$/, "")}/tools`);
    const providersDoc = await this.fetchJSON(`${endpoint.replace(/\/$/, "")}/providers`);
    const shelvesDoc = await this.fetchJSON(`${endpoint.replace(/\/$/, "")}/shelves`);

    return {
      tools: toolsDoc,
      providers: providersDoc,
      shelves: shelvesDoc,
    };
  }

  private async fetchJSON(url: string): Promise<unknown> {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }

  private extractProviders(doc: RegistryDocument | null): RegistryProvider[] {
    if (!doc) return [];
    const providersRaw = asArray(doc.providers);
    const providers: RegistryProvider[] = [];

    for (const entry of providersRaw) {
      if (!isRecord(entry)) continue;
      const providerId = asString(entry.provider_id) ?? asString(entry.id);
      const name = asString(entry.name) ?? providerId;
      if (!providerId || !name) continue;

      const connectionRecord = isRecord(entry.connection) ? entry.connection : undefined;
      providers.push({
        provider_id: providerId,
        name,
        connection: connectionRecord
          ? {
              type: asString(connectionRecord.type),
              endpoint: asString(connectionRecord.endpoint),
            }
          : undefined,
      });
    }

    return providers;
  }

  private extractTools(doc: RegistryDocument | null): RegistryTool[] {
    if (!doc) return [];
    const toolsRaw = asArray(doc.tools);
    const tools: RegistryTool[] = [];

    for (const entry of toolsRaw) {
      if (!isRecord(entry)) continue;
      const toolId = asString(entry.tool_id) ?? asString(entry.id);
      const providerId = asString(entry.provider_id);
      if (!toolId || !providerId) continue;

      const policyRecord = isRecord(entry.policy) ? entry.policy : undefined;
      const constraints = isRecord(policyRecord?.constraints) ? policyRecord?.constraints : undefined;

      tools.push({
        tool_id: toolId,
        provider_id: providerId,
        name: asString(entry.name) ?? toolId,
        description: asString(entry.description),
        version: asString(entry.version),
        invoke_endpoint: asString(entry.invoke_endpoint),
        policy: policyRecord
          ? {
              risk_tier:
                typeof policyRecord.risk_tier === "number" ? policyRecord.risk_tier : undefined,
              requires_approval:
                typeof policyRecord.requires_approval === "boolean"
                  ? policyRecord.requires_approval
                  : undefined,
              allowed_scopes: asArray(policyRecord.allowed_scopes).filter(
                (scope): scope is "thread_only" | "global" =>
                  scope === "thread_only" || scope === "global"
              ),
              data_classification_max:
                policyRecord.data_classification_max === "public" ||
                policyRecord.data_classification_max === "internal" ||
                policyRecord.data_classification_max === "confidential" ||
                policyRecord.data_classification_max === "restricted"
                  ? policyRecord.data_classification_max
                  : undefined,
              constraints: constraints
                ? {
                    max_calls_per_job:
                      typeof constraints.max_calls_per_job === "number"
                        ? constraints.max_calls_per_job
                        : undefined,
                    max_calls_per_thread:
                      typeof constraints.max_calls_per_thread === "number"
                        ? constraints.max_calls_per_thread
                        : undefined,
                    max_image_bytes:
                      typeof constraints.max_image_bytes === "number"
                        ? constraints.max_image_bytes
                        : undefined,
                  }
                : undefined,
            }
          : undefined,
      });
    }

    return tools;
  }

  private extractShelfToolIds(doc: RegistryDocument | null, shelfId: string): Set<string> {
    const ids = new Set<string>();
    if (!doc) return ids;

    const explicitToolIds = asArray(doc.tool_ids);
    for (const rawId of explicitToolIds) {
      const parsed = asString(rawId);
      if (parsed) ids.add(parsed);
    }

    const shelves = asArray(doc.shelves);
    for (const entry of shelves) {
      if (!isRecord(entry)) continue;
      const id = asString(entry.shelf_id) ?? asString(entry.id);
      if (id !== shelfId) continue;
      const toolIds = asArray(entry.tool_ids);
      for (const rawToolId of toolIds) {
        const parsed = asString(rawToolId);
        if (parsed) ids.add(parsed);
      }
    }

    return ids;
  }
}
