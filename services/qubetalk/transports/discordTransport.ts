/**
 * QubeTalk Communications Membrane — Discord transport adapter (§15/§16).
 *
 * REUSE, NOT A REBUILD: these are the exact same Discord REST wrappers that
 * previously lived inline in `app/api/messenger/dispatch/route.ts`
 * (`postDiscordMessages`, `resolveDiscordChannelFromInvite`, and their
 * helpers) — moved here verbatim so there is exactly ONE Discord-calling
 * code path in the repo, imported by both the tenant-runtime dispatch route
 * (System A, unchanged behavior) and the new QubeTalk System C egress path
 * (`services/qubetalk/egress.ts`). Never fork this a second time.
 *
 * "Constitutionally dumb" adapter (§16): this module NEVER decides Agent
 * authority, disclosure, relationship identity, Standing/rewards,
 * consequence, or conversation importance. Its only gate is mechanical —
 * whether a bot token was supplied — which is availability, not policy.
 * Every policy decision happens upstream, in agentPolicy.ts/egress.ts,
 * BEFORE a send ever reaches this module.
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isDiscordSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

export function extractDiscordInviteCode(value: string): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  const direct = raw.replace(/^\/+|\/+$/g, '');
  if (/^[A-Za-z0-9-]{2,}$/.test(direct)) return direct;
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'invite' || parts[0] === 'gg')) {
      const code = parts[1];
      return /^[A-Za-z0-9-]{2,}$/.test(code) ? code : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Public, ungated invite→channel resolution (a narrow slice of
 *  `identity.lookup`, registered 'restricted' — not general profile lookup —
 *  in transportRegistry.ts). */
export async function resolveDiscordChannelFromInvite(inviteCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${DISCORD_API_BASE}/invites/${encodeURIComponent(inviteCode)}?with_counts=true`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const channelId = normalizeString(data?.channel?.id);
    return channelId || null;
  } catch {
    return null;
  }
}

function chunkDiscordContent(content: string, maxLen = 1900): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length) {
    const next = trimmed.slice(cursor, cursor + maxLen);
    chunks.push(next);
    cursor += maxLen;
  }
  return chunks;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  image?: { url: string };
  footer?: { text: string };
}

/**
 * Resolve a raw destination reference (already a Discord channel snowflake,
 * or an invite code/URL) to a real channel id. Shared by every caller that
 * needs "turn what the caller supplied into a channel id" — egress.ts's
 * message send and publications.ts's publish execution both call this
 * rather than re-implementing snowflake/invite detection (never fork the
 * one Discord-calling code path's resolution logic either).
 */
export async function resolveDiscordChannelReference(reference: string): Promise<string | null> {
  const trimmed = normalizeString(reference);
  if (!trimmed) return null;
  if (isDiscordSnowflake(trimmed)) return trimmed;
  const inviteCode = extractDiscordInviteCode(trimmed);
  if (inviteCode) return resolveDiscordChannelFromInvite(inviteCode);
  return null;
}

/**
 * `group.send` (registered 'restricted' in transportRegistry.ts — gated on
 * `DISCORD_BOT_TOKEN`, which this function does not itself read from env; the
 * caller supplies it, so this module has no ambient environment coupling and
 * stays a pure, testable transport). Throws on a Discord API error — callers
 * (egress.ts, the dispatch route) are responsible for catching and recording
 * the failure honestly (never silently reporting delivery on a throw).
 */
export async function postDiscordMessages(params: {
  channelId: string;
  botToken: string;
  content: string;
  embed?: DiscordEmbed | null;
}): Promise<{ messageIds: string[] }> {
  const segments = chunkDiscordContent(params.content);
  if (segments.length === 0) return { messageIds: [] };

  const messageIds: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const payload: Record<string, unknown> = {
      content: segment,
      allowed_mentions: { parse: [] },
    };
    if (index === 0 && params.embed) {
      payload.embeds = [params.embed];
    }
    const res = await fetch(`${DISCORD_API_BASE}/channels/${params.channelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${params.botToken}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = normalizeString(data?.message) || `Discord API error ${res.status}`;
      throw new Error(detail);
    }
    const messageId = normalizeString(data?.id);
    if (messageId) messageIds.push(messageId);
  }
  return { messageIds };
}

/**
 * Convenience wrapper every Discord-sending caller needs identically: apply
 * the `DISCORD_BOT_TOKEN` gate, call `postDiscordMessages`, and turn a
 * missing token or a thrown API error into an honest `deliveryState:
 * 'failed'` outcome rather than a raised exception — the "attempt, then
 * record the REAL outcome" discipline `services/qubetalk/egress.ts` and
 * `services/qubetalk/offplatformRelationships.ts`'s `postOffplatformMessage`
 * both need. Factored here (not duplicated in each caller) because this
 * module is the designated single Discord-calling code path.
 */
export async function sendDiscordContent(
  discordChannelId: string,
  content: string,
): Promise<{ deliveryState: 'delivered' | 'failed'; externalMessageId: string | null; error?: string }> {
  const botToken = (process.env.DISCORD_BOT_TOKEN || '').trim();
  if (!botToken) {
    return { deliveryState: 'failed', externalMessageId: null, error: 'Missing DISCORD_BOT_TOKEN. Configure it to enable live Discord dispatch.' };
  }
  try {
    const posted = await postDiscordMessages({ channelId: discordChannelId, botToken, content });
    if (posted.messageIds.length > 0) {
      return { deliveryState: 'delivered', externalMessageId: posted.messageIds[0] };
    }
    return { deliveryState: 'failed', externalMessageId: null, error: 'Discord accepted no message content (empty after trim)' };
  } catch (err) {
    return { deliveryState: 'failed', externalMessageId: null, error: err instanceof Error ? err.message : 'Discord send failed' };
  }
}
