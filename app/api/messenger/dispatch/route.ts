import { NextRequest, NextResponse } from 'next/server';
import { runExperienceQubeTool, type ExperienceQubeTool } from '@/services/mcp/experienceQubeTools';
import { createChannel, createMessage, getChannel } from '@/services/qubetalk/qubetalkStore';
import {
  type MessengerProvider,
  type QubeTalkEnvelope,
  computeThreadKeyV1,
  inferIntentHint,
} from '@/services/mcp/qubetalkContracts';

export const runtime = 'nodejs';

const SUPPORTED_PROVIDERS = new Set<MessengerProvider>(['discord', 'whatsapp', 'telegram', 'email', 'sms']);
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const SUPPORTED_TOOLS = new Set<ExperienceQubeTool>([
  'pill.get',
  'capsule.get',
  'mini_runtime.get',
  'codex.entry',
  'invite.create',
  'share.compose',
  'next.best',
]);

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isDiscordSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function extractDiscordInviteCode(value: string): string | null {
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

function toAbsoluteUrl(origin: string, value: string): string {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${origin}${value}`;
  return value;
}

async function resolveDiscordChannelFromInvite(inviteCode: string): Promise<string | null> {
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

async function postDiscordMessages(params: {
  channelId: string;
  botToken: string;
  content: string;
  embed?: {
    title?: string;
    description?: string;
    url?: string;
    image?: { url: string };
    footer?: { text: string };
  } | null;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = String(body?.provider || 'discord') as MessengerProvider;
    if (!SUPPORTED_PROVIDERS.has(provider)) {
      return NextResponse.json({ success: false, error: 'Unsupported provider' }, { status: 400 });
    }

    const tenantId = String(body?.tenantId || 'qripto-codex');
    const experienceId = String(body?.experienceId || 'exp_metaknyt');
    const personaId = String(body?.personaId || 'prs_demo_guest');
    const dispatchMode = String(body?.mode || 'simulate').toLowerCase() === 'live' ? 'live' : 'simulate';
    const deliveryVariant = normalizeString(body?.variant) || 'runtime_thin_client';
    const requestedTool = String(body?.tool || 'next.best') as ExperienceQubeTool;
    const tool: ExperienceQubeTool = SUPPORTED_TOOLS.has(requestedTool) ? requestedTool : 'next.best';
    const messageText = String(body?.message || '').trim();
    if (!messageText) {
      return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
    }

    const providerUserId = String(body?.providerUserId || 'discord_demo_user');
    const messageId = `msg_${Date.now()}`;
    const threadKey = computeThreadKeyV1({
      tenantId,
      personaId,
      provider,
      providerUserId,
      experienceId,
    });

    const nowIso = new Date().toISOString();
    const envelope: QubeTalkEnvelope = {
      schema: 'metame.qubetalk.event.v0',
      tenant_id: tenantId,
      experience_id: experienceId,
      persona_id: personaId,
      peer: {
        provider,
        provider_user_id: providerUserId,
        display_name: String(body?.displayName || 'Demo User'),
        handle: String(body?.handle || 'demo-user'),
      },
      channel: {
        provider,
        channel_id: String(body?.channelId || `${provider}_channel_demo`),
        thread_id: threadKey,
        message_id: messageId,
        reply_to: null,
      },
      content: {
        text: messageText,
      },
      intent_hint: inferIntentHint(messageText),
      depth_hint: (body?.depthHint as 'L0' | 'L1' | 'L2' | 'L3' | 'auto') || 'auto',
      context: {
        campaign_id: typeof body?.campaignId === 'string' ? body.campaignId : undefined,
        capsule_id: typeof body?.capsuleId === 'string' ? body.capsuleId : null,
        pill_id: typeof body?.pillId === 'string' ? body.pillId : null,
        utm: {
          src: provider,
          med: 'mymessenger',
          cmp: typeof body?.campaignId === 'string' ? body.campaignId : 'experience-dispatch',
        },
      },
      security: {
        receipt_required: true,
        signature: null,
        policy_tags: ['public_ok'],
      },
      timestamps: {
        provider_ts: nowIso,
        ingested_ts: nowIso,
      },
    };

    const mcpResponse = runExperienceQubeTool({
      tool,
      input: {
        event: envelope,
        experience_id: experienceId,
        provider,
        intent: inferIntentHint(messageText),
      },
      tenantId,
      personaId,
    });

    const publishUrlInput = normalizeString(body?.publishUrl);
    const explicitPublishUrl = publishUrlInput ? toAbsoluteUrl(request.nextUrl.origin, publishUrlInput) : '';
    const primaryCta = mcpResponse.cta.primary;
    const fallbackCtaUrl =
      primaryCta?.target === 'url'
        ? toAbsoluteUrl(request.nextUrl.origin, String(primaryCta.value || ''))
        : `${request.nextUrl.origin}/studio/composer/experience/${encodeURIComponent(experienceId)}`;
    const ctaUrl = explicitPublishUrl || fallbackCtaUrl;
    const publishUrl = explicitPublishUrl || fallbackCtaUrl;
    const thumbnailInput = normalizeString(body?.thumbnailUrl);
    const thumbnailUrlRaw = thumbnailInput ? toAbsoluteUrl(request.nextUrl.origin, thumbnailInput) : '';
    const thumbnailUrl = /^https?:\/\//i.test(thumbnailUrlRaw) ? thumbnailUrlRaw : '';
    const embed = {
      title: normalizeString(body?.titleOverride) || mcpResponse.artifact.title || `ExperienceQube ${experienceId}`,
      description: mcpResponse.artifact.body?.slice(0, 4000) || undefined,
      url: publishUrl || undefined,
      image: thumbnailUrl ? { url: thumbnailUrl } : undefined,
      footer: { text: `ExperienceQube • ${experienceId}` },
    };
    const openLine = ctaUrl ? `Open ExperienceQube: ${ctaUrl}` : '';

    const providerDispatch = {
      provider,
      destination: envelope.channel.channel_id,
      kind: 'experience_qube',
      tool,
      variant: deliveryVariant,
      ctaUrl,
      publishUrl,
      embed,
      text: [mcpResponse.artifact.title, mcpResponse.artifact.body, openLine, mcpResponse.artifact.share_text]
        .filter(Boolean)
        .join('\n\n'),
      cta: mcpResponse.cta.primary || null,
    };
    const warnings: string[] = [];
    if (deliveryVariant === 'discord_experience_inline') {
      warnings.push(
        'Discord-native inline experience execution remains scaffolded. Current handoff uses the linked launch surface.'
      );
    }
    if (deliveryVariant === 'runtime_thin_client') {
      warnings.push('Runtime thin-client handoff depends on the linked metaMe runtime surface being publicly reachable.');
    }

    const qubetalkSender = {
      id: normalizeString(body?.fromAgentId) || `mymessenger:${provider}`,
      role: 'agent',
      name: normalizeString(body?.fromAgentName) || `myMessenger ${provider}`,
    };

    const qubetalkParticipants = Array.from(
      new Set(
        [
          qubetalkSender.id,
          `mcp:${tool}`,
          providerUserId,
          personaId,
          normalizeString(body?.toAgentId),
        ].filter(Boolean)
      )
    );

    const existingChannel = await getChannel(envelope.channel.channel_id, tenantId);
    if (!existingChannel) {
      await createChannel({
        channel_id: envelope.channel.channel_id,
        tenant_id: tenantId,
        participants: qubetalkParticipants,
      });
    }

    let liveDispatch: null | {
      provider: 'discord';
      channelId: string;
      messageIds: string[];
      mode: 'live';
    } = null;

    if (dispatchMode === 'live') {
      if (provider !== 'discord') {
        return NextResponse.json(
          { success: false, error: 'Live dispatch currently supports Discord only.' },
          { status: 400 }
        );
      }

      const botToken = normalizeString(process.env.DISCORD_BOT_TOKEN);
      if (!botToken) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing DISCORD_BOT_TOKEN. Configure it to enable live Discord dispatch.',
          },
          { status: 400 }
        );
      }

      const inputChannelRaw = normalizeString(body?.channelId);
      const inputChannelId = isDiscordSnowflake(inputChannelRaw) ? inputChannelRaw : '';
      const envChannelRaw = normalizeString(process.env.DISCORD_METAKNYTS_CHANNEL_ID);
      const envChannelId = isDiscordSnowflake(envChannelRaw) ? envChannelRaw : '';
      let channelId = inputChannelId || envChannelId;
      const inviteCode = extractDiscordInviteCode(String(body?.inviteUrl || body?.inviteCode || ''));
      if (!channelId && inviteCode) {
        channelId = (await resolveDiscordChannelFromInvite(inviteCode)) || '';
      }

      if (!channelId) {
        const hasInvalidInput = Boolean(inputChannelRaw) && !inputChannelId;
        return NextResponse.json(
          {
            success: false,
            error: hasInvalidInput
              ? 'Invalid Discord channel id format. Use a numeric channel id (Snowflake) or clear the field to use DISCORD_METAKNYTS_CHANNEL_ID.'
              : 'Missing Discord channel id. Provide channelId in request or set DISCORD_METAKNYTS_CHANNEL_ID.',
          },
          { status: 400 }
        );
      }

      const posted = await postDiscordMessages({
        channelId,
        botToken,
        content: providerDispatch.text,
        embed,
      });

      liveDispatch = {
        provider: 'discord',
        channelId,
        messageIds: posted.messageIds,
        mode: 'live',
      };
    }

    const qubetalkReceiptRef = normalizeString(mcpResponse?.cta?.primary?.value)
      ? `qt_receipt_${Date.now()}`
      : undefined;

    await createMessage({
      message_id: envelope.channel.message_id,
      channel_id: envelope.channel.channel_id,
      in_reply_to: envelope.channel.reply_to || undefined,
      from_agent: qubetalkSender,
      type: 'text',
      content: providerDispatch.text,
      iqube_refs: [experienceId],
      receipt_ref: qubetalkReceiptRef,
      metadata: {
        source: 'mymessenger-dispatch',
        provider,
        mode: dispatchMode,
        tool,
        variant: deliveryVariant,
        thread_key: threadKey,
        intent_hint: envelope.intent_hint,
        depth_hint: envelope.depth_hint,
        tenant_id: tenantId,
        persona_id: personaId,
        provider_user_id: providerUserId,
        dispatch: {
          cta_url: providerDispatch.ctaUrl,
          publish_url: providerDispatch.publishUrl,
          destination: providerDispatch.destination,
        },
        envelope,
        mcpResponse,
        liveDispatch,
      },
    });

    return NextResponse.json({
      success: true,
      envelope,
      mcpResponse,
      providerDispatch,
      liveDispatch,
      warnings: warnings.length > 0 ? warnings : undefined,
      trace: {
        adapter: `myMessenger:${provider}`,
        bus: 'QubeTalk',
        app: 'ExperienceQube MCP',
        mode: dispatchMode,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to dispatch message through myMessenger adapter',
      },
      { status: 500 }
    );
  }
}
