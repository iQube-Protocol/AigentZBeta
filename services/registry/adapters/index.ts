/**
 * Primitive adapter registry.
 *
 * The resolver dispatches via this registry. Adding a new primitive
 * (ModelQube, ClusterQube) is two lines: import the adapter, push it
 * onto REGISTRY_ADAPTERS.
 */

import type { IQubePrimitiveType, IQubeIdMapSource } from '@/types/registry-canonical';
import type { RegistryPrimitiveAdapter } from './types';

import { contentQubeAdapter } from './contentQubeAdapter';
import { toolQubeAdapter } from './toolQubeAdapter';
import { aigentQubeAdapter } from './aigentQubeAdapter';
import { dataQubeAdapter } from './dataQubeAdapter';

export const REGISTRY_ADAPTERS: ReadonlyArray<RegistryPrimitiveAdapter> = [
  contentQubeAdapter,
  toolQubeAdapter,
  aigentQubeAdapter,
  dataQubeAdapter,
  // ModelQubeAdapter — placeholder; no ModelQube source today
  // ClusterQubeAdapter — placeholder; cluster composition lands in Stage 3+
];

const ADAPTER_BY_PRIMITIVE: ReadonlyMap<IQubePrimitiveType, RegistryPrimitiveAdapter> =
  new Map(REGISTRY_ADAPTERS.map((a) => [a.primitive_type, a]));

const ADAPTER_BY_SOURCE: ReadonlyMap<IQubeIdMapSource, RegistryPrimitiveAdapter> = (() => {
  const m = new Map<IQubeIdMapSource, RegistryPrimitiveAdapter>();
  for (const adapter of REGISTRY_ADAPTERS) {
    for (const src of adapter.sources) {
      // First-write-wins; an adapter cannot claim a source another adapter
      // already owns. Ambiguity here is a design bug, not a runtime fallback.
      if (!m.has(src)) m.set(src, adapter);
    }
  }
  return m;
})();

export function adapterForPrimitive(primitive: IQubePrimitiveType): RegistryPrimitiveAdapter | null {
  return ADAPTER_BY_PRIMITIVE.get(primitive) ?? null;
}

export function adapterForSource(source: IQubeIdMapSource): RegistryPrimitiveAdapter | null {
  return ADAPTER_BY_SOURCE.get(source) ?? null;
}

export type { RegistryPrimitiveAdapter } from './types';
export { syntheticIQubeId } from './types';
