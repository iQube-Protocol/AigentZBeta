import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DISCORD_API_BASE = "https://discord.com/api/v10";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractDiscordInviteCode(value: string): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  const direct = raw.replace(/^\/+|\/+$/g, "");
  if (/^[A-Za-z0-9-]{2,}$/.test(direct)) return direct;
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && (parts[0] === "invite" || parts[0] === "gg")) {
      const code = parts[1];
      return /^[A-Za-z0-9-]{2,}$/.test(code) ? code : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function GET(request: NextRequest) {
  try {
    const botToken = normalizeString(process.env.DISCORD_BOT_TOKEN);
    const queryChannelId = normalizeString(request.nextUrl.searchParams.get("channelId"));
    const queryInvite = normalizeString(request.nextUrl.searchParams.get("inviteUrl"));
    const envChannelId = normalizeString(process.env.DISCORD_METAKNYTS_CHANNEL_ID);

    const inviteCode = extractDiscordInviteCode(queryInvite);
    let resolvedChannelId = queryChannelId || envChannelId;
    let inviteChannelId: string | null = null;
    let inviteGuildId: string | null = null;

    if (inviteCode) {
      const invite = await fetchJson(`${DISCORD_API_BASE}/invites/${encodeURIComponent(inviteCode)}?with_counts=true`);
      inviteChannelId = normalizeString(invite.data?.channel?.id) || null;
      inviteGuildId = normalizeString(invite.data?.guild?.id) || null;
      if (!resolvedChannelId && inviteChannelId) resolvedChannelId = inviteChannelId;
    }

    if (!botToken) {
      return NextResponse.json({
        success: false,
        provider: "discord",
        ready: false,
        checks: {
          botToken: false,
          botIdentity: false,
          channelIdResolved: Boolean(resolvedChannelId),
          channelAccess: false,
        },
        details: {
          channelId: resolvedChannelId || null,
          inviteChannelId,
          inviteGuildId,
        },
        error: "DISCORD_BOT_TOKEN is missing.",
      });
    }

    const authHeaders = { Authorization: `Bot ${botToken}` };
    const me = await fetchJson(`${DISCORD_API_BASE}/users/@me`, { headers: authHeaders });
    const botIdentityOk = me.ok && Boolean(normalizeString(me.data?.id));
    const botName = normalizeString(me.data?.username) || null;
    const botId = normalizeString(me.data?.id) || null;

    let channelAccess = false;
    let channelName: string | null = null;
    let guildId: string | null = null;
    let channelError: string | null = null;
    if (resolvedChannelId && botIdentityOk) {
      const channel = await fetchJson(`${DISCORD_API_BASE}/channels/${encodeURIComponent(resolvedChannelId)}`, {
        headers: authHeaders,
      });
      channelAccess = channel.ok;
      channelName = normalizeString(channel.data?.name) || null;
      guildId = normalizeString(channel.data?.guild_id) || null;
      if (!channel.ok) {
        channelError = normalizeString(channel.data?.message) || `Discord API ${channel.status}`;
      }
    }

    const ready = botIdentityOk && Boolean(resolvedChannelId) && channelAccess;
    return NextResponse.json({
      success: true,
      provider: "discord",
      ready,
      checks: {
        botToken: true,
        botIdentity: botIdentityOk,
        channelIdResolved: Boolean(resolvedChannelId),
        channelAccess,
      },
      details: {
        botId,
        botName,
        channelId: resolvedChannelId || null,
        channelName,
        guildId,
        inviteChannelId,
        inviteGuildId,
      },
      errors: {
        botIdentity: botIdentityOk ? null : normalizeString(me.data?.message) || "Failed to validate bot token.",
        channelAccess: channelError,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        provider: "discord",
        ready: false,
        error: error?.message || "Failed to verify Discord connection.",
      },
      { status: 500 }
    );
  }
}

