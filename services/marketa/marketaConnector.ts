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

export function getMarketaConnector(id: string): GoogleConnector | null {
  return id === MARKETA_SEND_ID
    ? (marketaSendTransactional as unknown as GoogleConnector)
    : null;
}
