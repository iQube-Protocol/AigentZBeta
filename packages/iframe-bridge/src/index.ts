export type ShellOutboundType =
  | "SHELL_READY"
  | "HANDOFF"
  | "MENU_ACTION"
  | "SELECTOR_CHANGE"
  | "CONTEXT_UPDATE"
  | "PROMPT_SUBMIT"
  | "RESET_WELCOME"
  | "DEVICE_CONTEXT_UPDATE";

export type RuntimeInboundType =
  | "RUNTIME_READY"
  | "NAVIGATE"
  | "REQUEST_TRUST_REFRESH"
  | "TOAST"
  | "OPEN_CAPSULE"
  | "WELCOME_COMPLETE"
  | "STATE_SYNC"
  | "TRUST_UPDATE";

export type BridgeSource = "shell" | "runtime";

export type BridgeMessage<TType extends string = string, TPayload = Record<string, unknown>> = {
  type: TType;
  msg_id: string;
  timestamp: string;
  source: BridgeSource;
  tenant_id?: string;
  persona_id?: string;
  payload: TPayload;
};

export type ShellOutboundMessage = BridgeMessage<ShellOutboundType>;
export type RuntimeInboundMessage = BridgeMessage<RuntimeInboundType>;
export type RuntimeOutboundMessage = BridgeMessage<RuntimeInboundType>;
export type ShellInboundMessage = BridgeMessage<ShellOutboundType>;

export type BridgeContext = {
  tenant_id?: string;
  persona_id?: string;
};

function createMessageId(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) return randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createShellMessage<TPayload extends Record<string, unknown>>(
  type: ShellOutboundType,
  payload: TPayload,
  context: BridgeContext = {}
): ShellOutboundMessage {
  return {
    type,
    msg_id: createMessageId(),
    timestamp: new Date().toISOString(),
    source: "shell",
    tenant_id: context.tenant_id,
    persona_id: context.persona_id,
    payload,
  };
}

export function createRuntimeMessage<TPayload extends Record<string, unknown>>(
  type: RuntimeInboundType,
  payload: TPayload,
  context: BridgeContext = {}
): RuntimeOutboundMessage {
  return {
    type,
    msg_id: createMessageId(),
    timestamp: new Date().toISOString(),
    source: "runtime",
    tenant_id: context.tenant_id,
    persona_id: context.persona_id,
    payload,
  };
}

export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.type === "string" &&
    typeof value.msg_id === "string" &&
    (typeof value.timestamp === "string" || typeof value.timestamp === "number") &&
    typeof value.source === "string" &&
    isObject(value.payload)
  );
}

export function isRuntimeInboundMessage(value: unknown): value is RuntimeInboundMessage {
  if (!isBridgeMessage(value)) return false;
  const runtimeTypes: RuntimeInboundType[] = [
    "RUNTIME_READY",
    "NAVIGATE",
    "REQUEST_TRUST_REFRESH",
    "TOAST",
    "OPEN_CAPSULE",
    "WELCOME_COMPLETE",
    "STATE_SYNC",
    "TRUST_UPDATE",
  ];
  return runtimeTypes.includes(value.type as RuntimeInboundType);
}

export function isShellOutboundMessage(value: unknown): value is ShellInboundMessage {
  if (!isBridgeMessage(value)) return false;
  const shellTypes: ShellOutboundType[] = [
    "SHELL_READY",
    "HANDOFF",
    "MENU_ACTION",
    "SELECTOR_CHANGE",
    "CONTEXT_UPDATE",
    "PROMPT_SUBMIT",
    "RESET_WELCOME",
    "DEVICE_CONTEXT_UPDATE",
  ];
  return shellTypes.includes(value.type as ShellOutboundType);
}

export function validateOrigin(origin: string, allowedOrigin: string): boolean {
  if (!allowedOrigin) return false;
  return origin === allowedOrigin;
}

export function postShellMessage(targetWindow: Window, allowedOrigin: string, message: ShellOutboundMessage): void {
  if (!allowedOrigin) {
    throw new Error("Cannot post shell message without an allowed runtime origin");
  }

  targetWindow.postMessage(message, allowedOrigin);
}

export function postRuntimeMessage(targetWindow: Window, allowedOrigin: string, message: RuntimeOutboundMessage): void {
  if (!allowedOrigin) {
    throw new Error("Cannot post runtime message without an allowed shell origin");
  }

  targetWindow.postMessage(message, allowedOrigin);
}
