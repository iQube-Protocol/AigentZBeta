/**
 * openclawCore — module-local tool registry.
 *
 * Modules register tools at import time via `registerTool()`. The
 * adapter resolves them at execute time via `getTool()`. Adding a new
 * tool is a single `registerTool({ ... })` call in a new file —
 * the adapter doesn't change.
 *
 * Registry is module-scoped (not request-scoped) — tools are pure
 * code, registered once at process start. Concurrent requests share
 * the same handler instances.
 */

import type { OpenClawTool } from './types';

const REGISTRY = new Map<string, OpenClawTool>();

export function registerTool(tool: OpenClawTool): void {
  if (REGISTRY.has(tool.name)) {
    // Re-registration is a programmer error. Throw loudly in dev;
    // overwrite silently in prod so a hot-reload doesn't crash the
    // worker.
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`openclawCore: tool '${tool.name}' already registered`);
    }
  }
  REGISTRY.set(tool.name, tool);
}

export function getTool(name: string): OpenClawTool | null {
  return REGISTRY.get(name) ?? null;
}

export function listTools(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}

export function listToolDescriptions(): Array<{ name: string; description: string }> {
  return Array.from(REGISTRY.values())
    .map((t) => ({ name: t.name, description: t.description }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
