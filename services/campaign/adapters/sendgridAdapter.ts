/**
 * services/campaign/adapters/sendgridAdapter.ts
 *
 * Phase 2 — Native SendGrid email adapter.
 * Replaces the Make.com relay for outbound email dispatch.
 *
 * Each recipient gets a personalised email via SendGrid Dynamic Templates.
 * The investor's nakamoto ID is embedded as a `custom_arg` so it comes back
 * in every SendGrid event webhook, enabling zero-lookup write-backs.
 *
 * Required env vars:
 *   SENDGRID_API_KEY              — SendGrid API key (full access or mail send)
 *   SENDGRID_FROM_EMAIL           — Verified sender email
 *   SENDGRID_FROM_NAME            — Sender display name (default: KNYT Wheel)
 *
 * Per-sequence template IDs (set whichever sequences you use):
 *   SENDGRID_TEMPLATE_TOP_SHELF   — Dynamic template ID for knyt_top_shelf_v1
 *   SENDGRID_TEMPLATE_ZERO_KNYT   — Dynamic template ID for knyt_zero_v1
 *   SENDGRID_TEMPLATE_REACTIVATION — Dynamic template ID for knyt_reactivation_v1
 *   SENDGRID_TEMPLATE_GENERAL     — Dynamic template ID for knyt_general_v1
 *
 * Dynamic template variables available in SendGrid:
 *   {{first_name}}       — Recipient first name
 *   {{full_name}}        — Full name or email fallback
 *   {{ks_url}}           — Personalised KS tracking URL (pre-built)
 *   {{cohort}}           — Campaign cohort (top_shelf | zero_knyt | …)
 *   {{investment_band}}  — Investment band (<500 | 500-1999 | …)
 *   {{sequence_id}}      — Sequence identifier
 */

import type { ChannelAdapter, ChannelPayload } from '@/services/campaign/channelRegistry';
import { getCrmClient } from '@/services/crm/crmDataAccess';

// ── Config ────────────────────────────────────────────────────────────────────

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

function templateId(sequenceId: string): string {
  const map: Record<string, string | undefined> = {
    knyt_top_shelf_v1:    process.env.SENDGRID_TEMPLATE_TOP_SHELF,
    knyt_zero_v1:         process.env.SENDGRID_TEMPLATE_ZERO_KNYT,
    knyt_reactivation_v1: process.env.SENDGRID_TEMPLATE_REACTIVATION,
    knyt_general_v1:      process.env.SENDGRID_TEMPLATE_GENERAL,
  };
  return map[sequenceId] ?? '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchRecipients(ids: string[]) {
  const client = getCrmClient();
  // Batch in chunks to stay under PostgREST .in() limits
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
      const ksUrl  = `${appUrl}/api/crm/track/ks?uid=${id}&utm_source=knyt_wheel&utm_medium=${encodeURIComponent(channel)}&utm_content=${encodeURIComponent(cohort ?? 'general')}`;
      return {
        id,
        email,
        firstName:     first || email.split('@')[0],
        fullName:      `${first} ${last}`.trim() || email,
        cohort,
        investmentBand: band,
        ksTrackingUrl:  ksUrl,
      };
    });
}

// ── SendGrid send ─────────────────────────────────────────────────────────────

async function sendBatch(
  tmplId: string,
  sequenceId: string,
  recipients: Recipient[],
  fromEmail: string,
  fromName: string,
): Promise<{ success: boolean; error?: string }> {
  // SendGrid allows up to 1000 personalizations per request
  const personalizations = recipients.map((r) => ({
    to: [{ email: r.email, name: r.fullName }],
    dynamic_template_data: {
      first_name:      r.firstName,
      full_name:       r.fullName,
      ks_url:          r.ksTrackingUrl,
      cohort:          r.cohort ?? 'general',
      investment_band: r.investmentBand ?? '',
      sequence_id:     sequenceId,
    },
    // custom_args come back in every SendGrid event — enables zero-lookup write-backs
    custom_args: {
      investor_id: r.id,
      sequence_id: sequenceId,
    },
  }));

  const body = {
    from:        { email: fromEmail, name: fromName },
    template_id: tmplId,
    personalizations,
    tracking_settings: {
      click_tracking:  { enable: true,  enable_text: false },
      open_tracking:   { enable: true },
    },
  };

  const res = await fetch(SENDGRID_API_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  // SendGrid returns 202 Accepted on success
  if (res.status === 202) return { success: true };
  const text = await res.text().catch(() => '');
  return { success: false, error: `SendGrid HTTP ${res.status}: ${text.slice(0, 300)}` };
}

// ── Adapter export ────────────────────────────────────────────────────────────

export const sendgridAdapter: ChannelAdapter = {
  id:    'email_sendgrid',
  name:  'SendGrid Email',
  phase: 'active',

  async send(payload: ChannelPayload) {
    const apiKey    = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromName  = process.env.SENDGRID_FROM_NAME ?? 'KNYT Wheel';

    if (!apiKey)    return { success: false, error: 'SENDGRID_API_KEY not configured' };
    if (!fromEmail) return { success: false, error: 'SENDGRID_FROM_EMAIL not configured' };

    const tmplId = templateId(payload.sequenceId);
    if (!tmplId) {
      return {
        success: false,
        error: `No SendGrid template configured for sequence '${payload.sequenceId}'. ` +
               `Set SENDGRID_TEMPLATE_${payload.sequenceId.toUpperCase().replace(/-/g, '_')}.`,
      };
    }

    // Fetch and shape recipients
    const rows    = await fetchRecipients(payload.recipientIds);
    const recipients = buildRecipients(rows, payload.channel);

    if (recipients.length === 0) {
      return { success: false, error: 'No recipients with valid email addresses found' };
    }

    // Send in batches of 1000 (SendGrid limit)
    const BATCH = 1000;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const result = await sendBatch(
        tmplId,
        payload.sequenceId,
        recipients.slice(i, i + BATCH),
        fromEmail,
        fromName,
      );
      if (!result.success) return result;
    }

    console.info(
      `[sendgridAdapter] Dispatched ${recipients.length} emails` +
      ` — sequence=${payload.sequenceId} template=${tmplId}`
    );
    return { success: true };
  },
};
