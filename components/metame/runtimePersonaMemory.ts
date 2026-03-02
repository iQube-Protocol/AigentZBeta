"use client";

export type RuntimePersonaMemoryEntry = {
  id: string;
  prompt: string;
  inference: string;
  intent: string;
  source: string;
  createdAt: string;
  welcomePrompt: boolean;
  device?: string;
  capsuleId?: string | null;
};

type RuntimePersonaMemoryStore = Record<string, RuntimePersonaMemoryEntry[]>;

const STORAGE_KEY = "metame.runtime.persona.memory.v1";
const ENTRY_LIMIT = 40;

function normalizeEntry(value: unknown): RuntimePersonaMemoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<RuntimePersonaMemoryEntry>;
  if (typeof entry.id !== "string") return null;
  if (typeof entry.prompt !== "string") return null;
  if (typeof entry.inference !== "string") return null;
  if (typeof entry.intent !== "string") return null;
  if (typeof entry.source !== "string") return null;
  if (typeof entry.createdAt !== "string") return null;
  if (typeof entry.welcomePrompt !== "boolean") return null;

  return {
    id: entry.id,
    prompt: entry.prompt,
    inference: entry.inference,
    intent: entry.intent,
    source: entry.source,
    createdAt: entry.createdAt,
    welcomePrompt: entry.welcomePrompt,
    device: typeof entry.device === "string" ? entry.device : undefined,
    capsuleId: typeof entry.capsuleId === "string" ? entry.capsuleId : null,
  };
}

function readStore(): RuntimePersonaMemoryStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const normalized: RuntimePersonaMemoryStore = {};
    for (const [personaKey, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof personaKey !== "string" || !Array.isArray(value)) continue;
      const entries = value
        .map((item) => normalizeEntry(item))
        .filter((item): item is RuntimePersonaMemoryEntry => item !== null)
        .slice(0, ENTRY_LIMIT);
      if (entries.length > 0) {
        normalized[personaKey] = entries;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeStore(store: RuntimePersonaMemoryStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write failures and keep runtime functional.
  }
}

export function readRuntimePersonaMemoryEntries(personaKey: string): RuntimePersonaMemoryEntry[] {
  if (!personaKey) return [];
  const store = readStore();
  return store[personaKey]?.slice(0, ENTRY_LIMIT) ?? [];
}

export function appendRuntimePersonaMemoryEntry(
  personaKey: string,
  entry: Omit<RuntimePersonaMemoryEntry, "id" | "createdAt">
): RuntimePersonaMemoryEntry[] {
  if (!personaKey) return [];
  const nextEntry: RuntimePersonaMemoryEntry = {
    id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    prompt: entry.prompt.trim(),
    inference: entry.inference.trim(),
    intent: entry.intent,
    source: entry.source,
    welcomePrompt: entry.welcomePrompt,
    device: entry.device,
    capsuleId: entry.capsuleId ?? null,
  };

  if (!nextEntry.prompt) return readRuntimePersonaMemoryEntries(personaKey);
  if (!nextEntry.inference) return readRuntimePersonaMemoryEntries(personaKey);

  const store = readStore();
  const existing = store[personaKey] ?? [];
  const updated = [nextEntry, ...existing].slice(0, ENTRY_LIMIT);
  store[personaKey] = updated;
  writeStore(store);
  return updated;
}
