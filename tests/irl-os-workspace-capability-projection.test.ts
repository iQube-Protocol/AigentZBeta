/**
 * IRL OS Workspace — capability-aware EXP-P1 dossier projection (2026-09-12).
 *
 * Covers the piece this pass actually added on top of the EXISTING
 * capability-ladder system (`services/research/accessCapabilities.ts`,
 * 2026-10-01 — do not re-test its own gate here, see
 * tests/irl-stewardship-access-capability.test.ts for that):
 *
 *   - `resolveEffectiveExperimentCapability` — the ordinary-ladder cascade
 *     (`run > write > review`, else `read`) that neither `resolveCapability`
 *     nor any prior caller computed; used by the Workspace projection and
 *     available to MCP/agent surfaces for parity (no second implementation).
 *
 * Uses the shared in-memory fake Postgrest client, same as the capability
 * module's own test file (Extend, Don't Duplicate).
 */

import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase, fakeUuid, fakeNowIso, type FakeTables } from './_lib/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-1' })),
}));

import { resolveEffectiveExperimentCapability } from '@/services/research/accessCapabilities';

function seedGrant(tables: FakeTables, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row = {
    id: fakeUuid(),
    persona_id: 'austin-equivalent-reviewer',
    access_domain: 'research-lab',
    role: 'reviewer',
    status: 'active',
    ...overrides,
  };
  (tables.access_grants ??= []).push(row);
  return row;
}

function seedCapability(tables: FakeTables, grantId: string, capability: string, overrides: Record<string, unknown> = {}): void {
  (tables.access_grant_capabilities ??= []).push({
    id: fakeUuid(),
    grant_id: grantId,
    scope_type: 'experiment',
    scope_ref: 'EXP-P1',
    capability,
    status: 'active',
    granted_at: fakeNowIso(),
    granted_by_persona_id: 'steward-1',
    expires_at: null,
    revoked_at: null,
    reason: null,
    receipt_id: null,
    ...overrides,
  });
}

describe('resolveEffectiveExperimentCapability', () => {
  it('returns "read" for a bare active grant with no capability row at all — entry without an elevated capability', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables);

    const result = await resolveEffectiveExperimentCapability(admin as any, {
      personaId: grant.persona_id as string,
      experimentId: 'EXP-P1',
    });
    expect(result).toBe('read');
  });

  it("returns 'review' when only a review capability row is active — Austin's actual EXP-P1 authority", async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables);
    seedCapability(tables, grant.id as string, 'review');

    const result = await resolveEffectiveExperimentCapability(admin as any, {
      personaId: grant.persona_id as string,
      experimentId: 'EXP-P1',
    });
    expect(result).toBe('review');
  });

  it("cascades to the highest ordinary rung — 'run' wins over a separately-held 'review' row", async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables);
    seedCapability(tables, grant.id as string, 'review');
    seedCapability(tables, grant.id as string, 'run');

    const result = await resolveEffectiveExperimentCapability(admin as any, {
      personaId: grant.persona_id as string,
      experimentId: 'EXP-P1',
    });
    expect(result).toBe('run');
  });

  it('never returns a capability found only at a DIFFERENT experiment scope — resource-scoped, not persona-wide', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables);
    seedCapability(tables, grant.id as string, 'run', { scope_ref: 'EXP-P2' });

    const result = await resolveEffectiveExperimentCapability(admin as any, {
      personaId: grant.persona_id as string,
      experimentId: 'EXP-P1',
    });
    expect(result).toBe('read');
  });

  it('ignores an expired capability row — falls back down the cascade, never up', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables);
    seedCapability(tables, grant.id as string, 'run', { expires_at: '1999-01-01T00:00:00.000Z' });
    seedCapability(tables, grant.id as string, 'review');

    const result = await resolveEffectiveExperimentCapability(admin as any, {
      personaId: grant.persona_id as string,
      experimentId: 'EXP-P1',
    });
    expect(result).toBe('review');
  });

  it('fails closed to "read" for a persona with no active grant at all — never throws, never elevates', async () => {
    const { admin } = createFakeSupabase();

    const result = await resolveEffectiveExperimentCapability(admin as any, {
      personaId: 'nobody',
      experimentId: 'EXP-P1',
    });
    expect(result).toBe('read');
  });
});
