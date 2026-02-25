import type { AARequestLog, RuntimeShellConfig } from "@metame/aa-client";

const STORAGE_KEY = "metame-runtime-shell:diagnostics:v1";

type BridgeLogDirection = "outbound" | "inbound" | "error";

export type BridgeLogEntry = {
  timestamp: string;
  direction: BridgeLogDirection;
  type: string;
  msg_id?: string;
  origin?: string;
  payload?: Record<string, unknown>;
  error?: string;
};

export type DiagnosticsSnapshot = {
  updatedAt: string;
  shellConfig: RuntimeShellConfig | null;
  aaLogs: AARequestLog[];
  bridgeLogs: BridgeLogEntry[];
};

const EMPTY_SNAPSHOT: DiagnosticsSnapshot = {
  updatedAt: new Date(0).toISOString(),
  shellConfig: null,
  aaLogs: [],
  bridgeLogs: [],
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readSnapshot(): DiagnosticsSnapshot {
  if (!canUseStorage()) return EMPTY_SNAPSHOT;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_SNAPSHOT;

  try {
    const parsed = JSON.parse(raw) as DiagnosticsSnapshot;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : EMPTY_SNAPSHOT.updatedAt,
      shellConfig: parsed.shellConfig ?? null,
      aaLogs: Array.isArray(parsed.aaLogs) ? parsed.aaLogs : [],
      bridgeLogs: Array.isArray(parsed.bridgeLogs) ? parsed.bridgeLogs : [],
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function writeSnapshot(snapshot: DiagnosticsSnapshot): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function limitRecent<T>(items: T[], max = 20): T[] {
  return items.slice(Math.max(items.length - max, 0));
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  return readSnapshot();
}

export function clearDiagnosticsSnapshot(): void {
  writeSnapshot({
    ...EMPTY_SNAPSHOT,
    updatedAt: new Date().toISOString(),
  });
}

export function setDiagnosticsShellConfig(shellConfig: RuntimeShellConfig | null): void {
  const snapshot = readSnapshot();
  writeSnapshot({
    ...snapshot,
    updatedAt: new Date().toISOString(),
    shellConfig,
  });
}

export function appendDiagnosticsAaLog(log: AARequestLog): void {
  const snapshot = readSnapshot();
  writeSnapshot({
    ...snapshot,
    updatedAt: new Date().toISOString(),
    aaLogs: limitRecent([...snapshot.aaLogs, log]),
  });
}

export function appendDiagnosticsBridgeLog(log: BridgeLogEntry): void {
  const snapshot = readSnapshot();
  writeSnapshot({
    ...snapshot,
    updatedAt: new Date().toISOString(),
    bridgeLogs: limitRecent([...snapshot.bridgeLogs, log]),
  });
}
