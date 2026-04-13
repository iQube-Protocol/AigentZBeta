/**
 * services/campaign/adapters/mailjetAdapter.ts
 *
 * Phase 2 — Mailjet email adapter.
 * Sends personalised transactional emails via the Mailjet Send API v3.1.
 *
 * Key difference from SendGrid: Mailjet allows max 50 messages per API call,
 * so the adapter automatically batches larger recipient lists.
 *
 * Attribution: Each message carries a `CustomID` of the form
 * `<investor_id>|<sequence_id>`. Mailjet echoes this back in every event
 * webhook payload, enabling zero-lookup write-backs.
 *
 * Required env vars:
 *   MAILJET_API_KEY               — Mailjet API public key
 *   MAILJET_SECRET_KEY            — Mailjet API secret key
 *   MAILJET_FROM_EMAIL            — Verified sender email
 *   MAILJET_FROM_NAME             — Sender display name (default: KNYT Wheel)
 *
 * Per-sequence template IDs (Mailjet template integer IDs):
 *   MAILJET_TEMPLATE_TOP_SHELF    — Template ID for knyt_top_shelf_v1
 *   MAILJET_TEMPLATE_ZERO_KNYT    — Template ID for knyt_zero_v1
 *   MAILJET_TEMPLATE_REACTIVATION — Template ID for knyt_reactivation_v1
 *   MAILJET_TEMPLATE_GENERAL      — Template ID for knyt_general_v1
 *
 * Template variables available in Mailjet (use {{var:first_name}} syntax):
 *   {{var:first_name}}       — Recipient first name
 *   {{var:full_name}}        — Full name or email fallback
 *   {{var:ks_url}}           — Personalised KS tracking URL
 *   {{var:cohort}}           — Campaign cohort
 *   {{var:investment_band}}  — Investment band
 *   {{var:sequence_id}}      — Sequence identifier
 */

import type { ChannelAdapter, ChannelPayload } from '@/services/campaign/channelRegistry';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { selectPrimaryReward, buildRewardTrackingUrl, formatSavings, type KsReward } from '@/services/campaign/ksRewards';

// ── Config ────────────────────────────────────────────────────────────────────

const MAILJET_API_URL = 'https://api.mailjet.com/v3.1/send';
// Mailjet hard limit is 50 messages per API call
const MAILJET_BATCH_LIMIT = 50;

function templateId(sequenceId: string): number | null {
  const map: Record<string, string | undefined> = {
    knyt_top_shelf_v1:    process.env.MAILJET_TEMPLATE_TOP_SHELF,
    knyt_zero_v1:         process.env.MAILJET_TEMPLATE_ZERO_KNYT,
    knyt_reactivation_v1: process.env.MAILJET_TEMPLATE_REACTIVATION,
    knyt_general_v1:      process.env.MAILJET_TEMPLATE_GENERAL,
  };
  const raw = map[sequenceId];
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}

function basicAuth(): string {
  const key    = process.env.MAILJET_API_KEY    ?? '';
  const secret = process.env.MAILJET_SECRET_KEY ?? '';
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

// ── Recipient fetch + shape ────────────────────────────────────────────────────

async function fetchRecipients(ids: string[]) {
  const client = getCrmClient();
  const CHUNK = 500;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await client
      .from('nakamoto_knyt_personas')
      .select('id, "Email", "First-Name", "Last-Name", campaign_cohort, investment_amount_band')
      .in('id', ids.slice(i, i + CHUNK));
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return rows;
}

interface Recipient {
  id: string;
  email: string;
  firstName: string;
  fullName: string;
  cohort: string | null;
  investmentBand: string | null;
  ksTrackingUrl: string;
  reward: KsReward;
}

function buildRecipients(rows: Record<string, unknown>[], channel: string): Recipient[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev-beta.aigentz.me';
  return rows
    .filter((r) => typeof r['Email'] === 'string' && r['Email'])
    .map((r) => {
      const id     = r['id'] as string;
      const email  = r['Email'] as string;
      const first  = (r['First-Name'] as string | null) ?? '';
      const last   = (r['Last-Name']  as string | null) ?? '';
      const cohort = (r['campaign_cohort'] as string | null) ?? null;
      const band   = (r['investment_amount_band'] as string | null) ?? null;
      const reward = selectPrimaryReward(cohort, band);
      const ksUrl  = buildRewardTrackingUrl(appUrl, id, reward, channel, cohort);
      return {
        id,
        email,
        firstName:      first || email.split('@')[0],
        fullName:       `${first} ${last}`.trim() || email,
        cohort,
        investmentBand: band,
        ksTrackingUrl:  ksUrl,
        reward,
      };
    });
}

// ── Mailjet send ──────────────────────────────────────────────────────────────

async function sendBatch(
  tmplId: number,
  sequenceId: string,
  recipients: Recipient[],
  fromEmail: string,
  fromName: string,
  isFirstBatch: boolean,
): Promise<{ success: boolean; error?: string }> {
  // BCC admin on the first message only — one copy per sequence send, not per recipient
  const bccEmail = process.env.MAILJET_BCC_EMAIL;

  const messages = recipients.map((r, idx) => ({
    From:            { Email: fromEmail, Name: fromName },
    To:              [{ Email: r.email, Name: r.fullName }],
    ...(bccEmail && isFirstBatch && idx === 0 ? { Bcc: [{ Email: bccEmail }] } : {}),
    TemplateID:      tmplId,
    TemplateLanguage: true,
    Variables: {
      first_name:          r.firstName,
      full_name:           r.fullName,
      ks_url:              r.ksTrackingUrl,
      cohort:              r.cohort ?? 'general',
      investment_band:     r.investmentBand ?? '',
      sequence_id:         sequenceId,
      // Investor reward tier
      reward_name:         r.reward.name,
      reward_price:        `$${r.reward.investorPrice.toLocaleString()}`,
      reward_full_price:   r.reward.fullPrice ? `$${r.reward.fullPrice.toLocaleString()}` : '',
      reward_savings:      formatSavings(r.reward),
    },
    // CustomID echoed back in every Mailjet event — zero-lookup attribution
    CustomID: `${r.id}|${sequenceId}`,
  }));

  const res = await fetch(MAILJET_API_URL, {
    method:  'POST',
    headers: {
      'Authorization': basicAuth(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ Messages: messages }),
  });

  if (res.ok) return { success: true };
  const text = await res.text().catch(() => '');
  return { success: false, error: `Mailjet HTTP ${res.status}: ${text.slice(0, 300)}` };
}

// ── Adapter export ────────────────────────────────────────────────────────────

export const mailjetAdapter: ChannelAdapter = {
  id:    'email_mailjet',
  name:  'Mailjet Email',
  phase: 'active',

  async send(payload: ChannelPayload) {
    const apiKey    = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    const fromEmail = process.env.MAILJET_FROM_EMAIL;
    const fromName  = process.env.MAILJET_FROM_NAME ?? 'KNYT Wheel';

    if (!apiKey || !secretKey) return { success: false, error: 'MAILJET_API_KEY / MAILJET_SECRET_KEY not configured' };
    if (!fromEmail)            return { success: false, error: 'MAILJET_FROM_EMAIL not configured' };

    const tmplId = templateId(payload.sequenceId);
    if (!tmplId) {
      return {
        success: false,
        error: `No Mailjet template configured for sequence '${payload.sequenceId}'. ` +
               `Set MAILJET_TEMPLATE_${payload.sequenceId.toUpperCase().replace(/-/g, '_')}.`,
      };
    }

    const rows       = await fetchRecipients(payload.recipientIds);
    const recipients = buildRecipients(rows, payload.channel);

    if (recipients.length === 0) {
      return { success: false, error: 'No recipients with valid email addresses found' };
    }

    // Batch at Mailjet's 50-message limit
    for (let i = 0; i < recipients.length; i += MAILJET_BATCH_LIMIT) {
      const result = await sendBatch(
        tmplId,
        payload.sequenceId,
        recipients.slice(i, i + MAILJET_BATCH_LIMIT),
        fromEmail,
        fromName,
        /* isFirstBatch */ i === 0,
      );
      if (!result.success) return result;
    }

    console.info(
      `[mailjetAdapter] Dispatched ${recipients.length} emails` +
      ` — sequence=${payload.sequenceId} template=${tmplId}`
    );
    return { success: true };
  },
};
