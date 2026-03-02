import type { CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";

export const CODEX_CLOSE_LAYER_TYPE = "METAME_CODEX_CLOSE_LAYER";
export const CODEX_PANEL_MESSAGE_PREFIX = "capsule-launch-codex-";

export function normalizeCodexId(raw: string | null | undefined): string | null {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return null;
  return value.endsWith("-codex") ? value : `${value}-codex`;
}

export function buildLaunchMessageId(input: { runtimeSource: string; runtimeCodexSlug?: string | null }, now = Date.now()): string {
  if (input.runtimeSource === "codex") {
    const codexId = normalizeCodexId(input.runtimeCodexSlug) || "unknown-codex";
    return `${CODEX_PANEL_MESSAGE_PREFIX}${codexId}-${now}`;
  }
  return `capsule-launch-${now}`;
}

type ClosePayload = { type?: unknown; codex_id?: unknown; codexId?: unknown; codex_slug?: unknown; codexSlug?: unknown };

export function readCodexClose(data: unknown): { isClose: boolean; codexId: string | null } {
  if (typeof data === "string") {
    return { isClose: data === CODEX_CLOSE_LAYER_TYPE, codexId: null };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { isClose: false, codexId: null };
  }
  const payload = data as ClosePayload;
  if (payload.type !== CODEX_CLOSE_LAYER_TYPE) {
    return { isClose: false, codexId: null };
  }
  const raw =
    (typeof payload.codex_id === "string" && payload.codex_id) ||
    (typeof payload.codexId === "string" && payload.codexId) ||
    (typeof payload.codex_slug === "string" && payload.codex_slug) ||
    (typeof payload.codexSlug === "string" && payload.codexSlug) ||
    null;
  return { isClose: true, codexId: normalizeCodexId(raw) };
}

export function shouldDismissForCodexClose(message: Pick<CopilotMessage, "id" | "variant">, codexId: string | null): boolean {
  if (message.variant !== "panel") return false;
  if (!message.id.startsWith(CODEX_PANEL_MESSAGE_PREFIX)) return false;
  if (!codexId) return true;
  return message.id.startsWith(`${CODEX_PANEL_MESSAGE_PREFIX}${codexId}-`);
}
