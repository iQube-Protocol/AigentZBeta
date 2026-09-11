/**
 * QubeTalk Communications Membrane — Discord transport promotion (Slice 2
 * Activation, per codexes/packs/agentiq/updates/2026-08-25_qubetalk-
 * communications-membrane-expansion-build.md §F/§I "Known limitations #5").
 *
 * Proves `services/qubetalk/egress.ts`'s `sendMessageThroughTransport` —
 * the ONE outbound send path that now wires the real, previously-only-
 * catalogued Discord transport (`services/qubetalk/transports/
 * discordTransport.ts`, the exact same Discord REST calls
 * `app/api/messenger/dispatch/route.ts` already used) into the domain
 * substrate's policy membrane. Per this repo's No-Guessing rule, there is
 * no live DISCORD_BOT_TOKEN or Discord server in this sandbox — the Discord
 * HTTP boundary is faked at the `fetch` level (this repo's own house
 * pattern for the third-party edge; see tests/agent-preflight.test.ts's
 * `vi.stubGlobal('fetch', ...)`), and every assertion below is about the
 * SURROUNDING logic this build actually owns: gating, provenance recording,
 * failure handling, and receipt emission — never a claim that Discord's own
 * API was exercised.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fake = createFakeSupabase();
  grantState = null;
  process.env = { ...originalEnv };
  delete process.env.DISCORD_BOT_TOKEN;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
});

const OWNER = 'owner-persona-discord-egress';
const OWNER_REF = personaPublicRef(OWNER);
const COUNTERPARTY_REF = personaPublicRef('counterparty-persona-discord-egress');
const OUTSIDER = 'outsider-persona-not-a-principal';
const CHANNEL_ID = 'channel-discord-egress-1';
const DISCORD_CHANNEL_ID = '1234567890123456789';

/** Seeds one active passport_peer_channel owned by OWNER. */
function seedChannel(id: string = CHANNEL_ID) {
  fake.tables['passport_peer_channels'] = [
    ...(fake.tables['passport_peer_channels'] ?? []),
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

/** A minimal successful Discord "post message" response. */
function stubDiscordSuccess(messageId = 'discord-msg-1') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      expect(String(url)).toContain(`/channels/${DISCORD_CHANNEL_ID}/messages`);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: messageId }),
      } as Response;
    }),
  );
}

/** A Discord API error response (e.g. bad permissions, invalid channel). */
function stubDiscordApiError(status = 403, message = 'Missing Access') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status,
      json: async () => ({ message }),
    } as Response)),
  );
}

async function egress() {
  return import('@/services/qubetalk/egress');
}

function messageRows(): Record<string, unknown>[] {
  return (fake.tables['passport_peer_messages'] ?? []) as Record<string, unknown>[];
}

function receiptRows(): Record<string, unknown>[] {
  return (fake.tables['activity_receipts'] ?? []) as Record<string, unknown>[];
}

describe('QubeTalk Discord transport egress — sendMessageThroughTransport', () => {
  it('AC1/AC7 — Discord is a REAL callable code path (not merely catalogued): a permitted human send reaches the transport and records provenance', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    stubDiscordSuccess('discord-msg-abc');
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'hello from QubeTalk',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.deliveryState).toBe('delivered');
    expect(res.value.externalMessageId).toBe('discord-msg-abc');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // AC4 — external message id, transport, and delivery state are retained
    // on the row that recorded the send.
    const rows = messageRows();
    expect(rows.length).toBe(1);
    expect(rows[0].transport).toBe('discord');
    expect(rows[0].direction).toBe('outbound');
    expect(rows[0].external_message_id).toBe('discord-msg-abc');
    expect(rows[0].delivery_state).toBe('delivered');
  });

  it('AC2 — the existing DISCORD_BOT_TOKEN gate is preserved EXACTLY: no token means the send never reaches Discord and is recorded failed, not delivered', async () => {
    seedChannel();
    // No DISCORD_BOT_TOKEN set (beforeEach already deletes it).
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'should never leave the building',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // AC5 — a failed send is never falsely reported as delivered.
    expect(res.value.deliveryState).toBe('failed');
    expect(res.value.externalMessageId).toBeNull();
    expect(res.value.error).toMatch(/DISCORD_BOT_TOKEN/);
    expect(fetchSpy).not.toHaveBeenCalled();

    const rows = messageRows();
    expect(rows.length).toBe(1);
    expect(rows[0].delivery_state).toBe('failed');
    expect(rows[0].external_message_id).toBeNull();
  });

  it('AC5 — a genuine Discord API failure (bad channel/permissions) is recorded failed, never delivered, and no external id is fabricated', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    stubDiscordApiError(403, 'Missing Access');
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'this will bounce',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.deliveryState).toBe('failed');
    expect(res.value.externalMessageId).toBeNull();
    expect(res.value.error).toMatch(/Missing Access/);

    const rows = messageRows();
    expect(rows[0].delivery_state).toBe('failed');
    expect(rows[0].external_message_id).toBeNull();
    // A failed send is not a "sent" act — no agent receipt for it either.
    expect(receiptRows().length).toBe(0);
  });

  it('AC3/AC9 — an unauthorized Agent send is DENIED before it ever reaches Discord (no fetch call, no message row)', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    // No agent policy set for this relationship at all -> resolves to
    // NO_AGENT (agentPolicy.ts never defaults to permissive).
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'an agent trying to speak without authority',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
      actingAgentRootDid: 'did:agent:root:rogue-agent',
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('agent_not_authorized');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(messageRows().length).toBe(0);
    expect(receiptRows().length).toBe(0);
  });

  it('AC3/AC6/AC9 — a BOUNDED, currently-active Agent grant sends, delivers, and writes the EXISTING receipt action type', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    stubDiscordSuccess('discord-msg-agent-1');

    const { sendMessageThroughTransport } = await egress();
    const agentPolicy = await import('@/services/qubetalk/agentPolicy');
    await agentPolicy.setAgentPolicy(OWNER, {
      scopeType: 'relationship',
      scopeRef: CHANNEL_ID,
      mode: 'agent_bounded',
      delegationGrantRef: 'did:agent:root:trusted-agent',
    });
    grantState = { status: 'active', agent_root_did: 'did:agent:root:trusted-agent' };

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'agent-authored, properly bounded',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
      actingAgentRootDid: 'did:agent:root:trusted-agent',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.deliveryState).toBe('delivered');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const rows = messageRows();
    expect(rows[0].acting_agent_ref).toBe('did:agent:root:trusted-agent');
    expect(rows[0].consequence).toBe('consequential');

    // AC6 — uses the EXISTING receipt/DVN action-type vocabulary; no new,
    // parallel logging mechanism.
    const receipts = receiptRows();
    expect(receipts.length).toBe(1);
    expect(receipts[0].action_type).toBe('qubetalk_message_agent_sent');
    expect(receipts[0].persona_id).toBe(OWNER);
  });

  it('AC3 — a REVOKED grant denies the send even though the policy row still says BOUNDED (live re-check, never a stale trust)', async () => {
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
      delegationGrantRef: 'did:agent:root:trusted-agent',
    });
    grantState = { status: 'revoked', agent_root_did: 'did:agent:root:trusted-agent' };

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'should be denied — grant just got revoked',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
      actingAgentRootDid: 'did:agent:root:trusted-agent',
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('agent_not_authorized');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a caller who is not a principal of the channel is denied before Discord is ever touched', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OUTSIDER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'an outsider trying to send on a channel they do not own',
      destination: { discordChannelId: DISCORD_CHANNEL_ID },
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('not_found');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(messageRows().length).toBe(0);
  });

  it('N11 — an genuinely unsupported transport is refused outright, never faked as sendable', async () => {
    seedChannel();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'whatsapp',
      body: 'whatsapp has no working integration in this repo',
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('transport_unsupported');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an unknown transport id (not in the registry at all) is refused, not silently treated as native', async () => {
    seedChannel();
    const { sendMessageThroughTransport } = await egress();
    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'carrier-pigeon',
      body: 'not a real transport',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('unknown_transport');
  });

  it('sending via Discord requires an explicit destination channel id — never silently guessed', async () => {
    seedChannel();
    process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'discord',
      body: 'no destination supplied',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('missing_destination');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC7 — the native transport still works through the SAME egress function, unaffected by Discord promotion', async () => {
    seedChannel();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { sendMessageThroughTransport } = await egress();

    const res = await sendMessageThroughTransport({
      callerPersonaId: OWNER,
      channelId: CHANNEL_ID,
      transport: 'qubetalk-native',
      body: 'plain native send',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.transport).toBe('qubetalk-native');
    expect(res.value.deliveryState).toBe('delivered');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(messageRows().length).toBe(1);
  });
});

describe('Discord transport module — no duplicate sender (AC7)', () => {
  it('app/api/messenger/dispatch/route.ts imports Discord send functions from the shared transport module instead of redefining them', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'app', 'api', 'messenger', 'dispatch', 'route.ts'), 'utf-8');
    expect(src).toMatch(/from '@\/services\/qubetalk\/transports\/discordTransport'/);
    // The route no longer defines its OWN copy of the Discord REST caller.
    expect(src).not.toMatch(/async function postDiscordMessages/);
    expect(src).not.toMatch(/async function resolveDiscordChannelFromInvite/);
  });

  it('services/qubetalk/egress.ts sends Discord messages through the SAME shared module, never a second implementation', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'services', 'qubetalk', 'egress.ts'), 'utf-8');
    expect(src).toMatch(/from '@\/services\/qubetalk\/transports\/discordTransport'/);
    expect(src).not.toMatch(/async function postDiscordMessages/);
  });
});
