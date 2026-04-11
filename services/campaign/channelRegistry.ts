/**
 * services/campaign/channelRegistry.ts
 *
 * Extensible channel adapter registry for KNYT Wheel campaign dispatch.
 *
 * Phase 0: Make.com webhook adapter routes all outbound messages.
 * Future phases: add SendGrid, Twilio, Telegram, X, LinkedIn, BlueSky,
 *   Reddit, Nostr, Substack, WhatsApp, Signal, Facebook, Instagram, TikTok,
 *   YouTube, Kickstarter/WeFunder/StartEngine platform updates, etc.
 *
 * Usage:
 *   import { getChannelAdapter } from '@/services/campaign/channelRegistry';
 *   const adapter = getChannelAdapter('make_com');
 *   await adapter.send({ ... });
 */

export interface ChannelPayload {
  /** Sequence identifier (e.g. knyt_top_shelf_v1) */
  sequenceId: string;
  /** Nakamoto IDs of recipients */
  recipientIds: string[];
  /** Target channel hint — Make.com reads this to route to the right scenario */
  channel: string;
  /** Additional context forwarded to Make.com for templating */
  context?: Record<string, unknown>;
  /** Optional pre-built Make.com dispatch payload (pass-through) */
  raw?: unknown;
}

export interface ChannelAdapter {
  id: string;
  name: string;
  /** 'active' = available now; 'planned' = not yet wired */
  phase: 'active' | 'planned';
  send(payload: ChannelPayload): Promise<{ success: boolean; error?: string }>;
}

// ── Phase 0: Make.com webhook adapter ────────────────────────────────────────

const makeDotComAdapter: ChannelAdapter = {
  id: 'make_com',
  name: 'Make.com Webhook',
  phase: 'active',
  async send(payload) {
    const webhookUrl = process.env.MAKE_KNYT_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('[channelRegistry] MAKE_KNYT_WEBHOOK_URL not set — dispatch skipped');
      return { success: false, error: 'MAKE_KNYT_WEBHOOK_URL not configured' };
    }
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { success: true };
      const text = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${text}` };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ── Stub adapter factory for planned channels ─────────────────────────────────

function plannedAdapter(id: string, name: string): ChannelAdapter {
  return {
    id,
    name,
    phase: 'planned',
    async send() {
      console.warn(`[channelRegistry] Channel '${id}' is not yet active.`);
      return { success: false, error: `Channel '${id}' not yet active` };
    },
  };
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const channelRegistry: Record<string, ChannelAdapter> = {
  // ── Phase 0 ──────────────────────────────────────────────────────────────
  make_com:             makeDotComAdapter,

  // ── Phase 2 (native email / SMS) ──────────────────────────────────────────
  email_sendgrid:       plannedAdapter('email_sendgrid', 'SendGrid Email'),
  sms_twilio:           plannedAdapter('sms_twilio', 'Twilio SMS'),

  // ── Phase 2+ (social / messaging) ─────────────────────────────────────────
  telegram:             plannedAdapter('telegram', 'Telegram'),
  twitter_x:            plannedAdapter('twitter_x', 'X (Twitter)'),
  linkedin:             plannedAdapter('linkedin', 'LinkedIn'),
  bluesky:              plannedAdapter('bluesky', 'BlueSky'),
  reddit:               plannedAdapter('reddit', 'Reddit'),
  nostr:                plannedAdapter('nostr', 'Nostr'),
  substack:             plannedAdapter('substack', 'Substack'),
  whatsapp:             plannedAdapter('whatsapp', 'WhatsApp'),
  signal:               plannedAdapter('signal', 'Signal'),
  facebook:             plannedAdapter('facebook', 'Facebook'),
  instagram:            plannedAdapter('instagram', 'Instagram'),
  tiktok:               plannedAdapter('tiktok', 'TikTok'),
  youtube:              plannedAdapter('youtube', 'YouTube'),

  // ── Platform updates ──────────────────────────────────────────────────────
  kickstarter_update:   plannedAdapter('kickstarter_update', 'Kickstarter Campaign Update'),
  wefunder_update:      plannedAdapter('wefunder_update', 'WeFunder Campaign Update'),
  startengine_update:   plannedAdapter('startengine_update', 'StartEngine Campaign Update'),
};

/**
 * Returns the adapter for a given channel ID.
 * Falls back to make_com for unknown channels so dispatch never silently drops.
 */
export function getChannelAdapter(channelId: string): ChannelAdapter {
  return channelRegistry[channelId] ?? makeDotComAdapter;
}

/** Lists all active channels available for dispatch. */
export function getActiveChannels(): ChannelAdapter[] {
  return Object.values(channelRegistry).filter((a) => a.phase === 'active');
}
