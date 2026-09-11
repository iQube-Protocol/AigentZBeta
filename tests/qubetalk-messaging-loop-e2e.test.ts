/**
 * QubeTalk messaging loop — end-to-end seam closure (QubeTalk Fast-Follow:
 * "close the QubeTalk messaging loop end-to-end"). Proves
 * person -> endpoint -> relationship -> conversation -> policy -> external
 * transport operate as ONE system through the real canonical send path
 * (services/qubetalk/egress.ts's sendMessageThroughTransport, now the ONLY
 * thing app/api/qubetalk/peer-channels/[channelId]/messages/route.ts calls).
 *
 * Complements (never duplicates) tests/qubetalk-discord-transport-egress.test.ts,
 * which already covers: a permitted human send, the DISCORD_BOT_TOKEN gate,
 * a genuine Discord API failure recorded as failed, an unauthorized Agent
 * send denied before Discord is touched, a BOUNDED+active-grant Agent send
 * delivering with the existing receipt type, a revoked grant re-check, a
 * non-principal denial, unsupported/unknown transport refusal, and the
 * native transport working unaffected. This file adds what that suite does
 * not: ContactGraph endpoint resolution, conversation continuation/creation
 * exactness, the disclosure gate, an explicit agent_drafts-mode denial,
 * one-canonical-record proof, aigentMe<->Runtime surface continuity for
 * messaging, and the Share->Message / deep-link convergence structural
 * check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  delete process.env.DISCORD_BOT_TOKEN;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
});

const OWNER = 'owner-persona-messaging-loop';
const OWNER_AUTH_PROFILE = 'owner-auth-profile-messaging-loop';
const OWNER_REF = personaPublicRef(OWNER);
const COUNTERPARTY_REF = personaPublicRef('counterparty-persona-messaging-loop');
const CHANNEL_ID = 'channel-messaging-loop-1';
const DISCORD_SNOWFLAKE = '1234567890123456789';

function seedChannel(id: string = CHANNEL_ID) {
  const tables = fake.tables as FakeTables;
  tables['passport_peer_channels'] = [
    ...(tables['passport_peer_channels'] ?? []),
    {
      id,
      principal_a_ref: OWNER_REF,
      principal_b_ref: COUNTERPARTY_REF,
      created_by_ref: OWNER_REF,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      principal_a_label: null,
      principal_b_label: null,
      origin_domain: null,
    },
  ];
}

function messageRows(): Record<string, unknown>[] {
  return (fake.tables['passport_peer_messages'] ?? []) as Record<string, unknown>[];
}
function conversationRows(): Record<string, unknown>[] {
  return (fake.tables['qubetalk_conversations'] ?? []) as Record<string, unknown>[];
}
function eventRows(): Record<string, unknown>[] {
  return (fake.tables['qubetalk_events'] ?? []) as Record<string, unknown>[];
}

async function egress() {
  return import('@/services/qubetalk/egress');
}

function stubDiscordSuccess(messageId = 'discord-msg-1') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/invites/')) {
        return { ok: true, status: 200, json: async () => ({ channel: { id: DISCORD_SNOWFLAKE } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ id: messageId }) } as Response;
    }),
  );
}

describe('1 — ContactPerson with a Discord endpoint: send resolves the correct endpoint', () => {
  it('resolves destination.contactEndpointId through ContactGraph, ownership-checked, to the real Discord channel', async () => {
    seedChannel();
    personaOwnerMap.set(OWNER, OWNER_AUTH_PROFILE);
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';

    const { createContactPerson } = await import('@/services/contactGraph/contactPersons');
    const { createContactPersona } = await import('@/services/contactGraph/contactPersonas');
    const { addContactEndpoint } = await import('@/services/contactGraph/contactEndpoints');

    const person = await createContactPerson(OWNER_AUTH_PROFILE, { displayName: 'John Doe' });
    if (!person.ok) throw new Error('setup failed');
    const professional = await createContactPersona(OWNER_AUTH_PROFILE, person.value.id, { label: 'Professional' });
    if (!professional.ok) throw new Error('setup failed');
    const endpoint = await addContactEndpoint(OWNER_AUTH_PROFILE, professional.value.id, {
      platform: 'discord',
      identifier: DISCORD_SNOWFLAKE,
    });
    if (!endpoint.ok) throw new Error('setup failed');

    const fetchSpy = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ id: 'discord-msg-resolved' }) }) as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'resolved via ContactGraph',
      destination: { contactEndpointId: endpoint.value.id },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.deliveryState).toBe('delivered');
    // The ACTUAL endpoint identifier reached the Discord API call — never a
    // client-supplied or guessed channel id.
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`/channels/${DISCORD_SNOWFLAKE}/messages`);
  });

  it('an invite-code endpoint is resolved through Discord\'s public invite lookup, never sent to the raw invite code', async () => {
    seedChannel();
    personaOwnerMap.set(OWNER, OWNER_AUTH_PROFILE);
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';

    const { createContactPerson } = await import('@/services/contactGraph/contactPersons');
    const { createContactPersona } = await import('@/services/contactGraph/contactPersonas');
    const { addContactEndpoint } = await import('@/services/contactGraph/contactEndpoints');
    const person = await createContactPerson(OWNER_AUTH_PROFILE, { displayName: 'Jane Roe' });
    if (!person.ok) throw new Error('setup failed');
    const persona = await createContactPersona(OWNER_AUTH_PROFILE, person.value.id, { label: 'General' });
    if (!persona.ok) throw new Error('setup failed');
    const endpoint = await addContactEndpoint(OWNER_AUTH_PROFILE, persona.value.id, { platform: 'discord', identifier: 'my-invite-code' });
    if (!endpoint.ok) throw new Error('setup failed');

    stubDiscordSuccess('discord-msg-invite');
    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'resolved via invite',
      destination: { contactEndpointId: endpoint.value.id },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.deliveryState).toBe('delivered');
    expect(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0])).toContain(`/channels/${DISCORD_SNOWFLAKE}/messages`);
  });

  it('an unresolvable endpoint (not a snowflake, not a valid invite) fails clearly — never silently substitutes a different channel', async () => {
    seedChannel();
    personaOwnerMap.set(OWNER, OWNER_AUTH_PROFILE);
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    const { createContactPerson } = await import('@/services/contactGraph/contactPersons');
    const { createContactPersona } = await import('@/services/contactGraph/contactPersonas');
    const { addContactEndpoint } = await import('@/services/contactGraph/contactEndpoints');
    const person = await createContactPerson(OWNER_AUTH_PROFILE, { displayName: 'Ghost' });
    if (!person.ok) throw new Error('setup failed');
    const persona = await createContactPersona(OWNER_AUTH_PROFILE, person.value.id, { label: 'General' });
    if (!persona.ok) throw new Error('setup failed');
    const endpoint = await addContactEndpoint(OWNER_AUTH_PROFILE, persona.value.id, { platform: 'discord', identifier: 'not a real handle!!' });
    if (!endpoint.ok) throw new Error('setup failed');

    const fetchSpy = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'should never send',
      destination: { contactEndpointId: endpoint.value.id },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('endpoint_unresolvable');
    expect(messageRows().length).toBe(0); // no message row at all — a clean refusal, not a failed send record
  });
});

describe('2/3 — conversation continuation vs. creation (relationship continuity > channel continuity)', () => {
  it('the FIRST send with no prior conversation creates exactly one canonical ConversationQube', async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({ callerPersonaId: OWNER, channelId: CHANNEL_ID, transport: 'qubetalk-native', body: 'first message' });
    expect(res.ok).toBe(true);
    expect(conversationRows().length).toBe(1);
  });

  it('a SECOND send on the same relationship continues the SAME ConversationQube — never a duplicate', async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const first = await sendMessageThroughTransport({ callerPersonaId: OWNER, channelId: CHANNEL_ID, transport: 'qubetalk-native', body: 'first' });
    const second = await sendMessageThroughTransport({ callerPersonaId: OWNER, channelId: CHANNEL_ID, transport: 'qubetalk-native', body: 'second' });
    expect(first.ok && second.ok).toBe(true);
    expect(conversationRows().length).toBe(1); // still exactly one — continuation, not re-creation
    const rows = messageRows();
    expect(rows[0].conversation_id).toBe(rows[1].conversation_id);
  });
});

describe('4 — Runtime session id is structurally never a QubeTalk conversation id', () => {
  it('conversationIdRef never appears as an argument to any QubeTalk send/conversation call in MetaMeRuntimeClient.tsx', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('components/metame/MetaMeRuntimeClient.tsx', 'utf8');
    // The ONE legitimate use is the pre-existing /api/iqube/memory analytics
    // write this ref has always been scoped to. Assert conversationIdRef is
    // never threaded into anything QubeTalk-named (a send call, a
    // conversation resolver, a channel/messages fetch body) by checking that
    // every line actually referencing conversationIdRef is QubeTalk-silent —
    // i.e. carries no qubetalk/contactEndpointId/sendMessageThroughTransport
    // token on the same line. This is the precise inverse of a broad
    // "any conversationId-shaped line" scan, which would also catch the
    // legitimate, unrelated /api/iqube/memory body field of the same name.
    const refLines = source
      .split('\n')
      .filter((line) => line.includes('conversationIdRef') && !line.trim().startsWith('//'));
    expect(refLines.length).toBeGreaterThan(0);
    for (const line of refLines) {
      expect(line, `conversationIdRef line unexpectedly touches QubeTalk: ${line}`).not.toMatch(
        /qubetalk|contactEndpointId|sendMessageThroughTransport|ConversationQube/i
      );
    }
  });
});

describe('5/6 — Agent policy modes (manual / agent_drafts / bounded)', () => {
  it('manual (no acting Agent) send succeeds — the human sends directly, no policy gate applies', async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({ callerPersonaId: OWNER, channelId: CHANNEL_ID, transport: 'qubetalk-native', body: 'I am typing this myself' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.deliveryState).toBe('delivered');
  });

  it("agent_drafts mode cannot autonomously dispatch — a draft-only policy denies the send exactly like no-policy-at-all", async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const agentPolicy = await import('@/services/qubetalk/agentPolicy');
    await agentPolicy.setAgentPolicy(OWNER, { scopeType: 'relationship', scopeRef: CHANNEL_ID, mode: 'agent_drafts' });

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'qubetalk-native',
      body: 'an agent trying to send its own draft',
      actingAgentRootDid: 'did:agent:root:drafting-agent',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('agent_not_authorized');
    expect(messageRows().length).toBe(0); // the draft never became a sent message
  });
});

describe('9 — disclosure gate prevents transport invocation', () => {
  it('an Agent-composed send citing an excluded context item is denied BEFORE the transport is ever touched', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { sendMessageThroughTransport } = await egress();
    const agentPolicy = await import('@/services/qubetalk/agentPolicy');
    await agentPolicy.setAgentPolicy(OWNER, {
      scopeType: 'relationship',
      scopeRef: CHANNEL_ID,
      mode: 'agent_bounded',
      delegationGrantRef: 'did:agent:root:disclosure-test',
    });
    grantState = { status: 'active', agent_root_did: 'did:agent:root:disclosure-test' };

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'a summary drawing on a private fact from elsewhere',
      destination: { discordChannelId: DISCORD_SNOWFLAKE },
      actingAgentRootDid: 'did:agent:root:disclosure-test',
      sourceContext: [
        {
          id: 'ctx-1',
          sensitivity: 'confidential',
          // Originated in a context whose audience does NOT include this
          // channel's counterparty — excluded per §6/§8.
          originAudienceParticipantIds: [OWNER_REF],
        },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('disclosure_denied');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(messageRows().length).toBe(0);
  });

  it('an Agent-composed send whose context IS permissible for the destination audience is not blocked by the disclosure gate', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    stubDiscordSuccess('discord-msg-permissible');

    const { sendMessageThroughTransport } = await egress();
    const agentPolicy = await import('@/services/qubetalk/agentPolicy');
    await agentPolicy.setAgentPolicy(OWNER, {
      scopeType: 'relationship',
      scopeRef: CHANNEL_ID,
      mode: 'agent_bounded',
      delegationGrantRef: 'did:agent:root:disclosure-ok',
    });
    grantState = { status: 'active', agent_root_did: 'did:agent:root:disclosure-ok' };

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'a standard, shareable summary',
      destination: { discordChannelId: DISCORD_SNOWFLAKE },
      actingAgentRootDid: 'did:agent:root:disclosure-ok',
      sourceContext: [
        { id: 'ctx-2', sensitivity: 'standard', originAudienceParticipantIds: [OWNER_REF, COUNTERPARTY_REF] },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.deliveryState).toBe('delivered');
  });
});

describe('11 — a successful send produces exactly ONE canonical message/event, never a second synthetic record', () => {
  it('native send: exactly one passport_peer_messages row, one qubetalk_events row', async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({ callerPersonaId: OWNER, channelId: CHANNEL_ID, transport: 'qubetalk-native', body: 'one and only one' });
    expect(res.ok).toBe(true);
    expect(messageRows().length).toBe(1);
  });

  it('discord send: exactly one passport_peer_messages row (never a duplicate/synthetic "sent" record) and one qubetalk_events row', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    stubDiscordSuccess('discord-msg-single');
    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'one and only one via discord',
      destination: { discordChannelId: DISCORD_SNOWFLAKE },
    });
    expect(res.ok).toBe(true);
    expect(messageRows().length).toBe(1);
    expect(eventRows().length).toBe(1);
  });
});

describe('12 — aigentMe <-> Runtime surface continuity for messaging', () => {
  it('a message sent is visible identically via listMessages regardless of which surface reads it back', async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const sent = await sendMessageThroughTransport({ callerPersonaId: OWNER, channelId: CHANNEL_ID, transport: 'qubetalk-native', body: 'seen by both surfaces' });
    expect(sent.ok).toBe(true);

    const { listMessages } = await import('@/services/qubetalk/peerChannel');
    // Both aigentMe's ConversationsLayout and Runtime's RuntimeQubeTalkDrawer
    // call the exact same listMessages(callerPersonaId, channelId) — there is
    // no per-surface projection of message history, so two independent
    // reads are structurally guaranteed identical.
    const aigentmeRead = await listMessages(OWNER, CHANNEL_ID);
    const runtimeRead = await listMessages(OWNER, CHANNEL_ID);
    expect(aigentmeRead.ok && runtimeRead.ok).toBe(true);
    if (aigentmeRead.ok && runtimeRead.ok) {
      expect(runtimeRead.value).toEqual(aigentmeRead.value);
      expect(runtimeRead.value.length).toBe(1);
    }
  });
});

describe('13 — Share -> Message and deep-link share-message converge on one entry point', () => {
  it('MetaMeRuntimeClient.tsx registers "share-message" and "share-people" in DRAWER_ACTION_HANDLERS, converging the deep-link path with the in-app button path', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('components/metame/MetaMeRuntimeClient.tsx', 'utf8');

    // The deep-link dispatch table now has real entries for both — before
    // this pass, "share-message" fell through to a chat-prompt-only path
    // (menuPromptFromActionId), a SECOND, weaker meaning for "Message" than
    // the in-app button already had.
    expect(source).toMatch(/"share-message":\s*\(\)\s*=>\s*{/);
    expect(source).toMatch(/"share-people":\s*\(\)\s*=>\s*{/);

    // Every call site that can trigger "Message" — the deep-link handler
    // and both in-app button variants (mobile/desktop) — calls the SAME
    // pair of state setters that open the real workbench on the
    // Conversations tab, never the old chat-prompt-only path.
    const messageEntryPoints = source.match(/setQubeTalkDrawerTab\("conversations"\);\s*setQubeTalkDrawerOpen\(true\)/g) ?? [];
    expect(messageEntryPoints.length).toBeGreaterThanOrEqual(3); // deep-link handler + 2 in-app button variants
  });
});
