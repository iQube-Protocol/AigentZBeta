/**
 * Inbound reply parsing (golden path #2, automated increment).
 *
 * Pure helpers for the Mailjet Parse API payload that lands on
 * /api/marketa/activation/inbound-reply. Kept free of network/DB so the
 * sender-extraction logic is unit-testable.
 *
 * Parse API payload (subset we use):
 *   { Sender: 'bounce@...', From: 'Name <person@example.com>',
 *     Subject: '...', 'Text-part': '...', Recipient: '...' }
 * `From` carries the human sender; `Sender` is the envelope sender and
 * can be a bounce/forwarding address, so From wins when parseable.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Extract the replying human's email from a Parse API payload. */
export function extractSenderEmail(payload: unknown): string | null {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  for (const field of ['From', 'Sender']) {
    const raw = body[field];
    if (typeof raw !== 'string') continue;
    const match = raw.match(EMAIL_RE);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

/** Short reply summary for the activation event (subject + first text line). */
export function summarizeReply(payload: unknown): string {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const subject = typeof body.Subject === 'string' ? body.Subject.trim() : '';
  const text = typeof body['Text-part'] === 'string' ? body['Text-part'] : '';
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const parts = [subject, firstLine].filter(Boolean);
  const summary = parts.join(' — ');
  return summary.length > 240 ? `${summary.slice(0, 237)}...` : summary;
}
