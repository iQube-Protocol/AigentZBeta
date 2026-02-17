import { createHash } from 'crypto';

export type MessengerProvider = 'discord' | 'whatsapp' | 'telegram' | 'email' | 'sms';
export type ExperienceDepth = 'L0' | 'L1' | 'L2' | 'L3' | 'auto';
export type IntentHint =
  | 'ask'
  | 'share'
  | 'invite'
  | 'collect'
  | 'follow'
  | 'join'
  | 'help'
  | 'unknown';

export interface QubeTalkEnvelope {
  schema: 'metame.qubetalk.event.v0';
  tenant_id: string;
  experience_id: string;
  persona_id?: string;
  peer: {
    provider: MessengerProvider;
    provider_user_id: string;
    display_name?: string;
    handle?: string;
  };
  channel: {
    provider: MessengerProvider;
    channel_id: string;
    thread_id: string;
    message_id: string;
    reply_to?: string | null;
  };
  content: {
    text: string;
    attachments?: Array<{ type: 'image' | 'link' | 'file'; url: string; name?: string }>;
  };
  intent_hint: IntentHint;
  depth_hint: ExperienceDepth;
  context?: {
    campaign_id?: string;
    capsule_id?: string | null;
    pill_id?: string | null;
    utm?: { src?: string; med?: string; cmp?: string };
  };
  security?: {
    receipt_required?: boolean;
    signature?: string | null;
    policy_tags?: string[];
  };
  timestamps: {
    provider_ts: string;
    ingested_ts: string;
  };
}

export function computeThreadKeyV1(input: {
  tenantId: string;
  personaId: string;
  provider: MessengerProvider;
  providerUserId: string;
  experienceId: string;
}): string {
  const base = [
    input.tenantId,
    input.personaId,
    input.provider,
    input.providerUserId,
    input.experienceId,
  ].join('|');
  return createHash('sha256').update(base).digest('hex');
}

export function inferIntentHint(text: string): IntentHint {
  const value = text.toLowerCase();
  if (/collect|claim|reward|earn/.test(value)) return 'collect';
  if (/join|subscribe|register/.test(value)) return 'join';
  if (/follow/.test(value)) return 'follow';
  if (/share|invite/.test(value)) return 'share';
  if (/help|support/.test(value)) return 'help';
  if (!value.trim()) return 'unknown';
  return 'ask';
}
