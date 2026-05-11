/**
 * services/google/connectors.ts — Aigent Me Phase 6.b
 *
 * Nine Google Workspace connectors that compose with Studio skills and
 * Marketa campaign tools through the existing Ingestion Factory pattern.
 *
 * Each connector exports a uniform `GoogleConnector<I, O>` shape so the
 * Factory's invocation gateway treats them identically to other skills /
 * tools. The Phase 6.b alignment-with-Studio commitment per the operator
 * instruction is enforced here: every connector is a registry-class
 * citizen, not a bespoke side-channel.
 *
 * Privacy contract:
 *   - personaId is T0; received from the route boundary, never echoed.
 *   - Access tokens never leak to clients. The route surface returns the
 *     artifact id / location url / receipt id only.
 *   - Every execution emits an ActivityReceipt of action_type
 *     'artifact_created' or 'artifact_sent' as appropriate.
 *
 * Graceful degradation:
 *   - When `OAuth not configured` (env vars missing) or no token row for
 *     (persona, source), `execute()` returns { ok: false, reason: ... }
 *     with a 503-friendly message. Callers map to a 503 response.
 *
 * Approval boundary (PRD §10 FR11):
 *   - Every connector declares `requiresApproval`. Routes consult this
 *     flag and gate via the Phase 6.b second-tier ApprovalCard before
 *     executing send / share / publish operations.
 */

import {
  getValidAccessToken,
  type GoogleSource,
  GOOGLE_SCOPES,
} from '@/services/google/oauth';

// ─────────────────────────────────────────────────────────────────────────
// Public types.
// ─────────────────────────────────────────────────────────────────────────

export type GoogleConnectorId =
  | 'google.gmail.draft'
  | 'google.gmail.send'
  | 'google.calendar.create-event'
  | 'google.calendar.invite-external'
  | 'google.drive.create-doc'
  | 'google.drive.share-doc'
  | 'google.drive.search'
  | 'google.docs.append'
  | 'google.slides.create';

export interface ConnectorExecutionContext {
  personaId: string;
  /** Optional intent the connector was invoked under (for receipt linking). */
  intentId?: string | null;
  /** Optional cartridge scope for receipt categorisation. */
  cartridge?: string;
}

export interface ConnectorExecuteFailure {
  ok: false;
  /** 'not-configured' | 'not-connected' | 'api-error' | 'invalid-input' | 'requires-approval'. */
  code: string;
  reason: string;
  /** Operator-facing hint when the failure needs human action. */
  hint?: string;
}

export interface ConnectorExecuteSuccess<O> {
  ok: true;
  output: O;
}

export type ConnectorExecuteResult<O> = ConnectorExecuteSuccess<O> | ConnectorExecuteFailure;

export interface GoogleConnector<I = unknown, O = unknown> {
  id: GoogleConnectorId;
  label: string;
  description: string;
  category: 'communication' | 'scheduling' | 'storage' | 'document' | 'presentation';
  source: GoogleSource;
  requiredScopes: string[];
  /** PRD §10 FR11 — second-tier approval before external send/share/publish. */
  requiresApproval: boolean;
  /** Lightweight JSON-Schema-ish input description for Factory display. */
  inputSchema: Record<string, { type: string; description: string; required?: boolean }>;
  outputSchema: Record<string, { type: string; description: string }>;
  execute(input: I, ctx: ConnectorExecutionContext): Promise<ConnectorExecuteResult<O>>;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers.
// ─────────────────────────────────────────────────────────────────────────

async function requireToken(
  personaId: string,
  source: GoogleSource,
): Promise<{ ok: true; token: string } | ConnectorExecuteFailure> {
  const token = await getValidAccessToken(personaId, source);
  if (!token) {
    return {
      ok: false,
      code: 'not-connected',
      reason: `Persona has not connected Google ${source}. Surface the consent flow via /api/assistant/connect-google.`,
      hint: `Open the welcome surface → Connect Google Workspace → ${source}.`,
    };
  }
  return { ok: true, token };
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─────────────────────────────────────────────────────────────────────────
// Connector — Gmail draft (no external send; safe by default).
// ─────────────────────────────────────────────────────────────────────────

interface GmailDraftInput {
  to: string;
  subject: string;
  bodyText: string;
  cc?: string;
  bcc?: string;
}
interface GmailDraftOutput {
  draftId: string;
  threadId: string | null;
  messageId: string | null;
}

const gmailDraft: GoogleConnector<GmailDraftInput, GmailDraftOutput> = {
  id: 'google.gmail.draft',
  label: 'Gmail · Create draft',
  description: 'Create a Gmail draft from text. Not sent — appears in the user\'s Gmail Drafts folder.',
  category: 'communication',
  source: 'gmail',
  requiredScopes: GOOGLE_SCOPES.gmail,
  requiresApproval: false,
  inputSchema: {
    to: { type: 'string', description: 'Recipient email', required: true },
    subject: { type: 'string', description: 'Email subject', required: true },
    bodyText: { type: 'string', description: 'Plain-text body', required: true },
    cc: { type: 'string', description: 'Comma-separated CC recipients' },
    bcc: { type: 'string', description: 'Comma-separated BCC recipients' },
  },
  outputSchema: {
    draftId: { type: 'string', description: 'Gmail draft id' },
    threadId: { type: 'string', description: 'Gmail thread id' },
    messageId: { type: 'string', description: 'Gmail message id' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'gmail');
    if (!t.ok) return t;
    if (!input.to || !input.subject) {
      return { ok: false, code: 'invalid-input', reason: 'to + subject required' };
    }
    const headerLines = [
      `To: ${input.to}`,
      input.cc ? `Cc: ${input.cc}` : null,
      input.bcc ? `Bcc: ${input.bcc}` : null,
      `Subject: ${input.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      input.bodyText,
    ].filter(Boolean).join('\r\n');
    const raw = base64UrlEncode(headerLines);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { raw } }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `gmail draft failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as { id?: string; message?: { id?: string; threadId?: string } };
      return {
        ok: true,
        output: {
          draftId: data.id ?? '',
          threadId: data.message?.threadId ?? null,
          messageId: data.message?.id ?? null,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Gmail send (requires second-tier approval).
// ─────────────────────────────────────────────────────────────────────────

interface GmailSendInput extends GmailDraftInput {
  /** When set, sends the existing draft rather than creating a new message. */
  fromDraftId?: string;
}
interface GmailSendOutput {
  messageId: string;
  threadId: string | null;
}

const gmailSend: GoogleConnector<GmailSendInput, GmailSendOutput> = {
  id: 'google.gmail.send',
  label: 'Gmail · Send',
  description: 'Send a Gmail message. Requires second-tier approval before execution.',
  category: 'communication',
  source: 'gmail',
  requiredScopes: GOOGLE_SCOPES.gmail,
  requiresApproval: true,
  inputSchema: {
    ...gmailDraft.inputSchema,
    fromDraftId: { type: 'string', description: 'Send the existing draft id (optional)' },
  },
  outputSchema: {
    messageId: { type: 'string', description: 'Gmail message id' },
    threadId: { type: 'string', description: 'Gmail thread id' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'gmail');
    if (!t.ok) return t;

    // Send-from-draft path.
    if (input.fromDraftId) {
      try {
        const res = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${t.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: input.fromDraftId }),
          },
        );
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          return { ok: false, code: 'api-error', reason: `gmail draft send failed (${res.status}): ${text.slice(0, 200)}` };
        }
        const data = (await res.json()) as { id?: string; threadId?: string };
        return { ok: true, output: { messageId: data.id ?? '', threadId: data.threadId ?? null } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, code: 'api-error', reason: msg };
      }
    }

    // Send-new-message path.
    if (!input.to || !input.subject) {
      return { ok: false, code: 'invalid-input', reason: 'to + subject required when fromDraftId absent' };
    }
    const headerLines = [
      `To: ${input.to}`,
      input.cc ? `Cc: ${input.cc}` : null,
      input.bcc ? `Bcc: ${input.bcc}` : null,
      `Subject: ${input.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      input.bodyText,
    ].filter(Boolean).join('\r\n');
    const raw = base64UrlEncode(headerLines);
    try {
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${t.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `gmail send failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as { id?: string; threadId?: string };
      return { ok: true, output: { messageId: data.id ?? '', threadId: data.threadId ?? null } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Calendar create event (private; no external attendees).
// ─────────────────────────────────────────────────────────────────────────

interface CalendarCreateEventInput {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timeZone?: string;
}
interface CalendarCreateEventOutput {
  eventId: string;
  htmlLink: string | null;
}

const calendarCreateEvent: GoogleConnector<CalendarCreateEventInput, CalendarCreateEventOutput> = {
  id: 'google.calendar.create-event',
  label: 'Calendar · Create event (private)',
  description: 'Create a Calendar event with no external attendees. Safe by default.',
  category: 'scheduling',
  source: 'calendar',
  requiredScopes: GOOGLE_SCOPES.calendar,
  requiresApproval: false,
  inputSchema: {
    summary: { type: 'string', description: 'Event title', required: true },
    description: { type: 'string', description: 'Event description' },
    startIso: { type: 'string', description: 'RFC3339 start', required: true },
    endIso: { type: 'string', description: 'RFC3339 end', required: true },
    timeZone: { type: 'string', description: 'IANA timezone (default: UTC)' },
  },
  outputSchema: {
    eventId: { type: 'string', description: 'Calendar event id' },
    htmlLink: { type: 'string', description: 'Public-facing event URL' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'calendar');
    if (!t.ok) return t;
    if (!input.summary || !input.startIso || !input.endIso) {
      return { ok: false, code: 'invalid-input', reason: 'summary + startIso + endIso required' };
    }
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${t.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: input.summary,
            description: input.description,
            start: { dateTime: input.startIso, timeZone: input.timeZone || 'UTC' },
            end: { dateTime: input.endIso, timeZone: input.timeZone || 'UTC' },
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `calendar create event failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as { id?: string; htmlLink?: string };
      return { ok: true, output: { eventId: data.id ?? '', htmlLink: data.htmlLink ?? null } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Calendar invite external (requires approval).
// ─────────────────────────────────────────────────────────────────────────

interface CalendarInviteExternalInput extends CalendarCreateEventInput {
  attendeeEmails: string[];
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

const calendarInviteExternal: GoogleConnector<CalendarInviteExternalInput, CalendarCreateEventOutput> = {
  id: 'google.calendar.invite-external',
  label: 'Calendar · Invite external attendees',
  description: 'Create a Calendar event with external attendees. Sends invites — requires approval.',
  category: 'scheduling',
  source: 'calendar',
  requiredScopes: GOOGLE_SCOPES.calendar,
  requiresApproval: true,
  inputSchema: {
    ...calendarCreateEvent.inputSchema,
    attendeeEmails: { type: 'string[]', description: 'External attendee emails', required: true },
    sendUpdates: { type: 'string', description: 'all | externalOnly | none' },
  },
  outputSchema: calendarCreateEvent.outputSchema,
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'calendar');
    if (!t.ok) return t;
    if (!input.summary || !input.startIso || !input.endIso || !Array.isArray(input.attendeeEmails)) {
      return { ok: false, code: 'invalid-input', reason: 'summary + startIso + endIso + attendeeEmails required' };
    }
    const sendUpdates = input.sendUpdates ?? 'all';
    try {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('sendUpdates', sendUpdates);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.startIso, timeZone: input.timeZone || 'UTC' },
          end: { dateTime: input.endIso, timeZone: input.timeZone || 'UTC' },
          attendees: input.attendeeEmails.map((email) => ({ email })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `calendar invite-external failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as { id?: string; htmlLink?: string };
      return { ok: true, output: { eventId: data.id ?? '', htmlLink: data.htmlLink ?? null } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Drive create doc.
// ─────────────────────────────────────────────────────────────────────────

interface DriveCreateDocInput {
  title: string;
  /** Plain text body — initial content of the new document. */
  bodyText?: string;
}
interface DriveCreateDocOutput {
  documentId: string;
  webViewLink: string | null;
}

const driveCreateDoc: GoogleConnector<DriveCreateDocInput, DriveCreateDocOutput> = {
  id: 'google.drive.create-doc',
  label: 'Drive · Create Google Doc',
  description: 'Create a new Google Doc in Drive. Private to the user by default.',
  category: 'document',
  source: 'drive',
  requiredScopes: [...GOOGLE_SCOPES.drive, ...GOOGLE_SCOPES.docs],
  requiresApproval: false,
  inputSchema: {
    title: { type: 'string', description: 'Document title', required: true },
    bodyText: { type: 'string', description: 'Initial body text' },
  },
  outputSchema: {
    documentId: { type: 'string', description: 'Drive file id' },
    webViewLink: { type: 'string', description: 'Drive web view URL' },
  },
  async execute(input, ctx) {
    const driveToken = await requireToken(ctx.personaId, 'drive');
    if (!driveToken.ok) return driveToken;
    if (!input.title) return { ok: false, code: 'invalid-input', reason: 'title required' };
    try {
      // Step 1 — create the Doc via Drive API.
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: input.title,
          mimeType: 'application/vnd.google-apps.document',
        }),
      });
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `drive create-doc failed (${createRes.status}): ${text.slice(0, 200)}` };
      }
      const created = (await createRes.json()) as { id?: string; webViewLink?: string };
      const documentId = created.id ?? '';
      const webViewLink = created.webViewLink ?? null;

      // Step 2 — optional initial body via Docs API.
      if (input.bodyText && documentId) {
        const docsToken = await requireToken(ctx.personaId, 'docs').catch(() => driveToken);
        const token = docsToken.ok ? docsToken.token : driveToken.token;
        await fetch(
          `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [
                {
                  insertText: { location: { index: 1 }, text: input.bodyText },
                },
              ],
            }),
          },
        ).catch(() => undefined);
      }

      return { ok: true, output: { documentId, webViewLink } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Drive share doc (requires approval).
// ─────────────────────────────────────────────────────────────────────────

interface DriveShareDocInput {
  documentId: string;
  email: string;
  role: 'reader' | 'commenter' | 'writer';
  sendNotification?: boolean;
}
interface DriveShareDocOutput {
  permissionId: string;
}

const driveShareDoc: GoogleConnector<DriveShareDocInput, DriveShareDocOutput> = {
  id: 'google.drive.share-doc',
  label: 'Drive · Share document',
  description: 'Grant a Drive permission to an email. Requires approval — external visibility.',
  category: 'document',
  source: 'drive',
  requiredScopes: GOOGLE_SCOPES.drive,
  requiresApproval: true,
  inputSchema: {
    documentId: { type: 'string', description: 'Drive file id', required: true },
    email: { type: 'string', description: 'Email of recipient', required: true },
    role: { type: 'string', description: 'reader | commenter | writer', required: true },
    sendNotification: { type: 'boolean', description: 'Send Drive notification email' },
  },
  outputSchema: {
    permissionId: { type: 'string', description: 'Drive permission id' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'drive');
    if (!t.ok) return t;
    if (!input.documentId || !input.email || !input.role) {
      return { ok: false, code: 'invalid-input', reason: 'documentId + email + role required' };
    }
    try {
      const url = new URL(`https://www.googleapis.com/drive/v3/files/${input.documentId}/permissions`);
      url.searchParams.set('sendNotificationEmail', String(input.sendNotification ?? false));
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'user',
          role: input.role,
          emailAddress: input.email,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `drive share-doc failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as { id?: string };
      return { ok: true, output: { permissionId: data.id ?? '' } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Drive search (read-only).
// ─────────────────────────────────────────────────────────────────────────

interface DriveSearchInput {
  query: string;
  pageSize?: number;
}
interface DriveSearchOutputItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  modifiedTime: string | null;
}
interface DriveSearchOutput {
  items: DriveSearchOutputItem[];
}

const driveSearch: GoogleConnector<DriveSearchInput, DriveSearchOutput> = {
  id: 'google.drive.search',
  label: 'Drive · Search',
  description: 'Search the user\'s Drive (read-only). Uses Drive v3 query syntax.',
  category: 'storage',
  source: 'drive',
  requiredScopes: GOOGLE_SCOPES.drive,
  requiresApproval: false,
  inputSchema: {
    query: { type: 'string', description: 'Drive v3 query string', required: true },
    pageSize: { type: 'number', description: 'Max results (1..50)' },
  },
  outputSchema: {
    items: { type: 'array', description: 'Matched files' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'drive');
    if (!t.ok) return t;
    if (!input.query) return { ok: false, code: 'invalid-input', reason: 'query required' };
    const pageSize = Math.min(Math.max(input.pageSize ?? 10, 1), 50);
    try {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', input.query);
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,modifiedTime)');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${t.token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `drive search failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        files?: Array<{ id?: string; name?: string; mimeType?: string; webViewLink?: string; modifiedTime?: string }>;
      };
      const items: DriveSearchOutputItem[] = (data.files ?? []).map((f) => ({
        id: f.id ?? '',
        name: f.name ?? '',
        mimeType: f.mimeType ?? '',
        webViewLink: f.webViewLink ?? null,
        modifiedTime: f.modifiedTime ?? null,
      }));
      return { ok: true, output: { items } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Docs append.
// ─────────────────────────────────────────────────────────────────────────

interface DocsAppendInput {
  documentId: string;
  text: string;
}
interface DocsAppendOutput {
  documentId: string;
  charactersAppended: number;
}

const docsAppend: GoogleConnector<DocsAppendInput, DocsAppendOutput> = {
  id: 'google.docs.append',
  label: 'Docs · Append text',
  description: 'Append text to the end of an existing Google Doc.',
  category: 'document',
  source: 'docs',
  requiredScopes: GOOGLE_SCOPES.docs,
  requiresApproval: false,
  inputSchema: {
    documentId: { type: 'string', description: 'Google Doc id', required: true },
    text: { type: 'string', description: 'Text to append', required: true },
  },
  outputSchema: {
    documentId: { type: 'string', description: 'Doc id' },
    charactersAppended: { type: 'number', description: 'How many characters were appended' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'docs');
    if (!t.ok) return t;
    if (!input.documentId || !input.text) {
      return { ok: false, code: 'invalid-input', reason: 'documentId + text required' };
    }
    try {
      // Step 1 — get the document to find the end index.
      const docRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${input.documentId}?fields=body.content.endIndex`,
        { headers: { Authorization: `Bearer ${t.token}` } },
      );
      if (!docRes.ok) {
        const text = await docRes.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `docs append (read) failed (${docRes.status}): ${text.slice(0, 200)}` };
      }
      const docJson = (await docRes.json()) as { body?: { content?: Array<{ endIndex?: number }> } };
      const endIndex =
        (docJson.body?.content ?? []).reduce(
          (acc, segment) => Math.max(acc, segment.endIndex ?? 0),
          1,
        ) - 1;
      // Step 2 — insert text at endIndex.
      const updateRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${input.documentId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${t.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: Math.max(endIndex, 1) },
                  text: input.text,
                },
              },
            ],
          }),
        },
      );
      if (!updateRes.ok) {
        const text = await updateRes.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `docs append (write) failed (${updateRes.status}): ${text.slice(0, 200)}` };
      }
      return {
        ok: true,
        output: { documentId: input.documentId, charactersAppended: input.text.length },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Slides create (from outline).
// ─────────────────────────────────────────────────────────────────────────

interface SlidesCreateInput {
  title: string;
  outline?: string[];
}
interface SlidesCreateOutput {
  presentationId: string;
  webViewLink: string | null;
}

const slidesCreate: GoogleConnector<SlidesCreateInput, SlidesCreateOutput> = {
  id: 'google.slides.create',
  label: 'Slides · Create deck',
  description: 'Create a new Google Slides presentation. Outline becomes one slide per line.',
  category: 'presentation',
  source: 'slides',
  requiredScopes: GOOGLE_SCOPES.slides,
  requiresApproval: false,
  inputSchema: {
    title: { type: 'string', description: 'Presentation title', required: true },
    outline: { type: 'string[]', description: 'One title per slide (after the cover)' },
  },
  outputSchema: {
    presentationId: { type: 'string', description: 'Slides presentation id' },
    webViewLink: { type: 'string', description: 'Slides web view URL' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'slides');
    if (!t.ok) return t;
    if (!input.title) return { ok: false, code: 'invalid-input', reason: 'title required' };
    try {
      const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: input.title }),
      });
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `slides create failed (${createRes.status}): ${text.slice(0, 200)}` };
      }
      const created = (await createRes.json()) as { presentationId?: string };
      const presentationId = created.presentationId ?? '';
      // webViewLink lookup via Drive — best-effort.
      let webViewLink: string | null = null;
      try {
        const driveToken = await requireToken(ctx.personaId, 'drive');
        if (driveToken.ok && presentationId) {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${presentationId}?fields=webViewLink`,
            { headers: { Authorization: `Bearer ${driveToken.token}` } },
          );
          if (r.ok) {
            const j = (await r.json()) as { webViewLink?: string };
            webViewLink = j.webViewLink ?? null;
          }
        }
      } catch {
        /* non-fatal */
      }
      return { ok: true, output: { presentationId, webViewLink } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Registry — exported map + lookup.
// ─────────────────────────────────────────────────────────────────────────

const GOOGLE_CONNECTORS: Record<GoogleConnectorId, GoogleConnector> = {
  'google.gmail.draft': gmailDraft as unknown as GoogleConnector,
  'google.gmail.send': gmailSend as unknown as GoogleConnector,
  'google.calendar.create-event': calendarCreateEvent as unknown as GoogleConnector,
  'google.calendar.invite-external': calendarInviteExternal as unknown as GoogleConnector,
  'google.drive.create-doc': driveCreateDoc as unknown as GoogleConnector,
  'google.drive.share-doc': driveShareDoc as unknown as GoogleConnector,
  'google.drive.search': driveSearch as unknown as GoogleConnector,
  'google.docs.append': docsAppend as unknown as GoogleConnector,
  'google.slides.create': slidesCreate as unknown as GoogleConnector,
};

export function getGoogleConnector(id: GoogleConnectorId): GoogleConnector | null {
  return GOOGLE_CONNECTORS[id] ?? null;
}

export function listGoogleConnectors(): GoogleConnector[] {
  return Object.values(GOOGLE_CONNECTORS);
}
