/**
 * Adapter registry — picks the right adapter for a work order.
 *
 * Phase 2 has one registered adapter (OpenClaw). Adding a new adapter
 * is a single-line change here plus an entry in
 * `IssueWorkOrderInput.adapter`'s union type in `../gateway.ts`.
 */

import type { CapabilityWorkOrder } from '../types';
import { openclawAdapter } from './openclawAdapter';
import type { CapabilityAdapter } from './types';

const REGISTRY: Record<CapabilityWorkOrder['adapter'], CapabilityAdapter | undefined> = {
  openclaw: openclawAdapter,
  'reserved-future': undefined,
};

export function getAdapter(id: CapabilityWorkOrder['adapter']): CapabilityAdapter | null {
  return REGISTRY[id] ?? null;
}

export function listRegisteredAdapters(): string[] {
  return Object.entries(REGISTRY)
    .filter(([, adapter]) => adapter !== undefined)
    .map(([id]) => id);
}
