import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { QubeTalkMessageRecord } from "../bridge-core/qubetalkHttpClient";

export interface RuntimeChannelMap {
  main: string;
  bridgeInbound: string;
  bridgeOutbound: string;
  openclawRequests: string;
  openclawResponses: string;
  router: string;
}

export async function loadRuntimeChannelMap(baseDir: string): Promise<RuntimeChannelMap | null> {
  const configured = {
    main: process.env.QT_CHANNEL_MAIN_ID,
    bridgeInbound: process.env.QT_CHANNEL_BRIDGE_INBOUND_ID,
    bridgeOutbound: process.env.QT_CHANNEL_BRIDGE_OUTBOUND_ID,
    openclawRequests: process.env.QT_CHANNEL_OPENCLAW_REQUESTS_ID,
    openclawResponses: process.env.QT_CHANNEL_OPENCLAW_RESPONSES_ID,
    router: process.env.QT_CHANNEL_ROUTER_ID,
  };
  if (Object.values(configured).every((value) => typeof value === "string" && value.length > 0)) {
    return configured as RuntimeChannelMap;
  }

  const mapPath = path.join(baseDir, ".data", "channel-map.json");
  try {
    const raw = await readFile(mapPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeChannelMap>;
    if (
      parsed.main &&
      parsed.bridgeInbound &&
      parsed.bridgeOutbound &&
      parsed.openclawRequests &&
      parsed.openclawResponses &&
      parsed.router
    ) {
      return parsed as RuntimeChannelMap;
    }
  } catch {
    return null;
  }

  return null;
}

export function messageCursor(messages: QubeTalkMessageRecord[], fallback?: string): string | undefined {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.length > 0 ? sorted[sorted.length - 1].created_at : fallback;
}

export async function loadRuntimeCursor(
  baseDir: string,
  cursorName: string
): Promise<string | undefined> {
  const cursorPath = path.join(baseDir, ".data", `${cursorName}.cursor`);
  try {
    const raw = await readFile(cursorPath, "utf8");
    const value = raw.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function saveRuntimeCursor(
  baseDir: string,
  cursorName: string,
  cursor: string
): Promise<void> {
  const cursorPath = path.join(baseDir, ".data", `${cursorName}.cursor`);
  await mkdir(path.dirname(cursorPath), { recursive: true });
  await writeFile(cursorPath, `${cursor}\n`, "utf8");
}
