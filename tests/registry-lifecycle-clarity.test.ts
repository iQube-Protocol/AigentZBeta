/**
 * Lifecycle clarity tests — PRD v1.1 §B.2 / Stage 3.
 *
 * Surface 'canonized' means "agent-discoverable authoritative surface,"
 * NOT "fully canonized by governance." Internal published vs canonized
 * are distinct states; surface collapses both. This test enforces:
 *
 *   1. The collapse rule (both internal states surface as canonized).
 *   2. The distinction is preserved on the admin / cartridge projection
 *      (those views expose internal_lifecycle; agent card does not).
 *   3. The mapping never widens silently — adding a new universal state
 *      without updating UNIVERSAL_TO_SURFACE_MAP fails the lifecycle.test.ts
 *      coverage test; this file asserts the semantic clarity.
 */

import { describe, expect, it } from 'vitest';

import {
  UNIVERSAL_TO_SURFACE_MAP,
  internalToSurface,
} from '@/services/registry/lifecycle';
import { projectAdmin } from '@/services/registry/projections/admin';
import { projectCartridge } from '@/services/registry/projections/cartridge';
import type { CanonicalIQubeInternalRecord } from '@/types/registry-canonical';

function rec(internal: 'published' | 'canonized'): CanonicalIQubeInternalRecord {
  return {
    iqube_id: '00000000-0000-4000-8000-000000000001',
    primitive_type: 'ContentQube',
    instance_type: 'instance',
    meta_qube_id: 'meta-001',
    creator_identity_state: 'pseudonymous',
    origin: 'native',
    internal_lifecycle: internal,
    surface_lifecycle: internalToSurface(internal),
    canonicalization_status: internal === 'canonized' ? 'canonized' : 'finalized',
    wip_supabase_only: false,
    visibility_state: 'public',
    gating: ['open'],
    mint_status: 'minted',
    instance_model: 'singleton',
    dvn_receipt_index: { receipt_count: 0 },
    cartridge_bindings: [],
    version: '1.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('lifecycle clarity: surface collapse', () => {
  it('internal published → surface canonized', () => {
    expect(internalToSurface('published')).toBe('canonized');
  });

  it('internal canonized → surface canonized', () => {
    expect(internalToSurface('canonized')).toBe('canonized');
  });

  it('the two collapse to the same surface value', () => {
    expect(internalToSurface('published')).toBe(internalToSurface('canonized'));
  });
});

describe('lifecycle clarity: admin/cartridge projection preserves the distinction', () => {
  it('admin projection exposes internal_lifecycle (published vs canonized are distinguishable)', () => {
    const adminPublished = projectAdmin(rec('published'));
    const adminCanonized = projectAdmin(rec('canonized'));
    expect(adminPublished.internal_lifecycle).toBe('published');
    expect(adminCanonized.internal_lifecycle).toBe('canonized');
    expect(adminPublished.internal_lifecycle).not.toBe(adminCanonized.internal_lifecycle);
  });

  it('admin projection ALSO carries surface_lifecycle (for catalog parity)', () => {
    const adminPublished = projectAdmin(rec('published'));
    const adminCanonized = projectAdmin(rec('canonized'));
    expect(adminPublished.surface_lifecycle).toBe('canonized');
    expect(adminCanonized.surface_lifecycle).toBe('canonized');
  });

  it('cartridge projection only carries surface_lifecycle (T1 view; no governance noise)', () => {
    const cartridgePublished = projectCartridge(rec('published'));
    const cartridgeCanonized = projectCartridge(rec('canonized'));
    expect(cartridgePublished.surface_lifecycle).toBe('canonized');
    expect(cartridgeCanonized.surface_lifecycle).toBe('canonized');
    // Cartridge view should NOT expose internal_lifecycle — verify the
    // shape doesn't accidentally serialise it.
    expect((cartridgePublished as Record<string, unknown>).internal_lifecycle).toBeUndefined();
    expect((cartridgeCanonized as Record<string, unknown>).internal_lifecycle).toBeUndefined();
  });
});

describe('lifecycle clarity: regression guard', () => {
  it('UNIVERSAL_TO_SURFACE_MAP keeps published+canonized collapsed (PRD v1.1 §B.2)', () => {
    // If a future PR splits these onto different surface values, this
    // test fails and surfaces the v1.1 §B.2 clarification explicitly.
    expect(UNIVERSAL_TO_SURFACE_MAP.published).toBe(UNIVERSAL_TO_SURFACE_MAP.canonized);
    expect(UNIVERSAL_TO_SURFACE_MAP.published).toBe('canonized');
  });
});
