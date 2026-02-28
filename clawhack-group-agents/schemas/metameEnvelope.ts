export type MetaMeEnvelopeType = "prompt" | "inference" | "iqube_ref" | "action" | "system";
export type MetaMeEnvelopeIntent =
  | "be"
  | "earn"
  | "play"
  | "make"
  | "share"
  | "wallet"
  | "task"
  | "reward"
  | "find"
  | "unknown";

export interface MetaMeRuntimeEnvelope {
  schema_version: "metame.envelope.v1";
  envelope_id: string;
  type: MetaMeEnvelopeType;
  intent: MetaMeEnvelopeIntent;
  thread: {
    channel_type: "runtime" | "group" | "dm" | "system";
    channel_id: string;
    thread_id: string;
  };
  sender: {
    agent_id?: string;
    persona_id?: string;
    display_name?: string;
    xmtp_inbox_id?: string;
    did?: string;
  };
  payload: {
    text?: string;
    iqube_refs?: string[];
    action?: {
      id: string;
      label?: string;
      params?: Record<string, unknown>;
    };
    inference?: {
      provider_id?: string;
      model_id?: string;
      content?: string;
    };
    data?: Record<string, unknown>;
  };
  meta: {
    source: "xmtp" | "qubetalk" | "runtime_shell" | "ios_app" | "server";
    timestamp: string;
    trust_score?: number;
    reliability_score?: number;
    device?: "mobile" | "tablet" | "desktop" | "unknown";
    request_id?: string;
    trace_id?: string;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isMetaMeRuntimeEnvelope(value: unknown): value is MetaMeRuntimeEnvelope {
  if (!isObject(value)) return false;
  if (value.schema_version !== "metame.envelope.v1") return false;
  if (typeof value.envelope_id !== "string" || !value.envelope_id) return false;
  if (typeof value.type !== "string" || !value.type) return false;
  if (typeof value.intent !== "string" || !value.intent) return false;
  if (!isObject(value.thread) || typeof value.thread.thread_id !== "string") return false;
  if (!isObject(value.sender)) return false;
  if (!isObject(value.payload)) return false;
  if (!isObject(value.meta) || typeof value.meta.timestamp !== "string") return false;
  return true;
}

export function parseMetaMeRuntimeEnvelope(value: unknown): MetaMeRuntimeEnvelope | null {
  return isMetaMeRuntimeEnvelope(value) ? value : null;
}

export function tryParseMetaMeRuntimeEnvelopeText(text: string): MetaMeRuntimeEnvelope | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parseMetaMeRuntimeEnvelope(parsed);
  } catch {
    return null;
  }
}

