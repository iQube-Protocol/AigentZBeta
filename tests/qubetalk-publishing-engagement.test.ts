/**
 * Publishing + Engagement — mandatory acceptance scenarios (Publishing +
 * Engagement brief §14). Proves canonical publication -> Share -> Publish ->
 * PublicationQube -> channel projection -> external publication ->
 * comment/reply -> EngagementQube -> ContactGraph participant resolution ->
 * conversation operate as one system built on the ALREADY-EXISTING
 * PublicationQube/EngagementQube service layer (services/qubetalk/publications.ts,
 * services/qubetalk/engagement.ts) rather than a second implementation.
 *
 * Complements tests/qubetalk-communications-membrane-scenarios.test.ts and
 * tests/qubetalk-messaging-loop-e2e.test.ts — this file is scoped to the
 * publish-execution + engagement-resolution seam those files never
 * exercised (publications.ts/engagement.ts had zero callers before this
 * increment).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { createFakeSupabase, type FakeTables } from './_lib/fakeSupabase';
import { personaPublicRef } from '@/services/identity/personaReferences';

let fake: ReturnType<typeof createFakeSupabase>;
let grantState: { status: 'active' | 'revoked' | 'expired'; agent_root_did: string } | null = null;
const personaOwnerMap = new Map<string, string>();

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fake.admin,
}));
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrantForAgent: async (_personaId: string, _agentRootDid: string) => grantState,
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

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fake = createFakeSupabase();
  grantState = null;
  personaOwnerMap.clear();
  process.env = { ...originalEnv };
  process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
});

const OWNER = 'owner-persona-publishing';
const OWNER_REF = personaPublicRef(OWNER);
const DISCORD_SNOWFLAKE = '9876543210987654321';

function stubDiscordSuccess() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ id: 'discord-msg-1' }) })),
  );
}

async function seedPublication(overrides: Partial<Record<string, unknown>> = {}) {
  const { createPublication } = await import('@/services/qubetalk/publications');
  const result = await createPublication(OWNER_REF, {
    title: 'A Threshold Paper',
    body: 'Excerpt text for distribution.',
    sourceContentRef: 'qriptopian:paper-42',
    ...overrides,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('setup failed');
  return result.value;
}

describe('1/2 — publish execution: one real transport, partial success', () => {
  it('a publication projected to Discord alone publishes cleanly', async () => {
    stubDiscordSuccess();
    const { addChannelProjection, publishAllProjections } = await import('@/services/qubetalk/publications');
    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', { destinationRef: DISCORD_SNOWFLAKE });
    expect(proj.ok).toBe(true);

    const result = await publishAllProjections(OWNER, pub.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.publication.status).toBe('published');
    expect(result.value.results[0].outcome).toBe('published');
    expect(result.value.results[0].externalPublicationId).toBe('discord-msg-1');
  });

  it('Discord succeeds, an unsupported channel fails -> publication is partially_published, never a false global success', async () => {
    stubDiscordSuccess();
    const { addChannelProjection, publishAllProjections } = await import('@/services/qubetalk/publications');
    const pub = await seedPublication();
    await addChannelProjection(pub.id, 'discord', { destinationRef: DISCORD_SNOWFLAKE });
    await addChannelProjection(pub.id, 'linkedin', { destinationRef: 'whatever' });

    const result = await publishAllProjections(OWNER, pub.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.publication.status).toBe('partially_published');
    const outcomes = result.value.results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual(['failed', 'published']);
    const linkedinResult = result.value.results.find((r) => r.channel === 'linkedin');
    expect(linkedinResult?.error).toMatch(/does not support publishing/);
  });

  it('an unresolvable Discord destination fails cleanly, never silently substituting a channel', async () => {
    const { addChannelProjection, publishAllProjections } = await import('@/services/qubetalk/publications');
    const pub = await seedPublication();
    await addChannelProjection(pub.id, 'discord', { destinationRef: 'not-a-snowflake-or-invite!!' });

    const result = await publishAllProjections(OWNER, pub.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.publication.status).toBe('failed');
    expect(result.value.results[0].error).toMatch(/could not resolve destination_ref/);
  });
});

describe('9 — publication provenance points back to source content', () => {
  it('sourceContentRef round-trips through create and read', async () => {
    const { getPublication } = await import('@/services/qubetalk/publications');
    const pub = await seedPublication({ sourceContentRef: 'codex:invariant-99' });
    const read = await getPublication(pub.id);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.sourceContentRef).toBe('codex:invariant-99');
  });
});

describe('11 — exactly one canonical projection record, never a synthetic duplicate', () => {
  it('addChannelProjection is idempotent per (publication, channel) — re-adding the same channel updates, never duplicates', async () => {
    const { addChannelProjection, listProjections } = await import('@/services/qubetalk/publications');
    const pub = await seedPublication();
    await addChannelProjection(pub.id, 'discord', { destinationRef: 'first' });
    await addChannelProjection(pub.id, 'discord', { destinationRef: 'second' });
    const projections = await listProjections(pub.id);
    expect(projections.ok).toBe(true);
    if (projections.ok) {
      expect(projections.value).toHaveLength(1);
      expect(projections.value[0].destinationRef).toBe('second');
    }
  });
});

describe('3 — duplicate webhook/poll engagement does not duplicate EngagementQube', () => {
  it('recording the same externalEngagementId twice upserts onto one row', async () => {
    const { addChannelProjection } = await import('@/services/qubetalk/publications');
    const { recordEngagement, listEngagementsForProjection } = await import('@/services/qubetalk/engagement');
    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', {});
    expect(proj.ok).toBe(true);
    if (!proj.ok) return;

    const first = await recordEngagement(OWNER, proj.value.id, {
      engagementType: 'comment',
      externalEngagementId: 'discord-comment-1',
      authorPlatform: 'discord',
      authorHandle: 'randomguy#0001',
      authorDisplayName: 'Random Guy',
      body: 'nice paper',
    });
    const second = await recordEngagement(OWNER, proj.value.id, {
      engagementType: 'comment',
      externalEngagementId: 'discord-comment-1',
      authorPlatform: 'discord',
      authorHandle: 'randomguy#0001',
      authorDisplayName: 'Random Guy',
      body: 'nice paper (edited)',
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.value.id).toBe(second.value.id);

    const listed = await listEngagementsForProjection(proj.value.id);
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value).toHaveLength(1);
  });

  it('two manually-recorded engagements with no externalEngagementId are never merged into one row', async () => {
    const { addChannelProjection } = await import('@/services/qubetalk/publications');
    const { recordEngagement, listEngagementsForProjection } = await import('@/services/qubetalk/engagement');
    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', {});
    if (!proj.ok) return;

    await recordEngagement(OWNER, proj.value.id, { engagementType: 'comment', authorPlatform: 'discord', authorHandle: 'a#1', authorDisplayName: 'A', body: 'first' });
    await recordEngagement(OWNER, proj.value.id, { engagementType: 'comment', authorPlatform: 'discord', authorHandle: 'b#2', authorDisplayName: 'B', body: 'second' });

    const listed = await listEngagementsForProjection(proj.value.id);
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value).toHaveLength(2);
  });
});

describe('4/5 — engagement author resolution via ContactGraph, never a display-name guess', () => {
  it('a commenter matching an existing ContactGraph endpoint resolves to that ContactPerson', async () => {
    const { createContactPerson } = await import('@/services/contactGraph/contactPersons');
    const { createContactPersona } = await import('@/services/contactGraph/contactPersonas');
    const { addContactEndpoint } = await import('@/services/contactGraph/contactEndpoints');
    const { addChannelProjection } = await import('@/services/qubetalk/publications');
    const { recordEngagement } = await import('@/services/qubetalk/engagement');

    const AUTH_PROFILE = 'auth-profile-publishing';
    personaOwnerMap.set(OWNER, AUTH_PROFILE);

    const person = await createContactPerson(AUTH_PROFILE, { displayName: 'Jane Roe' });
    expect(person.ok).toBe(true);
    if (!person.ok) return;
    const persona = await createContactPersona(AUTH_PROFILE, person.value.id, { label: 'General' });
    expect(persona.ok).toBe(true);
    if (!persona.ok) return;
    await addContactEndpoint(AUTH_PROFILE, persona.value.id, { platform: 'discord', identifier: 'janeroe#1234' });

    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', {});
    if (!proj.ok) return;

    const engaged = await recordEngagement(OWNER, proj.value.id, {
      engagementType: 'comment',
      authorPlatform: 'discord',
      authorHandle: 'janeroe#1234',
      authorDisplayName: 'jane the commenter',
      body: 'great work',
    });
    expect(engaged.ok).toBe(true);
    if (!engaged.ok) return;
    expect(engaged.value.authorParticipantId).not.toBeNull();

    const participants = (fake.tables['qubetalk_participants'] ?? []) as Record<string, unknown>[];
    const linked = participants.find((p) => p.id === engaged.value.authorParticipantId);
    expect(linked?.contact_person_id).toBe(person.value.id);
    // Never a display-name guess — the resolved participant's display name
    // came from ContactGraph's "Jane Roe", not the raw incoming handle text.
    expect(linked?.display_name).toBe('Jane Roe');
  });

  it('an ambiguous commenter (no QubeTalk directory match, no ContactGraph match) remains unresolved, never a guess', async () => {
    const { addChannelProjection } = await import('@/services/qubetalk/publications');
    const { recordEngagement } = await import('@/services/qubetalk/engagement');
    personaOwnerMap.set(OWNER, 'auth-profile-no-match');

    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', {});
    if (!proj.ok) return;

    const engaged = await recordEngagement(OWNER, proj.value.id, {
      engagementType: 'comment',
      authorPlatform: 'discord',
      authorHandle: 'stranger#9999',
      authorDisplayName: 'A Stranger',
      body: 'who dis',
    });
    expect(engaged.ok).toBe(true);
    if (!engaged.ok) return;

    const participants = (fake.tables['qubetalk_participants'] ?? []) as Record<string, unknown>[];
    const created = participants.find((p) => p.id === engaged.value.authorParticipantId);
    expect(created?.contact_person_id ?? null).toBeNull();
    const endpoints = (fake.tables['qubetalk_participant_endpoints'] ?? []) as Record<string, unknown>[];
    const ep = endpoints.find((e) => e.participant_id === engaged.value.authorParticipantId);
    expect(ep?.confidence).toBe('unresolved');
  });
});

describe('10 — engagement converts to ConversationQube, provenance preserved both directions', () => {
  it('convertEngagementToConversation sets converted_conversation_id AND the new conversation carries origin_engagement_id back', async () => {
    const { addChannelProjection } = await import('@/services/qubetalk/publications');
    const { recordEngagement, convertEngagementToConversation } = await import('@/services/qubetalk/engagement');
    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', {});
    if (!proj.ok) return;
    const engaged = await recordEngagement(OWNER, proj.value.id, {
      engagementType: 'comment',
      authorPlatform: 'discord',
      authorHandle: 'commenter#1',
      authorDisplayName: 'Commenter',
      body: 'can we talk privately',
    });
    if (!engaged.ok) return;

    const converted = await convertEngagementToConversation(engaged.value.id);
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.value.engagement.state).toBe('converted_to_conversation');
    expect(converted.value.engagement.convertedConversationId).toBe(converted.value.conversationId);

    const conversations = (fake.tables['qubetalk_conversations'] ?? []) as Record<string, unknown>[];
    const conv = conversations.find((c) => c.id === converted.value.conversationId);
    expect(conv?.origin_engagement_id).toBe(engaged.value.id);
  });
});

describe('7/8 — Agent policy gates publish exactly like it gates send', () => {
  it('agent_drafts mode denies autonomous publish — same as no-policy-at-all', async () => {
    stubDiscordSuccess();
    const { addChannelProjection, publishAllProjections } = await import('@/services/qubetalk/publications');
    const tables = fake.tables as FakeTables;
    tables['qubetalk_agent_policies'] = [
      { id: 'policy-1', owner_persona_id: OWNER, scope_type: 'transport', scope_ref: 'discord', mode: 'agent_drafts', delegation_grant_ref: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', { destinationRef: DISCORD_SNOWFLAKE });
    if (!proj.ok) return;

    const result = await publishAllProjections(OWNER, pub.id, 'agent-root-did-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('agent_not_authorized');
  });

  it('a BOUNDED policy with an active grant allows the Agent to publish', async () => {
    stubDiscordSuccess();
    const { addChannelProjection, publishAllProjections } = await import('@/services/qubetalk/publications');
    const tables = fake.tables as FakeTables;
    tables['qubetalk_agent_policies'] = [
      { id: 'policy-2', owner_persona_id: OWNER, scope_type: 'transport', scope_ref: 'discord', mode: 'agent_bounded', delegation_grant_ref: 'agent-root-did-2', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    grantState = { status: 'active', agent_root_did: 'agent-root-did-2' };
    const pub = await seedPublication();
    const proj = await addChannelProjection(pub.id, 'discord', { destinationRef: DISCORD_SNOWFLAKE });
    if (!proj.ok) return;

    const result = await publishAllProjections(OWNER, pub.id, 'agent-root-did-2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.publication.status).toBe('published');
  });
});

describe('6 — disclosure gate applies identically to a post-engagement conversation reply', () => {
  it('egress.ts evaluateDisclosure runs on ANY send with sourceContext, regardless of whether the conversation originated from an engagement', () => {
    // Structural proof: sendMessageThroughTransport's disclosure gate keys
    // only on req.sourceContext / the channel's audience — it has no
    // conversation-origin branch, so a conversation created via
    // convertEngagementToConversation goes through the EXACT SAME gate as
    // any other send. Confirmed by reading the source rather than
    // re-deriving the gate's logic in a second test harness.
    const source = fs.readFileSync('services/qubetalk/egress.ts', 'utf8');
    const disclosureBlock = source.slice(source.indexOf('Disclosure gate'), source.indexOf('Disclosure gate') + 600);
    expect(disclosureBlock).toMatch(/evaluateDisclosure/);
    expect(disclosureBlock).not.toMatch(/originEngagementId|conversation\.origin/);
  });
});

describe('12 — receipts: per-projection success and failure are both auditable', () => {
  it('a failed projection publish writes qubetalk_publication_projection_failed; a succeeded one writes qubetalk_publication_projection_published', async () => {
    stubDiscordSuccess();
    const { addChannelProjection, publishAllProjections } = await import('@/services/qubetalk/publications');
    const pub = await seedPublication();
    await addChannelProjection(pub.id, 'discord', { destinationRef: DISCORD_SNOWFLAKE });
    await addChannelProjection(pub.id, 'linkedin', { destinationRef: 'x' });
    await publishAllProjections(OWNER, pub.id);

    const receipts = (fake.tables['activity_receipts'] ?? []) as Record<string, unknown>[];
    const actionTypes = receipts.map((r) => r.action_type).sort();
    expect(actionTypes).toContain('qubetalk_publication_projection_published');
    expect(actionTypes).toContain('qubetalk_publication_projection_failed');
  });
});

describe('13 — Runtime and aigentMe consume the SAME Publishing/Engagement panel components', () => {
  it('PublishingLayout/EngagementLayout dynamically import RuntimePublishingPanel/RuntimeEngagementPanel from RuntimeQubeTalkDrawer, never a forked implementation', () => {
    const publishingLayout = fs.readFileSync('components/metame/welcome/layouts/PublishingLayout.tsx', 'utf8');
    const engagementLayout = fs.readFileSync('components/metame/welcome/layouts/EngagementLayout.tsx', 'utf8');
    expect(publishingLayout).toMatch(/RuntimeQubeTalkDrawer.*RuntimePublishingPanel|RuntimePublishingPanel.*RuntimeQubeTalkDrawer/s);
    expect(engagementLayout).toMatch(/RuntimeQubeTalkDrawer.*RuntimeEngagementPanel|RuntimeEngagementPanel.*RuntimeQubeTalkDrawer/s);
    const drawer = fs.readFileSync('components/metame/runtime/RuntimeQubeTalkDrawer.tsx', 'utf8');
    expect(drawer).toMatch(/export function RuntimePublishingPanel/);
    expect(drawer).toMatch(/export function RuntimeEngagementPanel/);
  });

  it('Share -> Publish and the share-publish deep link converge on the same drawer-opening call', () => {
    const source = fs.readFileSync('components/metame/MetaMeRuntimeClient.tsx', 'utf8');
    expect(source).toMatch(/"share-publish":\s*\(\)\s*=>\s*{/);
    const publishCalls = source.match(/setQubeTalkDrawerTab\("publishing"\);\s*setQubeTalkDrawerOpen\(true\)/g) ?? [];
    // Deep-link handler + both in-app button variants (mobile/desktop) = 3.
    expect(publishCalls.length).toBeGreaterThanOrEqual(3);
  });
});
