import type { IQubeType } from "@/types/registry";

export type LlmProviderId = "openai" | "venice" | "chaingpt" | "thirdweb";

export interface ActiveIQubeRecord {
  id: string;
  agentId: string;
  iQubeType: IQubeType;
  enabled: boolean;
  providerId: string;
  providerKind: "llm" | "mcp" | "wallet" | "storage" | "other";
  modelId?: string;
  modelLabel?: string;
}

export interface AgentModelOption {
  id: string;
  label: string;
  sourceIQubeId: string;
}

export interface AgentProviderOption {
  id: LlmProviderId;
  label: string;
  models: AgentModelOption[];
}

export interface AgentModelSelection {
  providerId: LlmProviderId;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  sourceIQubeId: string;
}

export type AgentLlmProviderMap = Record<string, AgentProviderOption[]>;

const LLM_PROVIDER_LABELS: Record<LlmProviderId, string> = {
  openai: "OpenAI",
  venice: "Venice AI",
  chaingpt: "ChainGPT",
  thirdweb: "ThirdWeb",
};

const LLM_PROVIDERS = new Set<LlmProviderId>(["openai", "venice", "chaingpt", "thirdweb"]);

export const RUNTIME_AGENT_IDS = [
  "aigent-z",
  "aigent-kn0w1",
  "aigent-moneypenny",
  "aigent-nakamoto",
  "aigent-marketa",
] as const;

const AGENT_ALIASES: Record<string, (typeof RUNTIME_AGENT_IDS)[number]> = {
  "aigent-z": "aigent-z",
  "aigent z": "aigent-z",
  copilot: "aigent-z",
  "aigent-kn0w1": "aigent-kn0w1",
  kn0w1: "aigent-kn0w1",
  know1: "aigent-kn0w1",
  "aigent-moneypenny": "aigent-moneypenny",
  moneypenny: "aigent-moneypenny",
  "aigent-nakamoto": "aigent-nakamoto",
  nakamoto: "aigent-nakamoto",
  "aigent-marketa": "aigent-marketa",
  marketa: "aigent-marketa",
};

function normalizeProviderId(raw?: string): LlmProviderId | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "venice" || normalized === "venice ai") return "venice";
  if (normalized === "chaingpt" || normalized === "chain gpt") return "chaingpt";
  if (normalized === "thirdweb" || normalized === "third web") return "thirdweb";
  return null;
}

export function normalizeAgentId(raw?: string): (typeof RUNTIME_AGENT_IDS)[number] | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return AGENT_ALIASES[normalized] || null;
}

function parseMetaExtras(metaExtras: unknown): Record<string, unknown> {
  if (!metaExtras) return {};
  if (Array.isArray(metaExtras)) {
    const map: Record<string, unknown> = {};
    for (const item of metaExtras) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const k = typeof record.k === "string" ? record.k : typeof record.key === "string" ? record.key : null;
      if (!k) continue;
      map[k] = record.v ?? record.value ?? null;
    }
    return map;
  }
  if (typeof metaExtras === "object") {
    return metaExtras as Record<string, unknown>;
  }
  return {};
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") {
    if (value.trim().startsWith("[") && value.trim().endsWith("]")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((entry): entry is string => typeof entry === "string");
      } catch {
        return [value];
      }
    }
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function pushModel(
  target: Map<LlmProviderId, Map<string, AgentModelOption>>,
  providerId: LlmProviderId,
  modelId: string,
  modelLabel: string,
  sourceIQubeId: string
) {
  if (!target.has(providerId)) target.set(providerId, new Map());
  const providerModels = target.get(providerId)!;
  if (!providerModels.has(modelId)) {
    providerModels.set(modelId, { id: modelId, label: modelLabel, sourceIQubeId });
  }
}

// Active iQube records attached to each orchestrator/agent.
// Only ModelQube + providerKind=llm are considered valid for runtime model switching.
const ACTIVE_IQUBES: ActiveIQubeRecord[] = [
  // Aigent Z
  { id: "iq_openai_gpt4o", agentId: "aigent-z", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o", modelLabel: "GPT-4o" },
  { id: "iq_openai_gpt4o_mini", agentId: "aigent-z", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o-mini", modelLabel: "GPT-4o Mini" },
  { id: "iq_venice_uncensored", agentId: "aigent-z", iQubeType: "ModelQube", enabled: true, providerId: "venice", providerKind: "llm", modelId: "venice-uncensored", modelLabel: "Venice Uncensored" },
  { id: "iq_chaingpt_general", agentId: "aigent-z", iQubeType: "ModelQube", enabled: true, providerId: "chaingpt", providerKind: "llm", modelId: "chaingpt-general", modelLabel: "ChainGPT General" },
  { id: "iq_thirdweb_llm", agentId: "aigent-z", iQubeType: "ModelQube", enabled: true, providerId: "thirdweb", providerKind: "llm", modelId: "thirdweb-web3-llm", modelLabel: "ThirdWeb Web3 LLM" },

  // Kn0w1
  { id: "iq_kn0w1_openai_gpt4o_mini", agentId: "aigent-kn0w1", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o-mini", modelLabel: "GPT-4o Mini" },
  { id: "iq_kn0w1_venice_reasoning", agentId: "aigent-kn0w1", iQubeType: "ModelQube", enabled: true, providerId: "venice", providerKind: "llm", modelId: "venice-reasoning", modelLabel: "Venice Reasoning" },
  { id: "iq_kn0w1_google_drive", agentId: "aigent-kn0w1", iQubeType: "ToolQube", enabled: true, providerId: "google", providerKind: "mcp" },

  // MoneyPenny
  { id: "iq_mp_openai_gpt4o_mini", agentId: "aigent-moneypenny", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o-mini", modelLabel: "GPT-4o Mini" },
  { id: "iq_mp_chaingpt_crypto", agentId: "aigent-moneypenny", iQubeType: "ModelQube", enabled: true, providerId: "chaingpt", providerKind: "llm", modelId: "chaingpt-crypto", modelLabel: "ChainGPT Crypto" },
  { id: "iq_mp_google_workspace", agentId: "aigent-moneypenny", iQubeType: "ToolQube", enabled: true, providerId: "google", providerKind: "mcp" },

  // Nakamoto
  { id: "iq_nak_openai_gpt4o", agentId: "aigent-nakamoto", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o", modelLabel: "GPT-4o" },
  { id: "iq_nak_openai_gpt4o_mini", agentId: "aigent-nakamoto", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o-mini", modelLabel: "GPT-4o Mini" },
  { id: "iq_nak_venice_uncensored", agentId: "aigent-nakamoto", iQubeType: "ModelQube", enabled: true, providerId: "venice", providerKind: "llm", modelId: "venice-uncensored", modelLabel: "Venice Uncensored" },
  { id: "iq_nak_venice_reasoning", agentId: "aigent-nakamoto", iQubeType: "ModelQube", enabled: true, providerId: "venice", providerKind: "llm", modelId: "venice-reasoning", modelLabel: "Venice Reasoning" },
  { id: "iq_nak_chaingpt_general", agentId: "aigent-nakamoto", iQubeType: "ModelQube", enabled: true, providerId: "chaingpt", providerKind: "llm", modelId: "chaingpt-general", modelLabel: "ChainGPT General" },
  { id: "iq_nak_chaingpt_code", agentId: "aigent-nakamoto", iQubeType: "ModelQube", enabled: true, providerId: "chaingpt", providerKind: "llm", modelId: "chaingpt-code", modelLabel: "ChainGPT Code" },
  { id: "iq_nak_drive_connector", agentId: "aigent-nakamoto", iQubeType: "ToolQube", enabled: true, providerId: "google", providerKind: "mcp" },

  // Marketa
  { id: "iq_marketa_openai_gpt4o_mini", agentId: "aigent-marketa", iQubeType: "ModelQube", enabled: true, providerId: "openai", providerKind: "llm", modelId: "gpt-4o-mini", modelLabel: "GPT-4o Mini" },
  { id: "iq_marketa_thirdweb_llm", agentId: "aigent-marketa", iQubeType: "ModelQube", enabled: true, providerId: "thirdweb", providerKind: "llm", modelId: "thirdweb-web3-llm", modelLabel: "ThirdWeb Web3 LLM" },
  { id: "iq_marketa_gdrive", agentId: "aigent-marketa", iQubeType: "ToolQube", enabled: true, providerId: "google", providerKind: "mcp" },
];

function isLlmModelIQube(record: ActiveIQubeRecord): record is ActiveIQubeRecord & { providerId: LlmProviderId } {
  return (
    record.enabled &&
    record.iQubeType === "ModelQube" &&
    record.providerKind === "llm" &&
    LLM_PROVIDERS.has(record.providerId as LlmProviderId)
  );
}

export function getAgentLlmProviders(agentId: string): AgentProviderOption[] {
  const modelQubes = ACTIVE_IQUBES.filter((record) => record.agentId === agentId).filter(isLlmModelIQube);
  const grouped = new Map<LlmProviderId, Map<string, AgentModelOption>>();

  for (const qube of modelQubes) {
    const providerId = qube.providerId as LlmProviderId;
    if (!grouped.has(providerId)) grouped.set(providerId, new Map());
    const modelId = qube.modelId || "default";
    const modelLabel = qube.modelLabel || modelId;
    const providerModels = grouped.get(providerId)!;
    if (!providerModels.has(modelId)) {
      providerModels.set(modelId, {
        id: modelId,
        label: modelLabel,
        sourceIQubeId: qube.id,
      });
    }
  }

  return Array.from(grouped.entries()).map(([providerId, modelsMap]) => ({
    id: providerId,
    label: LLM_PROVIDER_LABELS[providerId],
    models: Array.from(modelsMap.values()),
  }));
}

export function getAllAgentLlmProviders(agentIds: string[]) {
  const result: Record<string, AgentProviderOption[]> = {};
  for (const id of agentIds) {
    result[id] = getAgentLlmProviders(id);
  }
  return result;
}

export function getStaticAgentLlmProviders(): AgentLlmProviderMap {
  return getAllAgentLlmProviders([...RUNTIME_AGENT_IDS]);
}

export function buildProviderMapFromModelIQubes(iQubes: any[]): AgentLlmProviderMap {
  const result: AgentLlmProviderMap = {};
  for (const agentId of RUNTIME_AGENT_IDS) result[agentId] = [];
  const grouped: Record<string, Map<LlmProviderId, Map<string, AgentModelOption>>> = {};
  for (const agentId of RUNTIME_AGENT_IDS) grouped[agentId] = new Map();

  for (const iQube of iQubes || []) {
    const row = iQube as Record<string, unknown>;
    const enabled = row.enabled !== false && row.active !== false && row.status !== "disabled";
    if (!enabled) continue;
    const typeValue = typeof row.iqube_type === "string" ? row.iqube_type : typeof row.iQubeType === "string" ? row.iQubeType : "";
    if (String(typeValue).toLowerCase() !== "modelqube") continue;

    const meta = parseMetaExtras(row.metaqube_extras ?? row.metaExtras);
    const providerCandidate =
      (typeof row.provider_id === "string" ? row.provider_id : null) ||
      (typeof row.provider === "string" ? row.provider : null) ||
      (typeof row.llm_provider === "string" ? row.llm_provider : null) ||
      (typeof meta.provider === "string" ? meta.provider : null) ||
      (typeof meta.providerId === "string" ? meta.providerId : null) ||
      (typeof meta.llmProvider === "string" ? meta.llmProvider : null);
    const providerId = normalizeProviderId(providerCandidate || undefined);
    if (!providerId) continue;

    const providerKind =
      (typeof row.provider_kind === "string" ? row.provider_kind : null) ||
      (typeof meta.providerKind === "string" ? meta.providerKind : null);
    if (providerKind && String(providerKind).toLowerCase() !== "llm") continue;

    const rawAgentIds = [
      ...(toStringArray(row.agent_ids)),
      ...(toStringArray(row.assigned_agents)),
      ...(toStringArray(meta.agentIds)),
      ...(toStringArray(meta.assignedAgents)),
      ...(toStringArray(meta.orchestrators)),
      ...(typeof row.agent_id === "string" ? [row.agent_id] : []),
      ...(typeof row.agentId === "string" ? [row.agentId] : []),
      ...(typeof row.orchestrator_id === "string" ? [row.orchestrator_id] : []),
      ...(typeof row.orchestratorId === "string" ? [row.orchestratorId] : []),
      ...(typeof meta.agentId === "string" ? [meta.agentId] : []),
      ...(typeof meta.orchestratorId === "string" ? [meta.orchestratorId] : []),
    ];
    const normalizedAgentIds = rawAgentIds
      .map((entry) => normalizeAgentId(entry))
      .filter((entry): entry is (typeof RUNTIME_AGENT_IDS)[number] => Boolean(entry));
    if (normalizedAgentIds.length === 0) continue;

    const sourceIQubeId = String(row.id || `${providerId}-${Date.now()}`);
    const modelRows = Array.isArray(meta.models) ? meta.models : null;
    const directModelId =
      (typeof row.model_id === "string" ? row.model_id : null) ||
      (typeof row.model === "string" ? row.model : null) ||
      (typeof row.model_name === "string" ? row.model_name : null) ||
      (typeof meta.modelId === "string" ? meta.modelId : null) ||
      (typeof meta.model === "string" ? meta.model : null) ||
      (typeof meta.modelName === "string" ? meta.modelName : null);
    const directModelLabel =
      (typeof row.model_label === "string" ? row.model_label : null) ||
      (typeof meta.modelLabel === "string" ? meta.modelLabel : null) ||
      directModelId;

    const models: Array<{ id: string; label: string }> = [];
    if (modelRows) {
      for (const item of modelRows) {
        if (typeof item === "string") {
          models.push({ id: item, label: item });
        } else if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          const id = typeof rec.id === "string" ? rec.id : typeof rec.modelId === "string" ? rec.modelId : null;
          if (!id) continue;
          const label = typeof rec.label === "string" ? rec.label : typeof rec.modelLabel === "string" ? rec.modelLabel : id;
          models.push({ id, label });
        }
      }
    }
    if (models.length === 0) {
      const fallbackModelId = directModelId || "default";
      const fallbackModelLabel = directModelLabel || fallbackModelId;
      models.push({ id: fallbackModelId, label: fallbackModelLabel });
    }

    for (const agentId of normalizedAgentIds) {
      for (const model of models) {
        pushModel(grouped[agentId], providerId, model.id, model.label, sourceIQubeId);
      }
    }
  }

  for (const agentId of RUNTIME_AGENT_IDS) {
    result[agentId] = Array.from(grouped[agentId].entries()).map(([providerId, modelsMap]) => ({
      id: providerId,
      label: LLM_PROVIDER_LABELS[providerId],
      models: Array.from(modelsMap.values()),
    }));
  }

  return result;
}

export function getDefaultAgentModelSelection(agentId: string): AgentModelSelection | null {
  const providers = getAgentLlmProviders(agentId);
  const provider = providers[0];
  const model = provider?.models?.[0];
  if (!provider || !model) return null;
  return {
    providerId: provider.id,
    providerLabel: provider.label,
    modelId: model.id,
    modelLabel: model.label,
    sourceIQubeId: model.sourceIQubeId,
  };
}
