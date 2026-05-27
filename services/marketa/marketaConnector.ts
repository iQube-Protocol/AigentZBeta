/**
 * services/marketa/marketaConnector.ts — Aigent Me Phase 6.b Part 3.
 *
 * Compose-and-send transactional email through Mailjet, distinct from the
 * existing campaign sequence pipeline (which renders Mailjet templates
 * against the investors table).
 *
 * Shape mirrors GoogleConnector so the existing /api/connectors/execute
 * route + ArtifactCard second-tier approval flow can dispatch to it
 * uniformly. Marketa send is always approval-gated.
 *
 * Privacy: personaId is T0; never serialised. The send payload carries
 * only the values the user typed (to/subject/body) plus the env-configured
 * From identity. No persona, intent, or experience details leak.
 */

import type { GoogleConnector, ConnectorExecuteResult } from '@/services/google/connectors';
import { expandCohortToRecipients, type CohortRecipient } from '@/services/marketa/cohortExpansion';

interface MarketaSendInput {
  to: string;
  subject: string;
  bodyText: string;
  cc?: string;
  bcc?: string;
  /** Optional override of the From name (defaults to MAILJET_FROM_NAME). */
  fromName?: string;
}

interface MarketaSendOutput {
  messageId: string | null;
  to: string;
  subject: string;
}

const MARKETA_SEND_ID = 'marketa.send-transactional';

function parseAddresses(raw: string): Array<{ Email: string }> {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /@/.test(s))
    .map((Email) => ({ Email }));
}

export const marketaSendTransactional: GoogleConnector<MarketaSendInput, MarketaSendOutput> = {
  // Re-using the GoogleConnector shape on purpose — the runtime/UI layer
  // treats it identically. The connector id namespace ('marketa.*') keeps
  // it distinguishable in receipts and the ConnectorQube catalog.
  id: MARKETA_SEND_ID as unknown as GoogleConnector['id'],
  label: 'Marketa · Send transactional email',
  description:
    'Send a one-off transactional email via Mailjet using the platform From identity. Requires approval — externalises content to the recipient.',
  category: 'communication',
  // The source field on GoogleConnector is typed to GoogleSource; cast
  // here to keep the shared registry shape without widening the type.
  source: 'gmail' as unknown as GoogleConnector['source'],
  requiredScopes: [],
  requiresApproval: true,
  inputSchema: {
    to: { type: 'string', description: 'Recipient email (or comma-separated list)', required: true },
    subject: { type: 'string', description: 'Email subject', required: true },
    bodyText: { type: 'string', description: 'Plain-text body', required: true },
    cc: { type: 'string', description: 'Comma-separated CC' },
    bcc: { type: 'string', description: 'Comma-separated BCC' },
    fromName: { type: 'string', description: 'Override From name' },
  },
  outputSchema: {
    messageId: { type: 'string', description: 'Mailjet message id' },
    to: { type: 'string', description: 'Resolved recipient list' },
    subject: { type: 'string', description: 'Subject used' },
  },
  async execute(input): Promise<ConnectorExecuteResult<MarketaSendOutput>> {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    const fromEmail = process.env.MAILJET_FROM_EMAIL;
    const fromName = (input.fromName?.trim() || process.env.MAILJET_FROM_NAME || 'Marketa').trim();
    if (!apiKey || !secretKey || !fromEmail) {
      return {
        ok: false,
        code: 'not-configured',
        reason: 'Mailjet env vars missing (MAILJET_API_KEY / MAILJET_SECRET_KEY / MAILJET_FROM_EMAIL).',
        hint: 'Operator action — set the three vars in Amplify env.',
      };
    }
    if (!input.to || !input.subject || !input.bodyText) {
      return { ok: false, code: 'invalid-input', reason: 'to + subject + bodyText required' };
    }
    const To = parseAddresses(input.to);
    if (To.length === 0) {
      return { ok: false, code: 'invalid-input', reason: 'no valid recipient addresses in `to`' };
    }
    const Cc = input.cc ? parseAddresses(input.cc) : [];
    const Bcc = input.bcc ? parseAddresses(input.bcc) : [];

    const message: Record<string, unknown> = {
      From: { Email: fromEmail, Name: fromName },
      To,
      Subject: input.subject,
      TextPart: input.bodyText,
    };
    if (Cc.length > 0) message.Cc = Cc;
    if (Bcc.length > 0) message.Bcc = Bcc;

    try {
      const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
      const res = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Messages: [message] }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ok: false,
          code: 'api-error',
          reason: `Mailjet send failed (${res.status}): ${text.slice(0, 200)}`,
        };
      }
      const data = (await res.json()) as {
        Messages?: Array<{ Status?: string; To?: Array<{ MessageID?: string }> }>;
      };
      const first = data.Messages?.[0];
      const messageId = first?.To?.[0]?.MessageID ?? null;
      return {
        ok: true,
        output: {
          messageId,
          to: To.map((t) => t.Email).join(', '),
          subject: input.subject,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ── Cohort batch send ───────────────────────────────────────────────
//
// Sends a single Mailjet batch (chunked to MAILJET_BATCH_LIMIT) to
// every member of a CRM cohort. Operator approves ONCE for the whole
// cohort. Personalisation lands via Mailjet's `Variables` per-message
// substitution against `{{first_name}}` / `{{full_name}}` tokens in
// the subject + body text the operator drafted in the compose modal.
//
// CustomID = `cohort:<campaign>:<cohort>|<recipient_id>` echoes back
// in every Mailjet webhook event (open / click / bounce / spam) so
// the existing `/api/crm/webhooks/mailjet` handler can attribute
// per-recipient state without a lookup. The receipt the activity
// log writes references the cohort + total count — individual
// metrics surface later via a workbench dashboard reading the
// webhook events.
//
// 2026-05-27 — operator chose batch (cheaper + faster, single
// approval). Per-recipient receipts are stubbed; cohort-level
// receipt is the canonical record.

interface MarketaSendCohortInput {
  campaignId: string;
  cohortId: string | null;
  subject: string;
  bodyText: string;
  fromName?: string;
}

interface MarketaSendCohortOutput {
  campaignLabel: string;
  cohortLabel: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  batches: number;
  /** First Mailjet message id from the first batch — for the receipt. */
  firstMessageId: string | null;
}

const MARKETA_SEND_COHORT_ID = 'marketa.send-cohort';
const MAILJET_BATCH_LIMIT = 50;

/**
 * Apply `{{first_name}}` / `{{full_name}}` / `{{email}}` substitution
 * to the template text against a recipient row. Mailjet ALSO supports
 * server-side substitution via Variables, but doing it here lets the
 * preview-then-send flow show the resolved text to the operator
 * before submission, and means we don't depend on Mailjet's template
 * language for a one-off send.
 */
function applySubstitution(template: string, r: CohortRecipient): string {
  return template
    .replace(/{{\s*first_name\s*}}/gi, r.firstName ?? '')
    .replace(/{{\s*full_name\s*}}/gi, r.fullName)
    .replace(/{{\s*email\s*}}/gi, r.email);
}

function chunkRecipients<T>(rs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rs.length; i += size) out.push(rs.slice(i, i + size));
  return out;
}

export const marketaSendCohort: GoogleConnector<MarketaSendCohortInput, MarketaSendCohortOutput> = {
  id: MARKETA_SEND_COHORT_ID as unknown as GoogleConnector['id'],
  label: 'Marketa · Send to cohort',
  description:
    'Send a personalised email batch to every member of a Marketa CRM cohort via Mailjet. Operator approves once for the whole cohort. Per-recipient tracking flows through the Mailjet webhook.',
  category: 'communication',
  source: 'gmail' as unknown as GoogleConnector['source'],
  requiredScopes: [],
  requiresApproval: true,
  inputSchema: {
    campaignId: { type: 'string', description: 'Marketa campaign id (knyt_codex / knyt_partners / ks_prospects)', required: true },
    cohortId: { type: 'string', description: 'Cohort id within the campaign (top_shelf / wave_1 / etc.)' },
    subject: { type: 'string', description: 'Email subject (supports {{first_name}} etc.)', required: true },
    bodyText: { type: 'string', description: 'Plain-text body (supports {{first_name}} etc.)', required: true },
    fromName: { type: 'string', description: 'Override From name' },
  },
  outputSchema: {
    campaignLabel:    { type: 'string',  description: 'Human label for the campaign' },
    cohortLabel:      { type: 'string',  description: 'Human label for the cohort' },
    totalRecipients:  { type: 'number',  description: 'Recipients resolved from the CRM' },
    sent:             { type: 'number',  description: 'Successful Mailjet sends' },
    failed:           { type: 'number',  description: 'Failed Mailjet sends' },
    batches:          { type: 'number',  description: 'Number of Mailjet API calls used' },
    firstMessageId:   { type: 'string',  description: 'First message id (for receipt anchoring)' },
  },
  async execute(input): Promise<ConnectorExecuteResult<MarketaSendCohortOutput>> {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    const fromEmail = process.env.MAILJET_FROM_EMAIL;
    const fromName = (input.fromName?.trim() || process.env.MAILJET_FROM_NAME || 'Marketa').trim();
    if (!apiKey || !secretKey || !fromEmail) {
      return {
        ok: false,
        code: 'not-configured',
        reason: 'Mailjet env vars missing (MAILJET_API_KEY / MAILJET_SECRET_KEY / MAILJET_FROM_EMAIL).',
        hint: 'Operator action — set the three vars in Amplify env.',
      };
    }
    if (!input.campaignId || !input.subject || !input.bodyText) {
      return { ok: false, code: 'invalid-input', reason: 'campaignId + subject + bodyText required' };
    }

    const expansion = await expandCohortToRecipients(input.campaignId, input.cohortId);
    if (!expansion.ok) {
      return { ok: false, code: 'invalid-input', reason: `Cohort expansion failed: ${expansion.reason}` };
    }
    if (expansion.totalRecipients === 0) {
      return {
        ok: false,
        code: 'invalid-input',
        reason: `Cohort '${expansion.cohortLabel}' has no recipients with valid email addresses.`,
      };
    }

    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    const cohortTag = `cohort:${expansion.campaignId}:${expansion.cohortId ?? 'all'}`;

    const batches = chunkRecipients(expansion.recipients, MAILJET_BATCH_LIMIT);
    let sent = 0;
    let failed = 0;
    let firstMessageId: string | null = null;

    for (const batch of batches) {
      const messages = batch.map((r) => ({
        From: { Email: fromEmail, Name: fromName },
        To: [{ Email: r.email, Name: r.fullName }],
        Subject: applySubstitution(input.subject, r),
        TextPart: applySubstitution(input.bodyText, r),
        // CustomID echoed back on every Mailjet webhook event for
        // per-recipient attribution without a DB lookup. Same format
        // the campaign sequence pipeline uses.
        CustomID: `${cohortTag}|${r.id}`,
      }));

      try {
        const res = await fetch('https://api.mailjet.com/v3.1/send', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ Messages: messages }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error(`[marketa.send-cohort] batch failed (${res.status}): ${text.slice(0, 200)}`);
          failed += batch.length;
          continue;
        }
        const data = (await res.json()) as {
          Messages?: Array<{ Status?: string; To?: Array<{ MessageID?: string }> }>;
        };
        for (const m of data.Messages ?? []) {
          if (m?.Status === 'success') sent += 1;
          else failed += 1;
          if (!firstMessageId && m?.To?.[0]?.MessageID) firstMessageId = m.To[0].MessageID;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[marketa.send-cohort] batch exception: ${msg}`);
        failed += batch.length;
      }
    }

    return {
      ok: true,
      output: {
        campaignLabel: expansion.campaignLabel,
        cohortLabel: expansion.cohortLabel,
        totalRecipients: expansion.totalRecipients,
        sent,
        failed,
        batches: batches.length,
        firstMessageId,
      },
    };
  },
};

export function getMarketaConnector(id: string): GoogleConnector | null {
  if (id === MARKETA_SEND_ID) return marketaSendTransactional as unknown as GoogleConnector;
  if (id === MARKETA_SEND_COHORT_ID) return marketaSendCohort as unknown as GoogleConnector;
  return null;
}
