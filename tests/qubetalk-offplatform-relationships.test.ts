/**
 * QubeTalk P0.5 — off-platform relationship sibling anchor.
 *
 * Covers the ORIGINAL P0.5 pass (idempotent create-or-get, the route
 * succeeding for a ContactPerson with no linked platform persona,
 * getOrCreateRelationshipState working identically for BOTH anchor kinds,
 * structural distinctness, promotion recording promoted_to_channel_id, and
 * platform-peer-channel regression) PLUS the widening pass (2026-08-26,
 * operator code review) that closes every gap the first pass left open:
 * owner-scoped anchor resolution (no more UUID-only lookup), the composite-
 * FK-equivalent cross-owner refusal, the passport_peer_messages XOR anchor,
 * conversation resolution/listing for both anchor kinds, the fully-verified
 * transactional-equivalent promotion, transport-honest off-platform message
 * send/read, and the post-promotion continuity fix (a 'peer-channel' lookup
 * for a promoted channel resolves back to the SAME relationship-state
 * lineage rather than forking a second row).
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
const OTHER_PERSONA = 'other-persona-p05';
const OTHER_AUTH_PROFILE = 'other-auth-profile-p05';

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

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
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
    seedContactPerson({ id: 'contact-1' });
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
    seedContactPerson({ id: 'contact-a' });
    seedContactPerson({ id: 'contact-b' });
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
  it('works for a peer-channel anchor exactly as before', async () => {
    const { relationships } = await svc();
    const res = await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.anchorKind).toBe('peer-channel');
    expect(res.value.channelId).toBe('chan-1');
    expect(res.value.offplatformRelationshipId).toBeNull();
  });

  it('works for an off-platform anchor through the SAME function, given the owner', async () => {
    seedContactPerson({ id: 'contact-x' });
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-x');
    expect(anchor.ok).toBe(true);
    if (!anchor.ok) return;

    const res = await relationships.getOrCreateRelationshipState({ kind: 'off-platform', relationshipId: anchor.value.id }, OWNER_AUTH_PROFILE);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.anchorKind).toBe('off-platform');
    expect(res.value.offplatformRelationshipId).toBe(anchor.value.id);
    expect(res.value.channelId).toBeNull();
  });

  it('is idempotent per anchor and writes into the SAME qubetalk_relationship_state table for both kinds (no duplicated code path per kind beyond the column choice)', async () => {
    seedContactPerson({ id: 'contact-y' });
    const { offplatform, relationships } = await svc();
    await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-2' });
    await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-2' });
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-y');
    if (!anchor.ok) throw new Error('setup failed');
    await relationships.getOrCreateRelationshipState({ kind: 'off-platform', relationshipId: anchor.value.id }, OWNER_AUTH_PROFILE);
    await relationships.getOrCreateRelationshipState({ kind: 'off-platform', relationshipId: anchor.value.id }, OWNER_AUTH_PROFILE);

    const allRows = fake.tables['qubetalk_relationship_state'] ?? [];
    expect(allRows.filter((r) => r.channel_id === 'chan-2').length).toBe(1);
    expect(allRows.filter((r) => r.offplatform_relationship_id === anchor.value.id).length).toBe(1);
  });

  it('addOpenLoop / recordInteraction / updateMemorySummary all work against an off-platform anchor too', async () => {
    seedContactPerson({ id: 'contact-z' });
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-z');
    if (!anchor.ok) throw new Error('setup failed');
    const relAnchor = { kind: 'off-platform' as const, relationshipId: anchor.value.id };

    await relationships.recordInteraction(relAnchor, '2026-02-01T00:00:00.000Z', OWNER_AUTH_PROFILE);
    const withLoop = await relationships.addOpenLoop(relAnchor, { text: 'follow up', sourceMessageIds: ['m-1'] }, OWNER_AUTH_PROFILE);
    expect(withLoop.ok).toBe(true);
    if (!withLoop.ok) return;
    expect(withLoop.value.lastInteractionAt).toBe('2026-02-01T00:00:00.000Z');
    expect(withLoop.value.openLoops.length).toBe(1);

    const summarized = await relationships.updateMemorySummary(relAnchor, 'Discussed timeline', ['m-1'], OWNER_AUTH_PROFILE);
    expect(summarized.ok).toBe(true);
    if (!summarized.ok) return;
    expect(summarized.value.memorySummary).toBe('Discussed timeline');
    expect(summarized.value.memorySourceMessageIds).toEqual(['m-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — owner-scoped resolution: an off-platform anchor can NEVER be resolved
//     by UUID alone (P0.5 widening — the "real gap" the operator flagged).
// ═══════════════════════════════════════════════════════════════════════════
describe('owner-scoped resolution — off-platform anchors are never resolvable by UUID alone', () => {
  it('getOrCreateRelationshipState refuses an off-platform anchor with NO ownerAuthProfileId supplied', async () => {
    seedContactPerson({ id: 'contact-owner-req' });
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-owner-req');
    if (!anchor.ok) throw new Error('setup failed');

    const res = await relationships.getOrCreateRelationshipState({ kind: 'off-platform', relationshipId: anchor.value.id });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('owner_required');
  });

  it('getOrCreateRelationshipState refuses an off-platform anchor for the WRONG owner — a caller who knows/guesses another owner\'s relationship id gets not_found, never that owner\'s state', async () => {
    seedContactPerson({ id: 'contact-owner-guess' });
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-owner-guess');
    if (!anchor.ok) throw new Error('setup failed');
    // Give the real owner some real state first, so a leak would be visible.
    await relationships.addOpenLoop(
      { kind: 'off-platform', relationshipId: anchor.value.id },
      { text: 'private note', sourceMessageIds: ['m-secret'] },
      OWNER_AUTH_PROFILE,
    );

    const wrongOwnerRead = await relationships.getOrCreateRelationshipState(
      { kind: 'off-platform', relationshipId: anchor.value.id },
      OTHER_AUTH_PROFILE,
    );
    expect(wrongOwnerRead.ok).toBe(false);
    if (wrongOwnerRead.ok) return;
    expect(wrongOwnerRead.code).toBe('not_found');

    // And the real owner's data is untouched/unleaked.
    const realOwnerRead = await relationships.getOrCreateRelationshipState(
      { kind: 'off-platform', relationshipId: anchor.value.id },
      OWNER_AUTH_PROFILE,
    );
    expect(realOwnerRead.ok).toBe(true);
    if (!realOwnerRead.ok) return;
    expect(realOwnerRead.value.openLoops.map((l) => l.text)).toContain('private note');
  });

  it('getOffplatformRelationship (offplatformRelationships.ts) is ALSO owner-scoped — the same UUID-only gap, closed the same way', async () => {
    seedContactPerson({ id: 'contact-owner-read' });
    const { offplatform } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-owner-read');
    if (!anchor.ok) throw new Error('setup failed');

    const wrongOwner = await offplatform.getOffplatformRelationship(OTHER_AUTH_PROFILE, anchor.value.id);
    expect(wrongOwner.ok).toBe(false);
    if (wrongOwner.ok) return;
    expect(wrongOwner.code).toBe('not_found');

    const rightOwner = await offplatform.getOffplatformRelationship(OWNER_AUTH_PROFILE, anchor.value.id);
    expect(rightOwner.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — cross-owner ContactGraph contact attachment is refused (the
//     service-layer mirror of the composite FK's intent — the fake harness
//     doesn't enforce a real composite FK, so this asserts the invariant
//     the SERVICE code maintains).
// ═══════════════════════════════════════════════════════════════════════════
describe('cross-owner contact attachment is refused', () => {
  it('resolveOrCreateOffplatformRelationship refuses when ownerAuthProfileId does not match the contact\'s real owner', async () => {
    seedContactPerson({ id: 'contact-cross-owner', owner_auth_profile_id: OWNER_AUTH_PROFILE });
    const { offplatform } = await svc();

    const res = await offplatform.resolveOrCreateOffplatformRelationship(OTHER_AUTH_PROFILE, 'contact-cross-owner');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('not_found');

    // No row was created under the wrong owner.
    const rows = (fake.tables['qubetalk_offplatform_relationships'] ?? []).filter((r) => r.contact_person_id === 'contact-cross-owner');
    expect(rows.length).toBe(0);
  });

  it('the RIGHT owner for the same contact still succeeds', async () => {
    seedContactPerson({ id: 'contact-cross-owner-2', owner_auth_profile_id: OWNER_AUTH_PROFILE });
    const { offplatform } = await svc();
    const res = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-cross-owner-2');
    expect(res.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — structural distinctness: exactly one anchor column populated per row,
//     for BOTH qubetalk_relationship_state AND passport_peer_messages (the
//     fake harness doesn't enforce a real Postgres CHECK constraint, so this
//     asserts the invariant the SERVICE code maintains when constructing
//     insert/update payloads — the DB CHECK constraints
//     (qubetalk_relationship_state_exactly_one_anchor /
//     passport_peer_messages_exactly_one_anchor) are the second, independent
//     enforcement layer, not exercised by this fake-harness suite).
// ═══════════════════════════════════════════════════════════════════════════
describe('structural distinctness', () => {
  it('a peer-channel relationship-state row never sets offplatform_relationship_id, and vice versa', async () => {
    seedContactPerson({ id: 'contact-distinct' });
    const { offplatform, relationships } = await svc();
    await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-distinct' });
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-distinct');
    if (!anchor.ok) throw new Error('setup failed');
    await relationships.getOrCreateRelationshipState({ kind: 'off-platform', relationshipId: anchor.value.id }, OWNER_AUTH_PROFILE);

    const rows = fake.tables['qubetalk_relationship_state'] ?? [];
    const platformRow = rows.find((r) => r.channel_id === 'chan-distinct');
    const offplatformRow = rows.find((r) => r.offplatform_relationship_id === anchor.value.id);
    expect(platformRow).toBeDefined();
    expect(offplatformRow).toBeDefined();
    expect(platformRow!.offplatform_relationship_id ?? null).toBeNull();
    expect(offplatformRow!.channel_id ?? null).toBeNull();

    for (const row of rows) {
      const anchorsSet = [row.channel_id, row.offplatform_relationship_id].filter((v) => v != null).length;
      expect(anchorsSet).toBe(1);
    }
  });

  it('the migration defines the exactly-one-anchor CHECK constraint on qubetalk_relationship_state AND passport_peer_messages', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(
      join(__dirname, '..', 'supabase/migrations/20260930100000_qubetalk_offplatform_relationships.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/qubetalk_relationship_state_exactly_one_anchor/);
    expect(sql).toMatch(/num_nonnulls\(channel_id, offplatform_relationship_id\)\s*=\s*1/);
    expect(sql).toMatch(/passport_peer_messages_exactly_one_anchor/);
  });

  it('a conversation created via the offplatform path never also sets relationship_channel_id (no DB CHECK — service-level discipline)', async () => {
    seedContactPerson({ id: 'contact-conv' });
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

  it('a message sent via postOffplatformMessage sets offplatform_relationship_id and leaves channel_id unset — never both', async () => {
    seedContactPerson({ id: 'contact-msg-xor' });
    const { offplatform } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-msg-xor');
    if (!anchor.ok) throw new Error('setup failed');
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    // Give the contact a Discord endpoint so the send is actually attempted
    // (no DISCORD_BOT_TOKEN in the test env, so delivery fails honestly —
    // this test only cares about the XOR shape of the persisted row).
    const tables = fake.tables as FakeTables;
    tables['contact_personas'] = [{ id: 'cpa-xor', contact_person_id: 'contact-msg-xor', owner_auth_profile_id: OWNER_AUTH_PROFILE, label: 'Personal' }];
    tables['contact_endpoints'] = [
      { id: 'cep-xor', contact_persona_id: 'cpa-xor', platform: 'discord', identifier: '123456789012345678', normalized_identifier: '123456789012345678', state: 'active' },
    ];

    const sent = await offplatform.postOffplatformMessage(OWNER_PERSONA, anchor.value.id, { body: 'hello' });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;

    const row = (fake.tables['passport_peer_messages'] ?? []).find((r) => r.id === sent.value.id);
    expect(row).toBeDefined();
    expect(row!.offplatform_relationship_id).toBe(anchor.value.id);
    expect(row!.channel_id ?? null).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — conversation resolution/listing works for BOTH anchor kinds through
//     ONE call shape (resolveConversation / listConversationsForAnchor).
// ═══════════════════════════════════════════════════════════════════════════
describe('conversation resolution — one call shape, two anchor kinds', () => {
  it('resolveConversation creates and re-resolves the SAME default conversation for a peer-channel anchor', async () => {
    const { conversations } = await svc();
    const first = await conversations.resolveConversation({ anchor: { kind: 'peer-channel', channelId: 'chan-conv-1' }, topology: 'dyadic' });
    const second = await conversations.resolveConversation({ anchor: { kind: 'peer-channel', channelId: 'chan-conv-1' }, topology: 'dyadic' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).toBe(first.value.id);
  });

  it('resolveConversation creates and re-resolves the SAME default conversation for an off-platform anchor', async () => {
    seedContactPerson({ id: 'contact-conv-2' });
    const { offplatform, conversations } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-conv-2');
    if (!anchor.ok) throw new Error('setup failed');
    const relAnchor = { kind: 'off-platform' as const, relationshipId: anchor.value.id };

    const first = await conversations.resolveConversation({ anchor: relAnchor, topology: 'dyadic' });
    const second = await conversations.resolveConversation({ anchor: relAnchor, topology: 'dyadic' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).toBe(first.value.id);
    expect(second.value.offplatformRelationshipId).toBe(anchor.value.id);
    expect(second.value.relationshipChannelId).toBeNull();
  });

  it('listConversationsForAnchor lists conversations for either anchor kind through one call shape', async () => {
    seedContactPerson({ id: 'contact-conv-3' });
    const { offplatform, conversations } = await svc();
    const channelConv = await conversations.createConversation({ relationshipChannelId: 'chan-conv-3', topology: 'dyadic' });
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-conv-3');
    if (!anchor.ok || !channelConv.ok) throw new Error('setup failed');
    const offplatformConv = await conversations.createConversation({ offplatformRelationshipId: anchor.value.id, topology: 'dyadic' });
    if (!offplatformConv.ok) throw new Error('setup failed');

    const forChannel = await conversations.listConversationsForAnchor({ kind: 'peer-channel', channelId: 'chan-conv-3' });
    const forOffplatform = await conversations.listConversationsForAnchor({ kind: 'off-platform', relationshipId: anchor.value.id });
    expect(forChannel.ok && forOffplatform.ok).toBe(true);
    if (!forChannel.ok || !forOffplatform.ok) return;
    expect(forChannel.value).toEqual([channelConv.value.id]);
    expect(forOffplatform.value).toEqual([offplatformConv.value.id]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — off-platform message send/read: transport-honesty gate, both branches.
// ═══════════════════════════════════════════════════════════════════════════
describe('postOffplatformMessage / listOffplatformMessages — transport honesty', () => {
  it('refuses with no_reachable_transport when the contact has NO endpoints at all — never silently succeeds or fails', async () => {
    seedContactPerson({ id: 'contact-no-endpoint' });
    const { offplatform } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-no-endpoint');
    if (!anchor.ok) throw new Error('setup failed');
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);

    const res = await offplatform.postOffplatformMessage(OWNER_PERSONA, anchor.value.id, { body: 'hello?' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('no_reachable_transport');

    // No message row was inserted for a refused send.
    const rows = (fake.tables['passport_peer_messages'] ?? []).filter((r) => r.offplatform_relationship_id === anchor.value.id);
    expect(rows.length).toBe(0);
  });

  it('refuses with no_reachable_transport when the only endpoint is on an UNSUPPORTED transport (e.g. email — registered fully unsupported today)', async () => {
    seedContactPerson({ id: 'contact-email-only' });
    const { offplatform } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-email-only');
    if (!anchor.ok) throw new Error('setup failed');
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const tables = fake.tables as FakeTables;
    tables['contact_personas'] = [{ id: 'cpa-email', contact_person_id: 'contact-email-only', owner_auth_profile_id: OWNER_AUTH_PROFILE, label: 'Personal' }];
    tables['contact_endpoints'] = [
      { id: 'cep-email', contact_persona_id: 'cpa-email', platform: 'email', identifier: 'jamie@example.com', normalized_identifier: 'jamie@example.com', state: 'active' },
    ];

    const res = await offplatform.postOffplatformMessage(OWNER_PERSONA, anchor.value.id, { body: 'hello?' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('no_reachable_transport');
  });

  it('attempts a real send and persists it honestly when a Discord endpoint IS on file — creation/preservation of the relationship is unaffected either way', async () => {
    seedContactPerson({ id: 'contact-discord' });
    const { offplatform } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-discord');
    if (!anchor.ok) throw new Error('setup failed');
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const tables = fake.tables as FakeTables;
    tables['contact_personas'] = [{ id: 'cpa-discord', contact_person_id: 'contact-discord', owner_auth_profile_id: OWNER_AUTH_PROFILE, label: 'Personal' }];
    tables['contact_endpoints'] = [
      { id: 'cep-discord', contact_persona_id: 'cpa-discord', platform: 'discord', identifier: '123456789012345678', normalized_identifier: '123456789012345678', state: 'active' },
    ];

    const res = await offplatform.postOffplatformMessage(OWNER_PERSONA, anchor.value.id, { body: 'hello over discord' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // No DISCORD_BOT_TOKEN in the test env — the send is attempted and
    // honestly recorded as failed, never silently reported as delivered.
    expect(res.value.deliveryState).toBe('failed');
    expect(res.value.transport).toBe('discord');

    const listed = await offplatform.listOffplatformMessages(OWNER_PERSONA, anchor.value.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.length).toBe(1);
    expect(listed.value[0].mine).toBe(true);
  });

  it('refuses an empty body before ever checking transport reachability', async () => {
    seedContactPerson({ id: 'contact-empty-body' });
    const { offplatform } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-empty-body');
    if (!anchor.ok) throw new Error('setup failed');
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);

    const res = await offplatform.postOffplatformMessage(OWNER_PERSONA, anchor.value.id, { body: '   ' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('empty');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — promoteOffplatformRelationship: full verification + no history rewrite
//     + prior conversation/message ids preserved.
// ═══════════════════════════════════════════════════════════════════════════
describe('promoteOffplatformRelationship', () => {
  async function setUpPromotableRelationship() {
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const contactPersonhoodRef = personaPublicRef('contact-real-persona-p05');
    seedContactPerson({ id: 'contact-promote', linked_personhood_ref: null });
    const { offplatform, relationships, conversations } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-promote');
    if (!anchor.ok) throw new Error('setup failed');
    return { offplatform, relationships, conversations, anchor: anchor.value, contactPersonhoodRef };
  }

  it('refuses when the contact has no CONFIRMED linked_personhood_ref yet', async () => {
    const { offplatform, anchor } = await setUpPromotableRelationship();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const res = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'some-channel-id');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('not_linked');
  });

  it('refuses when the target channel is not actually between the caller and this contact', async () => {
    const { offplatform, anchor, contactPersonhoodRef } = await setUpPromotableRelationship();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    // Confirm the link.
    const tables = fake.tables as FakeTables;
    const person = tables['contact_persons'].find((r) => r.id === 'contact-promote')!;
    person.linked_personhood_ref = contactPersonhoodRef;
    // A channel between two UNRELATED principals.
    tables['passport_peer_channels'] = [{ id: 'chan-unrelated', principal_a_ref: 'someone-else-a', principal_b_ref: 'someone-else-b' }];

    const res = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'chan-unrelated');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(['not_a_principal', 'counterparty_mismatch']).toContain(res.code);
  });

  it('sets promoted_to_channel_id and leaves every existing dependent row untouched (no history rewrite); preserves prior conversation/message ids', async () => {
    const { offplatform, relationships, conversations, anchor, contactPersonhoodRef } = await setUpPromotableRelationship();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const myRef = personaPublicRef(OWNER_PERSONA);

    const tables = fake.tables as FakeTables;
    const person = tables['contact_persons'].find((r) => r.id === 'contact-promote')!;
    person.linked_personhood_ref = contactPersonhoodRef;
    tables['passport_peer_channels'] = [{ id: 'chan-promote-real', principal_a_ref: myRef, principal_b_ref: contactPersonhoodRef }];

    const relAnchor = { kind: 'off-platform' as const, relationshipId: anchor.id };

    // Build up real history BEFORE promotion.
    await relationships.addOpenLoop(relAnchor, { text: 'pre-promotion note', sourceMessageIds: ['m-pre'] }, OWNER_AUTH_PROFILE);
    const stateBefore = await relationships.getOrCreateRelationshipState(relAnchor, OWNER_AUTH_PROFILE);
    if (!stateBefore.ok) throw new Error('setup failed');
    const conv = await conversations.createConversation({ offplatformRelationshipId: anchor.id, topology: 'dyadic' });
    if (!conv.ok) throw new Error('setup failed');
    // Give it a discord endpoint and send one message so there's a real
    // message id to check survives promotion untouched too.
    tables['contact_personas'] = [{ id: 'cpa-promote', contact_person_id: 'contact-promote', owner_auth_profile_id: OWNER_AUTH_PROFILE, label: 'Personal' }];
    tables['contact_endpoints'] = [
      { id: 'cep-promote', contact_persona_id: 'cpa-promote', platform: 'discord', identifier: '123456789012345678', normalized_identifier: '123456789012345678', state: 'active' },
    ];
    const sentMessage = await offplatform.postOffplatformMessage(OWNER_PERSONA, anchor.id, { body: 'pre-promotion message' });
    if (!sentMessage.ok) throw new Error('setup failed');

    const promoted = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'chan-promote-real');
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(promoted.value.promotedToChannelId).toBe('chan-promote-real');
    expect(promoted.value.id).toBe(anchor.id);

    // The relationship-state row is STILL anchored on the offplatform id,
    // unchanged, still carrying its pre-promotion history.
    const stateAfter = await relationships.getOrCreateRelationshipState(relAnchor, OWNER_AUTH_PROFILE);
    expect(stateAfter.ok).toBe(true);
    if (!stateAfter.ok) return;
    expect(stateAfter.value.id).toBe(stateBefore.value.id);
    expect(stateAfter.value.anchorKind).toBe('off-platform');
    expect(stateAfter.value.channelId).toBeNull();
    expect(stateAfter.value.openLoops.map((l) => l.text)).toContain('pre-promotion note');

    // The conversation row is untouched — still anchored on the offplatform
    // id, never rewritten to point at the new channel. SAME id resolves.
    const convAfter = await conversations.getConversation(conv.value.id);
    expect(convAfter.ok).toBe(true);
    if (!convAfter.ok) return;
    expect(convAfter.value.id).toBe(conv.value.id);
    expect(convAfter.value.offplatformRelationshipId).toBe(anchor.id);
    expect(convAfter.value.relationshipChannelId).toBeNull();

    // The message id from before promotion still resolves the same way.
    const messagesAfter = await offplatform.listOffplatformMessages(OWNER_PERSONA, anchor.id);
    expect(messagesAfter.ok).toBe(true);
    if (!messagesAfter.ok) return;
    expect(messagesAfter.value.map((m) => m.id)).toContain(sentMessage.value.id);

    // Only the offplatform_relationships row itself gained the pointer.
    const offplatformRow = (fake.tables['qubetalk_offplatform_relationships'] ?? []).find((r) => r.id === anchor.id);
    expect(offplatformRow?.promoted_to_channel_id).toBe('chan-promote-real');
  });

  it('is idempotent — calling it again with the SAME channel succeeds as a no-op, never a duplicate/error', async () => {
    const { offplatform, anchor, contactPersonhoodRef } = await setUpPromotableRelationship();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const myRef = personaPublicRef(OWNER_PERSONA);
    const tables = fake.tables as FakeTables;
    tables['contact_persons'].find((r) => r.id === 'contact-promote')!.linked_personhood_ref = contactPersonhoodRef;
    tables['passport_peer_channels'] = [{ id: 'chan-promote-idem', principal_a_ref: myRef, principal_b_ref: contactPersonhoodRef }];

    const first = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'chan-promote-idem');
    const second = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'chan-promote-idem');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.promotedToChannelId).toBe('chan-promote-idem');
  });

  it('refuses to silently re-point an already-promoted relationship onto a DIFFERENT channel', async () => {
    const { offplatform, anchor, contactPersonhoodRef } = await setUpPromotableRelationship();
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const myRef = personaPublicRef(OWNER_PERSONA);
    const tables = fake.tables as FakeTables;
    tables['contact_persons'].find((r) => r.id === 'contact-promote')!.linked_personhood_ref = contactPersonhoodRef;
    tables['passport_peer_channels'] = [
      { id: 'chan-first', principal_a_ref: myRef, principal_b_ref: contactPersonhoodRef },
      { id: 'chan-second', principal_a_ref: myRef, principal_b_ref: contactPersonhoodRef },
    ];

    const first = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'chan-first');
    expect(first.ok).toBe(true);
    const second = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.id, 'chan-second');
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe('already_promoted');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — post-promotion activity does not fork relationship state: resolving
//      the NOW-REAL {kind:'peer-channel', channelId} for the same
//      owner+channel pair must resolve back to the SAME relationship-state
//      lineage as the pre-promotion off-platform one.
// ═══════════════════════════════════════════════════════════════════════════
describe('post-promotion continuity — a peer-channel lookup does not fork a second relationship-state row', () => {
  it('getOrCreateRelationshipState({kind:"peer-channel", channelId}) after promotion resolves the SAME row the off-platform anchor created', async () => {
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const contactPersonhoodRef = personaPublicRef('contact-real-persona-continuity');
    seedContactPerson({ id: 'contact-continuity', linked_personhood_ref: null });
    const { offplatform, relationships } = await svc();
    const anchor = await offplatform.resolveOrCreateOffplatformRelationship(OWNER_AUTH_PROFILE, 'contact-continuity');
    if (!anchor.ok) throw new Error('setup failed');
    personaOwnerMap.set(OWNER_PERSONA, OWNER_AUTH_PROFILE);
    const myRef = personaPublicRef(OWNER_PERSONA);
    const tables = fake.tables as FakeTables;
    tables['contact_persons'].find((r) => r.id === 'contact-continuity')!.linked_personhood_ref = contactPersonhoodRef;
    tables['passport_peer_channels'] = [{ id: 'chan-continuity', principal_a_ref: myRef, principal_b_ref: contactPersonhoodRef }];

    const relAnchor = { kind: 'off-platform' as const, relationshipId: anchor.value.id };
    await relationships.addOpenLoop(relAnchor, { text: 'continuity note', sourceMessageIds: ['m-cont'] }, OWNER_AUTH_PROFILE);
    const preState = await relationships.getOrCreateRelationshipState(relAnchor, OWNER_AUTH_PROFILE);
    if (!preState.ok) throw new Error('setup failed');

    const promoted = await offplatform.promoteOffplatformRelationship(OWNER_PERSONA, anchor.value.id, 'chan-continuity');
    expect(promoted.ok).toBe(true);

    // Now resolve by the REAL channel id — must land on the SAME row, not a
    // fresh channel_id-keyed one.
    const postPromotionState = await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-continuity' });
    expect(postPromotionState.ok).toBe(true);
    if (!postPromotionState.ok) return;
    expect(postPromotionState.value.id).toBe(preState.value.id);
    expect(postPromotionState.value.anchorKind).toBe('off-platform');
    expect(postPromotionState.value.offplatformRelationshipId).toBe(anchor.value.id);
    expect(postPromotionState.value.openLoops.map((l) => l.text)).toContain('continuity note');

    // Exactly ONE row exists for this lineage — never forked.
    const allRows = fake.tables['qubetalk_relationship_state'] ?? [];
    const lineageRows = allRows.filter((r) => r.id === preState.value.id || r.channel_id === 'chan-continuity');
    expect(lineageRows.length).toBe(1);

    // recordInteraction through the peer-channel anchor also lands on the
    // SAME row (not just the read path).
    await relationships.recordInteraction({ kind: 'peer-channel', channelId: 'chan-continuity' }, '2026-03-15T00:00:00.000Z');
    const afterInteraction = await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-continuity' });
    expect(afterInteraction.ok).toBe(true);
    if (!afterInteraction.ok) return;
    expect(afterInteraction.value.id).toBe(preState.value.id);
    expect(afterInteraction.value.lastInteractionAt).toBe('2026-03-15T00:00:00.000Z');
  });

  it('a channel with NO promoted off-platform relationship behaves exactly as before (no redirect, fresh channel_id row)', async () => {
    const { relationships } = await svc();
    const res = await relationships.getOrCreateRelationshipState({ kind: 'peer-channel', channelId: 'chan-no-promotion' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.anchorKind).toBe('peer-channel');
    expect(res.value.channelId).toBe('chan-no-promotion');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — existing platform-peer-channel behavior is provably unchanged
// ═══════════════════════════════════════════════════════════════════════════
describe('regression — peer-channel behavior unchanged by the anchor-descriptor widening', () => {
  it('getOrCreateRelationshipState/recordInteraction/addOpenLoop/resolveOpenLoop/updateMemorySummary all still operate on channel_id exactly as before, just wrapped in { kind, channelId }', async () => {
    const { relationships } = await svc();
    const anchor = { kind: 'peer-channel' as const, channelId: 'chan-regression' };

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
    expect(summarized.value.anchorKind).toBe('peer-channel');
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
