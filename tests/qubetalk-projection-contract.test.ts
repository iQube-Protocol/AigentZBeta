/**
 * QubeTalk Communications Membrane — the surface-independent capability
 * projection contract (services/qubetalk/projection.ts), operator-ratified
 * 2026-08-25. Proves the formula behaviorally, not just in prose:
 *
 *   principal ∩ persona ∩ surface ∩ requested projection ∩ requested scope
 *   ∩ delegation ∩ disclosure policy = visible/invocable QubeTalk capability
 *
 * and the two headline invariants: surface continuity (the SAME conversation
 * id is returned regardless of which profile/surface asks) and surface
 * non-ownership (a 'contextual' request can never reach beyond its explicit,
 * bounded scope — 'all' is refused outright for that profile).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './_lib/fakeSupabase';
import { personaPublicRef } from '@/services/identity/personaReferences';

let fake: ReturnType<typeof createFakeSupabase>;
let grantState: { status: 'active' | 'revoked' | 'expired'; agent_root_did: string } | null = null;

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fake.admin,
}));
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrantForAgent: async (_personaId: string, _agentRootDid: string) => grantState,
}));

beforeEach(() => {
  fake = createFakeSupabase();
  grantState = null;
});

const DELE = 'a0000000-0000-0000-0000-000000000001';
const JOHN = 'a0000000-0000-0000-0000-000000000002';
const DELE_REF = personaPublicRef(DELE);
const JOHN_REF = personaPublicRef(JOHN);

async function svc() {
  return {
    projection: await import('@/services/qubetalk/projection'),
    groups: await import('@/services/qubetalk/groups'),
    conversations: await import('@/services/qubetalk/conversations'),
    agentPolicy: await import('@/services/qubetalk/agentPolicy'),
  };
}

/** Seeds one passport_peer_channel between Dele and John, owned by Dele. */
function seedChannel(id: string) {
  fake.tables['passport_peer_channels'] = [
    ...(fake.tables['passport_peer_channels'] ?? []),
    {
      id,
      principal_a_ref: DELE_REF,
      principal_b_ref: JOHN_REF,
      created_by_ref: DELE_REF,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      principal_a_label: 'John (work)',
      principal_b_label: null,
      origin_domain: null,
    },
  ];
}

describe('QubeTalk projection contract — bounded visibility', () => {
  it("'full' profile with scope 'all' returns everything the principal owns, nothing more", async () => {
    const { projection, groups, conversations } = await svc();
    const CHANNEL = 'chan-1';
    seedChannel(CHANNEL);
    await conversations.createConversation({ relationshipChannelId: CHANNEL, topology: 'dyadic' });
    const group = await groups.createGroup(DELE_REF, { name: 'Horizon' });
    expect(group.ok).toBe(true);

    const result = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'full',
      scope: { relationshipChannelIds: 'all', groupIds: 'all' },
      requestingSurface: 'metame-runtime',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relationships.map((r) => r.channelId)).toEqual([CHANNEL]);
    expect(result.value.relationships[0].counterpartyDisplayLabel).toBe('John (work)');
    expect(result.value.relationships[0].conversationIds.length).toBe(1);
    expect(result.value.groups.length).toBe(1);
    expect(result.value.denied).toEqual([]);
  });

  it("'contextual' profile refuses scope 'all' outright — a cartridge can never ask for everything", async () => {
    const { projection } = await svc();
    seedChannel('chan-2');

    const result = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'contextual',
      scope: { relationshipChannelIds: 'all' },
      requestingSurface: 'cartridge:horizon',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relationships).toEqual([]);
    expect(result.value.denied.some((d) => d.reason === 'not_permitted_for_contextual_profile')).toBe(true);
  });

  it('a relationship the caller does not own is denied, never silently included', async () => {
    const { projection } = await svc();
    seedChannel('chan-owned');
    const result = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'contextual',
      scope: { relationshipChannelIds: ['someone-elses-channel'] },
      requestingSurface: 'cartridge:horizon',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relationships).toEqual([]);
    expect(result.value.denied).toEqual([{ relationshipChannelIds: ['someone-elses-channel'], groupIds: [], reason: 'not_owned' }]);
  });

  it('SURFACE CONTINUITY: a full-profile projection and a contextual one scoped to the same relationship return the IDENTICAL conversation id', async () => {
    const { projection, conversations } = await svc();
    const CHANNEL = 'chan-continuity';
    seedChannel(CHANNEL);
    const conv = await conversations.createConversation({ relationshipChannelId: CHANNEL, topology: 'dyadic' });
    expect(conv.ok).toBe(true);
    if (!conv.ok) return;

    const asRuntime = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'full',
      scope: { relationshipChannelIds: 'all' },
      requestingSurface: 'metame-runtime',
    });
    const asCartridge = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'contextual',
      scope: { relationshipChannelIds: [CHANNEL] },
      requestingSurface: 'cartridge:horizon',
    });
    expect(asRuntime.ok && asCartridge.ok).toBe(true);
    if (!asRuntime.ok || !asCartridge.ok) return;

    // Same underlying conversation id, whichever surface/profile asked —
    // changing interface never creates a new conversation.
    expect(asRuntime.value.relationships[0].conversationIds).toEqual([conv.value.id]);
    expect(asCartridge.value.relationships[0].conversationIds).toEqual([conv.value.id]);
    // requestingSurface is recorded for provenance only — it never widened
    // or narrowed WHICH conversation this is.
    expect(asRuntime.value.requestingSurface).toBe('metame-runtime');
    expect(asCartridge.value.requestingSurface).toBe('cartridge:horizon');
  });

  it('DELEGATION: an acting Agent with no policy grant for a relationship is denied it, even though the human principal owns it', async () => {
    const { projection } = await svc();
    const CHANNEL = 'chan-agent';
    seedChannel(CHANNEL);
    // No agent policy set anywhere -> resolveEffectiveAgentPolicy falls back
    // to 'no_agent' (the conservative default — never permissive).
    const result = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'full',
      scope: { relationshipChannelIds: 'all' },
      requestingSurface: 'aigentme',
      actingAgentRootDid: 'did:agent:root:some-agent',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relationships).toEqual([]);
    expect(result.value.denied.some((d) => d.reason === 'agent_not_authorized_for_scope' && d.relationshipChannelIds.includes(CHANNEL))).toBe(true);
  });

  it('DELEGATION: an acting Agent WITH an active bounded grant for the relationship is granted it', async () => {
    const { projection, agentPolicy } = await svc();
    const CHANNEL = 'chan-agent-2';
    seedChannel(CHANNEL);
    await agentPolicy.setAgentPolicy(DELE, {
      scopeType: 'relationship',
      scopeRef: CHANNEL,
      mode: 'agent_bounded',
      delegationGrantRef: 'did:agent:root:some-agent',
    });
    grantState = { status: 'active', agent_root_did: 'did:agent:root:some-agent' };

    const result = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'full',
      scope: { relationshipChannelIds: 'all' },
      requestingSurface: 'aigentme',
      actingAgentRootDid: 'did:agent:root:some-agent',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relationships.map((r) => r.channelId)).toEqual([CHANNEL]);
  });

  it('the projection returns SUMMARIES only — no message body field exists anywhere on the result shape', async () => {
    // Structural: disclosure of actual content stays behind the existing
    // message-read routes; this contract only bounds relationship/group
    // VISIBILITY. Asserts against the real service's return keys rather
    // than trusting a comment.
    const { projection, conversations } = await svc();
    const CHANNEL = 'chan-summary-only';
    seedChannel(CHANNEL);
    await conversations.createConversation({ relationshipChannelId: CHANNEL, topology: 'dyadic' });
    const result = await projection.requestProjection(DELE, {
      capability: 'qubetalk',
      projection: 'full',
      scope: { relationshipChannelIds: 'all' },
      requestingSurface: 'metame-runtime',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = Object.keys(result.value.relationships[0]);
    expect(keys).not.toContain('body');
    expect(keys).not.toContain('messages');
    expect(keys.sort()).toEqual(['channelId', 'conversationIds', 'counterpartyDisplayLabel', 'lastInteractionAt', 'openLoopCount'].sort());
  });
});
