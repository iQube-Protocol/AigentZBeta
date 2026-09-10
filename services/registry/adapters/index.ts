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
import { lockerAssetAdapter } from './lockerAssetAdapter';
import { roomQubeAdapter } from './roomQubeAdapter';
import { researchClusterQubeAdapter } from './researchClusterQubeAdapter';
import { researchContentQubeAdapter } from './researchContentQubeAdapter';
import { researchDataQubeAdapter } from './researchDataQubeAdapter';

export const REGISTRY_ADAPTERS: ReadonlyArray<RegistryPrimitiveAdapter> = [
  contentQubeAdapter,
  lockerAssetAdapter,
  toolQubeAdapter,
  aigentQubeAdapter,
  dataQubeAdapter,
  roomQubeAdapter,
  researchClusterQubeAdapter,
  researchContentQubeAdapter,
  researchDataQubeAdapter,
  // ModelQubeAdapter — placeholder; no ModelQube source today
];

const ADAPTER_BY_PRIMITIVE: ReadonlyMap<IQubePrimitiveType, RegistryPrimitiveAdapter> = (() => {
  const m = new Map<IQubePrimitiveType, RegistryPrimitiveAdapter>();
  // First-write wins: ContentQube's native adapter remains the default
  // primitive enumerator while source dispatch still reaches locker assets.
  for (const adapter of REGISTRY_ADAPTERS) {
    if (!m.has(adapter.primitive_type)) m.set(adapter.primitive_type, adapter);
  }
  return m;
})();

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

/** Every native source adapter projecting to this primitive. */
export function adaptersForPrimitive(primitive: IQubePrimitiveType): RegistryPrimitiveAdapter[] {
  return REGISTRY_ADAPTERS.filter((adapter) => adapter.primitive_type === primitive);
}

export function adapterForSource(source: IQubeIdMapSource): RegistryPrimitiveAdapter | null {
  return ADAPTER_BY_SOURCE.get(source) ?? null;
}

export type { RegistryPrimitiveAdapter } from './types';
export { syntheticIQubeId } from './types';
