/**
 * CTP Registry — resolution mechanism for Constitutional Transition
 * Primitives (2026-08-31, "CTP foundation").
 *
 * This is a MAP, not a second execution engine (charter §6): it describes
 * and binds each primitive; `constitutionalRuntime.execute()` is the only
 * place a primitive is actually run. Registration happens once per
 * primitive module, at import time — see `services/ctp/primitives/*.ts`.
 */

import type { ConstitutionalTransitionPrimitive } from '@/types/ctp';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY = new Map<string, ConstitutionalTransitionPrimitive<any, any>>();

function registryKey(primitiveId: string, version: string): string {
  return `${primitiveId}@${version}`;
}

const EXECUTABLE_STATUSES: ReadonlySet<ConstitutionalTransitionPrimitive['status']> = new Set(['ACTIVE', 'RATIFIED']);

function isExecutableStatus(status: ConstitutionalTransitionPrimitive['status']): boolean {
  return EXECUTABLE_STATUSES.has(status);
}

/**
 * Register a primitive definition. Structural half of "exactly one
 * canonical implementation binding" (delivery amendment #26/#32): a second
 * registration for the SAME (id, version) with a DIFFERENT
 * `implementationRef` is refused — that would be a second application
 * independently reproducing the same constitutional mutation semantics,
 * exactly what the amendment's CI/canary requirement exists to catch.
 *
 * Re-registering the SAME definition (same implementationRef) is a no-op,
 * not an error — module re-import (hot reload, multiple route handlers
 * importing the same primitive module) must not crash the process merely
 * because the module executed twice.
 */
export function registerPrimitive(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: ConstitutionalTransitionPrimitive<any, any>,
): void {
  const key = registryKey(def.primitiveId, def.version);
  const existing = REGISTRY.get(key);
  if (existing) {
    if (existing.implementationRef === def.implementationRef) return; // benign re-import
    throw new Error(
      `CTP registry: '${key}' is already bound to '${existing.implementationRef}' — refusing a second, ` +
        `different implementation binding ('${def.implementationRef}'). A primitive/version has exactly one ` +
        'canonical implementation; supersede with a new version instead.',
    );
  }
  REGISTRY.set(key, def);
}

/**
 * Resolve the ACTIVE definition for `primitiveId`. `version` is optional —
 * omitted, resolves the highest-version executable (ACTIVE/RATIFIED)
 * registration; given, resolves exactly that version. Returns `null` (never
 * throws, never guesses) for an unknown primitive or a non-executable
 * status — the runtime's caller is responsible for treating `null` as a
 * fail-closed refusal (delivery amendment #36).
 */
export function resolvePrimitive(
  primitiveId: string,
  version?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ConstitutionalTransitionPrimitive<any, any> | null {
  if (version) {
    const def = REGISTRY.get(registryKey(primitiveId, version));
    return def && isExecutableStatus(def.status) ? def : null;
  }
  const candidates = [...REGISTRY.values()].filter((d) => d.primitiveId === primitiveId && isExecutableStatus(d.status));
  if (candidates.length === 0) return null;
  // Primitives are hand-versioned, few-in-number x.y.z strings — a numeric
  // localeCompare is sufficient without a semver dependency.
  return [...candidates].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
}

/** Every registered (id, version) pair — for CI canaries (delivery
 *  amendment #26/#32's "active primitive resolves to exactly one canonical
 *  implementation binding"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listRegisteredPrimitives(): ConstitutionalTransitionPrimitive<any, any>[] {
  return [...REGISTRY.values()];
}

/** Test-only — clears the registry between test files that register their
 *  own throwaway primitives. NEVER called from production code. */
export function __resetRegistryForTests(): void {
  REGISTRY.clear();
}
