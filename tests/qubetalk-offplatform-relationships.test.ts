/**
 * QubeTalk P0.5 — off-platform relationship sibling anchor.
 *
 * Covers: idempotent create-or-get, the route succeeding (200, not 409) for
 * a ContactPerson with no linked platform persona, getOrCreateRelationshipState
 * working identically (same table, same function) for BOTH anchor kinds,
 * structural distinctness (exactly one anchor column populated per row),
 * promotion recording promoted_to_channel_id without touching any existing
 * relationship-state/conversation row, and a regression check that the
 * existing platform-peer-channel path is unaffected by the anchor-descriptor
 * signature change.
 *
 * Uses the shared in-memory fake Postgrest client (tests/_lib/fakeSupabase.ts)
 * — the same "drive the real store, read back what comes out" discipline as
 * tests/qubetalk-communications-membrane-scenarios.test.ts and
 * tests/qubetalk-messaging-loop-e2e.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { createFakeSupabase, type FakeTables } from './_lib/fakeSupabase';

let fake: ReturnType<typeof createFakeSupabase>;
const personaOwnerMap = new Map<string, string>();

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fake.admin,
}));
vi.mock('@/services/wallet/personaRepo', () => ({
  PersonaRepo: class {
    async getById(id: string) {
      const authProfileId = personaOwnerMap.get(id);
      if (!authProfileId) return null;
      return { id, auth_profile_id: authProfileId };
    }
  },
}));

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

beforeEach(() => {
  fake = createFakeSupabase();
  personaOwnerMap.clear();
});

const OWNER_PERSONA = 'owner-persona-p05';
const OWNER_AUTH_PROFILE = 'owner-auth-profile-p05';

function seedContactPerson(overrides: Record<string, unknown> = {}) {
  const tables = fake.tables as FakeTables;
  const row = {
    id: 'contact-person-p05-1',
    owner_auth_profile_id: OWNER_AUTH_PROFILE,
    display_name: 'Jamie (no platform persona)',
    linked_personhood_ref: null,
    state: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  tables['contact_persons'] = [...(tables['contact_persons'] ?? []), row];
  return row;
}

function makeRequest(): NextRequest {
  return { json: async () => ({}) } as unknown as NextRequest;
}

async function svc() {
  return {
    offplatform: await import('@/services/qubetalk/offplatformRelationships'),
    relationships: await import('@/services/qubetalk/relationships'),
    conversations: await import('@/services/qubetalk/conversations'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — resolveOrCreateOffplatformRelationship is idempotent
// ═══════════════════════════════════════════════════════════════════════════
describe('resolveOrCreateOffplatformRelationship', () => {
  it('same owner+contact resolves to the SAME row on a second call, never a duplicate', async () => {
    const { offplatform } = await svc();
    const first = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-1');
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-1');
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.value.id).toBe(first.value.id);
    const rows = (fake.tables['qubetalk_offplatform_relationships'] ?? []).filter(
      (r) => r.owner_auth_profile_id === OWNER_AUTH_PROFILE && r.contact_person_id === 'contact-1',
    );
    expect(rows.length).toBe(1);
    expect(first.value.status).toBe('active');
    expect(first.value.promotedToChannelId).toBeNull();
  });

  it('a different contact under the same owner gets its OWN row', async () => {
    const { offplatform } = await svc();
    const a = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-a');
    const b = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-b');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.id).not.toBe(b.value.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — the route now succeeds (200, not 409) for a ContactPerson with no
//     linked platform persona, and identifies the response as offplatform_contact
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/qubetalk/people/[personId]/channel — offplatform contact', () => {
  it('returns 200 with an offplatform_contact-kind channel, never the old 409', async () => {
    seedContactPerson();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    mockGetActivePersona.mockResolvedValue({ personaId: OWNER_PERSONA });

    const { POST } = await import('@/app/api/qubetalk/people/[personId]/channel/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ personId: 'contact-person-p05-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.channel.kind).toBe('offplatform_contact');
    expect(body.channel.contactPersonId).toBe('contact-person-p05-1');
    expect(body.error).toBeUndefined();
  });

  it('calling it twice for the same person returns the SAME offplatform relationship id (idempotent through the route)', async () => {
    seedContactPerson();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    mockGetActivePersona.mockResolvedValue({ personaId: OWNER_PERSONA });

    const { POST } = await import('@/app/api/qubetalk/people/[personId]/channel/route');
    const res1 = await POST(makeRequest(), { params: Promise.resolve({ personId: 'contact-person-p05-1' }) });
    const res2 = await POST(makeRequest(), { params: Promise.resolve({ personId: 'contact-person-p05-1' }) });
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.channel.id).toBe(body2.channel.id);
  });

  it('still returns 401 for an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { POST } = await import('@/app/api/qubetalk/people/[personId]/channel/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ personId: 'contact-person-p05-1' }) });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — getOrCreateRelationshipState: same function, same table, both anchors
// ═══════════════════════════════════════════════════════════════════════════
describe('getOrCreateRelationshipState — one function, two anchor kinds', () => {
  it('works for a platform_peer_channel anchor exactly as before', async () => {
    const { relationships } = await svc();
    const res = await relationships.getOrCreateRelationshipState({ kind: 'platform_peer_channel', channelId: 'chan-1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.anchorKind).toBe('platform_peer_channel');
    expect(res.value.channelId).toBe('chan-1');
    expect(res.value.offplatformRelationshipId).toBeNull();
  });

  it('works for an offplatform_contact anchor through the SAME function', async () => {
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-x');
    expect(anchor.ok).toBe(true);
    if (!anchor.ok) return;

    const res = await relationships.getOrCreateRelationshipState({ kind: 'offplatform_contact', offplatformRelationshipId: anchor.value.id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.anchorKind).toBe('offplatform_contact');
    expect(res.value.offplatformRelationshipId).toBe(anchor.value.id);
    expect(res.value.channelId).toBeNull();
  });

  it('is idempotent per anchor and writes into the SAME qubetalk_relationship_state table for both kinds (no duplicated code path per kind beyond the column choice)', async () => {
    const { offplatform, relationships } = await svc();
    await relationships.getOrCreateRelationshipState({ kind: 'platform_peer_channel', channelId: 'chan-2' });
    await relationships.getOrCreateRelationshipState({ kind: 'platform_peer_channel', channelId: 'chan-2' });
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-y');
    if (!anchor.ok) throw new Error('setup failed');
    await relationships.getOrCreateRelationshipState({ kind: 'offplatform_contact', offplatformRelationshipId: anchor.value.id });
    await relationships.getOrCreateRelationshipState({ kind: 'offplatform_contact', offplatformRelationshipId: anchor.value.id });

    const allRows = fake.tables['qubetalk_relationship_state'] ?? [];
    expect(allRows.filter((r) => r.channel_id === 'chan-2').length).toBe(1);
    expect(allRows.filter((r) => r.offplatform_relationship_id === anchor.value.id).length).toBe(1);
  });

  it('addOpenLoop / recordInteraction / updateMemorySummary all work against an offplatform anchor too', async () => {
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-z');
    if (!anchor.ok) throw new Error('setup failed');
    const relAnchor = { kind: 'offplatform_contact' as const, offplatformRelationshipId: anchor.value.id };

    await relationships.recordInteraction(relAnchor, '2026-02-01T00:00:00.000Z');
    const withLoop = await relationships.addOpenLoop(relAnchor, { text: 'follow up', sourceMessageIds: ['m-1'] });
    expect(withLoop.ok).toBe(true);
    if (!withLoop.ok) return;
    expect(withLoop.value.lastInteractionAt).toBe('2026-02-01T00:00:00.000Z');
    expect(withLoop.value.openLoops.length).toBe(1);

    const summarized = await relationships.updateMemorySummary(relAnchor, 'Discussed timeline', ['m-1']);
    expect(summarized.ok).toBe(true);
    if (!summarized.ok) return;
    expect(summarized.value.memorySummary).toBe('Discussed timeline');
    expect(summarized.value.memorySourceMessageIds).toEqual(['m-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — structural distinctness: exactly one anchor column populated per row
// ═══════════════════════════════════════════════════════════════════════════
describe('structural distinctness', () => {
  it('a platform_peer_channel row never sets offplatform_relationship_id, and vice versa', async () => {
    const { offplatform, relationships } = await svc();
    await relationships.getOrCreateRelationshipState({ kind: 'platform_peer_channel', channelId: 'chan-distinct' });
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-distinct');
    if (!anchor.ok) throw new Error('setup failed');
    await relationships.getOrCreateRelationshipState({ kind: 'offplatform_contact', offplatformRelationshipId: anchor.value.id });

    const rows = fake.tables['qubetalk_relationship_state'] ?? [];
    const platformRow = rows.find((r) => r.channel_id === 'chan-distinct');
    const offplatformRow = rows.find((r) => r.offplatform_relationship_id === anchor.value.id);
    expect(platformRow).toBeDefined();
    expect(offplatformRow).toBeDefined();
    expect(platformRow!.offplatform_relationship_id ?? null).toBeNull();
    expect(offplatformRow!.channel_id ?? null).toBeNull();

    // Every row in the table satisfies "exactly one anchor set" — the same
    // invariant the DB's CHECK constraint (20260930100000 migration) enforces.
    for (const row of rows) {
      const anchorsSet = [row.channel_id, row.offplatform_relationship_id].filter((v) => v != null).length;
      expect(anchorsSet).toBe(1);
    }
  });

  it('the migration defines the exactly-one-anchor CHECK constraint on qubetalk_relationship_state', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(
      join(__dirname, '..', 'supabase/migrations/20260930100000_qubetalk_offplatform_relationships.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/qubetalk_relationship_state_exactly_one_anchor/);
    expect(sql).toMatch(/num_nonnulls\(channel_id, offplatform_relationship_id\)\s*=\s*1/);
  });

  it('a conversation created via the offplatform path never also sets relationship_channel_id (no DB CHECK — service-level discipline)', async () => {
    const { offplatform, conversations } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-conv');
    if (!anchor.ok) throw new Error('setup failed');

    const conv = await conversations.createConversation({
      offplatformRelationshipId: anchor.value.id,
      topology: 'dyadic',
    });
    expect(conv.ok).toBe(true);
    if (!conv.ok) return;
    expect(conv.value.offplatformRelationshipId).toBe(anchor.value.id);
    expect(conv.value.relationshipChannelId).toBeNull();

    const row = (fake.tables['qubetalk_conversations'] ?? []).find((r) => r.id === conv.value.id);
    expect(row?.relationship_channel_id ?? null).toBeNull();
    expect(row?.offplatform_relationship_id).toBe(anchor.value.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — promotion sets promoted_to_channel_id without touching any existing
//     relationship-state/conversation row anchored on the offplatform id
// ═══════════════════════════════════════════════════════════════════════════
describe('promoteOffplatformRelationship', () => {
  it('sets promoted_to_channel_id and leaves every existing dependent row untouched (no history rewrite)', async () => {
    const { offplatform, relationships, conversations } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-promote');
    if (!anchor.ok) throw new Error('setup failed');
    const relAnchor = { kind: 'offplatform_contact' as const, offplatformRelationshipId: anchor.value.id };

    // Build up real history BEFORE promotion.
    await relationships.addOpenLoop(relAnchor, { text: 'pre-promotion note', sourceMessageIds: ['m-pre'] });
    const stateBefore = await relationships.getOrCreateRelationshipState(relAnchor);
    if (!stateBefore.ok) throw new Error('setup failed');
    const conv = await conversations.createConversation({ offplatformRelationshipId: anchor.value.id, topology: 'dyadic' });
    if (!conv.ok) throw new Error('setup failed');

    const promoted = await offplatform.promoteOffplatformRelationship(anchor.value.id, 'new-real-channel-id');
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(promoted.value.promotedToChannelId).toBe('new-real-channel-id');
    expect(promoted.value.id).toBe(anchor.value.id);

    // The relationship-state row is STILL anchored on the offplatform id,
    // unchanged, still carrying its pre-promotion history.
    const stateAfter = await relationships.getOrCreateRelationshipState(relAnchor);
    expect(stateAfter.ok).toBe(true);
    if (!stateAfter.ok) return;
    expect(stateAfter.value.id).toBe(stateBefore.value.id);
    expect(stateAfter.value.anchorKind).toBe('offplatform_contact');
    expect(stateAfter.value.channelId).toBeNull();
    expect(stateAfter.value.openLoops.map((l) => l.text)).toContain('pre-promotion note');

    // The conversation row is untouched — still anchored on the offplatform
    // id, never rewritten to point at the new channel.
    const convAfter = await conversations.getConversation(conv.value.id);
    expect(convAfter.ok).toBe(true);
    if (!convAfter.ok) return;
    expect(convAfter.value.offplatformRelationshipId).toBe(anchor.value.id);
    expect(convAfter.value.relationshipChannelId).toBeNull();

    // Only the offplatform_relationships row itself gained the pointer.
    const offplatformRow = (fake.tables['qubetalk_offplatform_relationships'] ?? []).find((r) => r.id === anchor.value.id);
    expect(offplatformRow?.promoted_to_channel_id).toBe('new-real-channel-id');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — existing platform-peer-channel behavior is provably unchanged
// ═══════════════════════════════════════════════════════════════════════════
describe('regression — platform_peer_channel behavior unchanged by the anchor-descriptor signature change', () => {
  it('getOrCreateRelationshipState/recordInteraction/addOpenLoop/resolveOpenLoop/updateMemorySummary all still operate on channel_id exactly as before, just wrapped in { kind, channelId }', async () => {
    const { relationships } = await svc();
    const anchor = { kind: 'platform_peer_channel' as const, channelId: 'chan-regression' };

    await relationships.recordInteraction(anchor, '2026-03-01T00:00:00.000Z');
    const withLoop = await relationships.addOpenLoop(anchor, { text: 'loop-1', sourceMessageIds: ['m-a'] });
    expect(withLoop.ok).toBe(true);
    if (!withLoop.ok) return;
    const loopId = withLoop.value.openLoops[0].id;

    const resolved = await relationships.resolveOpenLoop(anchor, loopId);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.openLoops[0].resolvedAt).toBeTruthy();

    const summarized = await relationships.updateMemorySummary(anchor, 'summary text', ['m-a']);
    expect(summarized.ok).toBe(true);
    if (!summarized.ok) return;
    expect(summarized.value.anchorKind).toBe('platform_peer_channel');
    expect(summarized.value.channelId).toBe('chan-regression');
    expect(summarized.value.lastInteractionAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('the route still resolves-or-creates a real passport_peer_channels row for a person WITH a linked platform persona (unaffected by the offplatform branch)', async () => {
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const counterpartyRef = personaPublicRef('linked-persona-p05');
    seedContactPerson({ id: 'contact-linked-p05', linked_personhood_ref: counterpartyRef });
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    mockGetActivePersona.mockResolvedValue({ personaId: OWNER_PERSONA });

    const { POST } = await import('@/app/api/qubetalk/people/[personId]/channel/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ personId: 'contact-linked-p05' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel.kind).toBe('platform_peer_channel');
    expect(body.channel.counterpartyRef).toBe(counterpartyRef);

    const channelRows = fake.tables['passport_peer_channels'] ?? [];
    expect(channelRows.length).toBe(1);
  });
});
