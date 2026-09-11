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
  resolveAccessToken,
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
  | 'google.calendar.list-events'
  | 'google.tasks.list'
  | 'google.drive.create-doc'
  | 'google.drive.share-doc'
  | 'google.drive.search'
  | 'google.docs.append'
  | 'google.slides.create'
  | 'google.sheets.create';

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
  category: 'communication' | 'scheduling' | 'storage' | 'document' | 'presentation' | 'spreadsheet';
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
  const result = await resolveAccessToken(personaId, source);
  if (result.ok) return result;
  // Map the rich diagnostic into ConnectorExecuteFailure codes:
  //   'no-record'         → not-connected   (consent never completed for this persona)
  //   'no-refresh-token'  → token-expired   (consent didn't grant offline access)
  //   'refresh-failed'    → token-expired   (Google rejected the refresh — needs reconnect)
  // Each carries the verbose reason so the UI shows the actual cause
  // instead of the generic "not connected" message.
  const code = result.code === 'no-record' ? 'not-connected' : 'token-expired';
  return {
    ok: false,
    code,
    reason: result.reason,
    hint: `Open Aigent Me → Connections, click Disconnect, then Connect Google ${source} again.`,
  };
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
  /** Persona upload ids to attach. Resolved server-side via
   *  resolveAttachments and assembled into a multipart/mixed MIME
   *  envelope. The connector context's personaId enforces ownership. */
  attachmentUploadIds?: string[];
}
interface GmailDraftOutput {
  draftId: string;
  threadId: string | null;
  messageId: string | null;
}

function sanitiseRecipientList(value: string | undefined): { ok: true; value: string } | { ok: false; reason: string } {
  if (value == null) return { ok: true, value: '' };
  // Strip CR/LF first — these are the #1 cause of "Invalid To header"
  // because LLM-drafted addresses often carry trailing newlines and
  // Gmail treats embedded CRLF as an attempt to inject a new header.
  const cleaned = String(value).replace(/[\r\n]+/g, ' ').trim();
  if (cleaned.length === 0) return { ok: true, value: '' };
  // Accept comma- or semicolon-separated lists. Each entry must contain
  // an "@" and at least one dot in the domain. Allow "Name <addr@host>".
  const entries = cleaned.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return { ok: false, reason: 'empty after sanitisation' };
  for (const entry of entries) {
    // Extract the bare address from "Name <addr@host>" if present.
    const bare = entry.match(/<([^>]+)>/)?.[1]?.trim() ?? entry;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bare)) {
      return { ok: false, reason: `invalid email address: ${entry}` };
    }
  }
  return { ok: true, value: entries.join(', ') };
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  base64Content: string;
}

function buildGmailHeader(
  fields: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    bodyText: string;
    /** Optional pre-resolved attachments (base64-encoded). When
     *  present, builds a multipart/mixed MIME envelope; otherwise
     *  builds the simpler single-part text/plain message. */
    attachments?: GmailAttachment[];
  },
): { ok: true; raw: string } | { ok: false; reason: string } {
  const to = sanitiseRecipientList(fields.to);
  if (!to.ok) return { ok: false, reason: `To: ${to.reason}` };
  if (!to.value) return { ok: false, reason: 'To: required (was empty after sanitisation)' };
  const cc = sanitiseRecipientList(fields.cc);
  if (!cc.ok) return { ok: false, reason: `Cc: ${cc.reason}` };
  const bcc = sanitiseRecipientList(fields.bcc);
  if (!bcc.ok) return { ok: false, reason: `Bcc: ${bcc.reason}` };
  // Subject can't carry CRLF either.
  const subject = String(fields.subject).replace(/[\r\n]+/g, ' ').trim();
  if (!subject) return { ok: false, reason: 'subject required' };

  const headerLines: string[] = [
    `To: ${to.value}`,
    cc.value ? `Cc: ${cc.value}` : '',
    bcc.value ? `Bcc: ${bcc.value}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  // No attachments → simple text/plain. Same single-part path as
  // before, preserved so the existing happy path stays unchanged for
  // bodies that don't attach anything.
  if (!fields.attachments || fields.attachments.length === 0) {
    const headers = [
      ...headerLines,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      fields.bodyText,
    ].join('\r\n');
    return { ok: true, raw: base64UrlEncode(headers) };
  }

  // Attachments present → multipart/mixed envelope with the body as
  // the first part and each attachment as a base64-encoded sibling.
  // Boundary string is deliberately verbose to avoid colliding with
  // anything that might appear in the body or attachments.
  const boundary = `=_gmailpart_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const parts: string[] = [];
  // First part — plain-text body.
  parts.push(
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      fields.bodyText,
    ].join('\r\n'),
  );
  // Subsequent parts — attachments. Base64 content is wrapped at 76
  // chars per RFC 2045.
  for (const a of fields.attachments) {
    const wrapped = a.base64Content.replace(/(.{76})/g, '$1\r\n').trim();
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename.replace(/"/g, '')}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename.replace(/"/g, '')}"`,
        '',
        wrapped,
      ].join('\r\n'),
    );
  }
  parts.push(`--${boundary}--`);

  const envelope = [
    ...headerLines,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    parts.join('\r\n'),
  ].join('\r\n');

  return { ok: true, raw: base64UrlEncode(envelope) };
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
    attachmentUploadIds: { type: 'array', description: 'Optional persona upload ids to attach as multipart/mixed MIME parts' },
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
    // Resolve any attached uploads to base64 payloads. The helper
    // enforces persona ownership + the 24 MB combined cap so
    // over-attaching surfaces a clear error before we burn the
    // Gmail API call.
    let attachments: GmailAttachment[] = [];
    if (Array.isArray(input.attachmentUploadIds) && input.attachmentUploadIds.length > 0) {
      const { resolveAttachments } = await import('@/services/uploads/uploadAttachmentHelper');
      const resolved = await resolveAttachments(ctx.personaId, input.attachmentUploadIds);
      if (!resolved.ok) {
        return { ok: false, code: 'invalid-input', reason: `attachment resolve failed: ${resolved.reason}` };
      }
      attachments = resolved.attachments.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        base64Content: a.base64Content,
      }));
    }
    const built = buildGmailHeader({
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      bodyText: input.bodyText,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    if (!built.ok) {
      return { ok: false, code: 'invalid-input', reason: built.reason };
    }
    const raw = built.raw;
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
    let attachmentsSend: GmailAttachment[] = [];
    if (Array.isArray(input.attachmentUploadIds) && input.attachmentUploadIds.length > 0) {
      const { resolveAttachments } = await import('@/services/uploads/uploadAttachmentHelper');
      const resolved = await resolveAttachments(ctx.personaId, input.attachmentUploadIds);
      if (!resolved.ok) {
        return { ok: false, code: 'invalid-input', reason: `attachment resolve failed: ${resolved.reason}` };
      }
      attachmentsSend = resolved.attachments.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        base64Content: a.base64Content,
      }));
    }
    const builtSend = buildGmailHeader({
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      bodyText: input.bodyText ?? '',
      ...(attachmentsSend.length > 0 ? { attachments: attachmentsSend } : {}),
    });
    if (!builtSend.ok) {
      return { ok: false, code: 'invalid-input', reason: builtSend.reason };
    }
    const raw = builtSend.raw;
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
// Connector — Calendar list events (READ-ONLY; no side effect, no approval).
//
// Reads events from the primary calendar in a [timeMin, timeMax] window using
// the existing calendar token (calendar.events already grants read). Used by
// the standing-signal flow: PAST events → loggable actions taken; UPCOMING
// events → prep suggestions. Read-on-demand — nothing is stored unless the
// operator explicitly turns an event into a signal.
// ─────────────────────────────────────────────────────────────────────────

interface CalendarListEventsInput {
  timeMin?: string; // RFC3339; default: 30 days ago
  timeMax?: string; // RFC3339; default: 30 days ahead
  maxResults?: number; // default 25, capped 50
}

export interface CalendarEventSummary {
  id: string;
  summary: string;
  startIso: string | null;
  endIso: string | null;
  isPast: boolean;
  attendeeCount: number;
  htmlLink: string | null;
}

interface CalendarListEventsOutput {
  events: CalendarEventSummary[];
}

const calendarListEvents: GoogleConnector<CalendarListEventsInput, CalendarListEventsOutput> = {
  id: 'google.calendar.list-events',
  label: 'Calendar · List events (read-only)',
  description: 'Read events from your primary calendar in a time window. Read-only; no changes.',
  category: 'scheduling',
  source: 'calendar',
  requiredScopes: GOOGLE_SCOPES.calendar,
  requiresApproval: false,
  inputSchema: {
    timeMin: { type: 'string', description: 'RFC3339 window start' },
    timeMax: { type: 'string', description: 'RFC3339 window end' },
    maxResults: { type: 'number', description: 'Max events (default 25, max 50)' },
  },
  outputSchema: {
    events: { type: 'array', description: 'Event summaries (id, title, start/end, isPast)' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'calendar');
    if (!t.ok) return t;
    const nowMs = Date.now();
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', String(Math.min(Math.max(input.maxResults ?? 25, 1), 50)));
    url.searchParams.set('timeMin', input.timeMin ?? new Date(nowMs - 30 * 864e5).toISOString());
    url.searchParams.set('timeMax', input.timeMax ?? new Date(nowMs + 30 * 864e5).toISOString());
    try {
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${t.token}` } });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `calendar list events failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        items?: Array<{
          id?: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          attendees?: unknown[];
          htmlLink?: string;
        }>;
      };
      const events: CalendarEventSummary[] = (data.items ?? []).map((e) => {
        const startIso = e.start?.dateTime ?? e.start?.date ?? null;
        const endIso = e.end?.dateTime ?? e.end?.date ?? null;
        const startMs = startIso ? Date.parse(startIso) : NaN;
        return {
          id: e.id ?? '',
          summary: e.summary ?? '(no title)',
          startIso,
          endIso,
          isPast: Number.isFinite(startMs) ? startMs < nowMs : false,
          attendeeCount: Array.isArray(e.attendees) ? e.attendees.length : 0,
          htmlLink: e.htmlLink ?? null,
        };
      });
      return { ok: true, output: { events } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Google Tasks list (READ-ONLY; no side effect, no approval).
//
// Reads the operator's default task list: completed tasks → proof-of-work
// signals; pending tasks → suggested actions. Read-on-demand — nothing stored
// unless the operator turns a task into a Standing signal. Scope: tasks.readonly.
// ─────────────────────────────────────────────────────────────────────────

interface TasksListInput {
  maxResults?: number; // default 25, capped 100
}

export interface GoogleTaskSummary {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  dueIso: string | null;
  completedIso: string | null;
  notes: string | null;
}

interface TasksListOutput {
  tasks: GoogleTaskSummary[];
}

const tasksList: GoogleConnector<TasksListInput, TasksListOutput> = {
  id: 'google.tasks.list',
  label: 'Tasks · List (read-only)',
  description: 'Read your Google Tasks default list. Read-only; no changes.',
  category: 'scheduling',
  source: 'tasks',
  requiredScopes: GOOGLE_SCOPES.tasks,
  requiresApproval: false,
  inputSchema: {
    maxResults: { type: 'number', description: 'Max tasks (default 25, max 100)' },
  },
  outputSchema: {
    tasks: { type: 'array', description: 'Task summaries (id, title, status, due, completed)' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'tasks');
    if (!t.ok) return t;
    const url = new URL('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks');
    url.searchParams.set('showCompleted', 'true');
    url.searchParams.set('showHidden', 'true');
    url.searchParams.set('maxResults', String(Math.min(Math.max(input.maxResults ?? 25, 1), 100)));
    try {
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${t.token}` } });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `tasks list failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        items?: Array<{
          id?: string;
          title?: string;
          status?: string;
          due?: string;
          completed?: string;
          notes?: string;
        }>;
      };
      const tasks: GoogleTaskSummary[] = (data.items ?? [])
        .filter((it) => (it.title ?? '').trim().length > 0)
        .map((it) => ({
          id: it.id ?? '',
          title: it.title ?? '',
          status: it.status === 'completed' ? 'completed' : 'needsAction',
          dueIso: it.due ?? null,
          completedIso: it.completed ?? null,
          notes: it.notes ?? null,
        }));
      return { ok: true, output: { tasks } };
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

    // Resolve organiser identity before creating the event so the invite
    // doesn't go out as "Unknown sender". Without an explicit organizer
    // block, the Calendar API populates it from the auth token but the
    // recipient's mail client can't always derive the sender's display
    // name from that — they see the meeting but no clear "from".
    // Pulling /calendars/primary gives us the id (the user's email) and
    // a usable summary (typically the user's name); both are T1-safe to
    // serialise into the event body. Best-effort: a failure here just
    // means we fall through to Google's default behaviour.
    let organizer: { email: string; displayName?: string } | undefined;
    try {
      const primaryRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary',
        { headers: { Authorization: `Bearer ${t.token}` } },
      );
      if (primaryRes.ok) {
        const primaryJson = (await primaryRes.json()) as { id?: string; summary?: string };
        if (typeof primaryJson.id === 'string' && /@/.test(primaryJson.id)) {
          organizer = {
            email: primaryJson.id,
            ...(typeof primaryJson.summary === 'string' && primaryJson.summary.trim().length > 0
              ? { displayName: primaryJson.summary.trim() }
              : {}),
          };
        }
      }
    } catch {
      // Soft-fail; the invite still sends with default organiser info.
    }

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
          ...(organizer ? { organizer } : {}),
          guestsCanSeeOtherGuests: true,
          guestsCanModify: false,
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
  /**
   * Set when the Doc was created (drive.file scope) but the body content
   * could not be written (docs scope absent or batchUpdate rejected). The
   * file still exists; the UI surfaces this so the operator knows to
   * connect Docs and re-run if they wanted body content.
   */
  warning?: string;
}

const driveCreateDoc: GoogleConnector<DriveCreateDocInput, DriveCreateDocOutput> = {
  id: 'google.drive.create-doc',
  label: 'Drive · Create Google Doc',
  description: 'Create a new Google Doc in Drive. Private to the user by default.',
  category: 'document',
  source: 'drive',
  // Only the drive scope is needed — body content is uploaded inline
  // via Drive's multipart upload + automatic conversion, so we never
  // call docs.googleapis.com. Previously this required the separate
  // docs scope to write body content via Docs API batchUpdate, and
  // that path 403'd whenever the project didn't have the Docs API
  // enabled. The multipart route only needs Drive (already enabled
  // for any operator who can create files).
  requiredScopes: [...GOOGLE_SCOPES.drive],
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
      const hasBody = typeof input.bodyText === 'string' && input.bodyText.length > 0;
      const baseUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,webViewLink';
      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

      // Path A — no body content. Simple metadata-only create.
      if (!hasBody) {
        const createRes = await fetch(baseUrl, {
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
        return {
          ok: true,
          output: {
            documentId: created.id ?? '',
            webViewLink: created.webViewLink ?? null,
          },
        };
      }

      // Path B — body content. Multipart upload with the metadata
      // declaring the target Google Doc mime type and the bodyText as
      // a text/plain part. Drive converts the upload into a Google
      // Doc on the server side — no separate Docs API call needed.
      // Reference: https://developers.google.com/drive/api/guides/manage-uploads#multipart
      const boundary = `aigentme_doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const metadata = {
        name: input.title,
        mimeType: 'application/vnd.google-apps.document',
      };
      const multipartBody =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
        `${input.bodyText}\r\n` +
        `--${boundary}--`;

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken.token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });
      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => '');
        return {
          ok: false,
          code: 'api-error',
          reason: `drive multipart upload failed (${uploadRes.status}): ${text.slice(0, 200)}`,
        };
      }
      const uploaded = (await uploadRes.json()) as { id?: string; webViewLink?: string };
      return {
        ok: true,
        output: {
          documentId: uploaded.id ?? '',
          webViewLink: uploaded.webViewLink ?? null,
        },
      };
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
  /** Back-compat: array of slide titles. Used when sections is absent. */
  outline?: string[];
  /**
   * Phase 6.b 2.5c v2 — per-slide structure with bullets and an optional
   * diagramConcept string. When provided, each entry materialises as a
   * TITLE_AND_BODY slide; diagramConcept becomes a placeholder text box
   * near the foot of the slide that the operator can swap for a real
   * graphic later.
   */
  sections?: Array<{ title: string; bullets: string[]; diagramConcept?: string }>;
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

      // Phase 6.b Part 2.5c v2 — materialise per-slide structure.
      // When the caller passes `sections` (each with title + bullets +
      // optional diagramConcept), every entry becomes a TITLE_AND_BODY
      // slide with bullets joined by newlines and a "Visual concept" text
      // box for any diagram hint. When only `outline` is passed (back-
      // compat path), each entry becomes a TITLE_ONLY slide.
      // The batch is built up-front and submitted in one batchUpdate so
      // partial-success windows stay small.
      type Section = { title: string; bullets: string[]; diagramConcept?: string };
      const sections: Section[] = Array.isArray(input.sections) && input.sections.length > 0
        ? input.sections
            .filter((s): s is Section => !!s && typeof s.title === 'string' && s.title.trim().length > 0)
            .map((s) => ({
              title: s.title.trim(),
              bullets: Array.isArray(s.bullets)
                ? s.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim())
                : [],
              ...(typeof s.diagramConcept === 'string' && s.diagramConcept.trim().length > 0
                ? { diagramConcept: s.diagramConcept.trim() }
                : {}),
            }))
        : Array.isArray(input.outline)
          ? input.outline
              .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              .map((slideTitle) => ({ title: slideTitle.trim(), bullets: [] }))
          : [];

      let partialBuildWarning: string | null = null;
      if (presentationId && sections.length > 0) {
        const requests: Array<Record<string, unknown>> = [];
        sections.forEach((section, idx) => {
          const slideId = `aigentme_slide_${idx + 1}`;
          const titleId = `aigentme_title_${idx + 1}`;
          const bodyId = `aigentme_body_${idx + 1}`;
          const useBody = section.bullets.length > 0;
          requests.push({
            createSlide: {
              objectId: slideId,
              slideLayoutReference: {
                predefinedLayout: useBody ? 'TITLE_AND_BODY' : 'TITLE_ONLY',
              },
              placeholderIdMappings: [
                {
                  layoutPlaceholder: { type: 'TITLE', index: 0 },
                  objectId: titleId,
                },
                ...(useBody
                  ? [{
                      layoutPlaceholder: { type: 'BODY', index: 0 },
                      objectId: bodyId,
                    }]
                  : []),
              ],
            },
          });
          requests.push({
            insertText: { objectId: titleId, text: section.title },
          });
          if (useBody) {
            requests.push({
              insertText: { objectId: bodyId, text: section.bullets.join('\n') },
            });
          }
          if (section.diagramConcept) {
            // Render a stylised text box near the slide foot describing the
            // suggested visual. The operator can replace it with a real
            // graphic; deletion is one click in Slides.
            // Slide dimensions in EMU: 10in × 5.625in (16:9 default) =
            // 9144000 × 5143500. Box: 8.5in × 0.7in centred horizontally,
            // anchored ~0.4in from the bottom.
            const conceptShapeId = `aigentme_concept_shape_${idx + 1}`;
            const conceptTextId = `aigentme_concept_text_${idx + 1}`;
            requests.push({
              createShape: {
                objectId: conceptShapeId,
                shapeType: 'TEXT_BOX',
                elementProperties: {
                  pageObjectId: slideId,
                  size: {
                    width: { magnitude: 7772400, unit: 'EMU' },   // 8.5 in
                    height: { magnitude: 640080, unit: 'EMU' },   // 0.7 in
                  },
                  transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 685800,                            // 0.75 in
                    translateY: 4135120,                           // ~4.52 in
                    unit: 'EMU',
                  },
                },
              },
            });
            requests.push({
              insertText: {
                objectId: conceptShapeId,
                text: `Visual concept: ${section.diagramConcept}`,
              },
            });
            requests.push({
              updateTextStyle: {
                objectId: conceptShapeId,
                style: {
                  italic: true,
                  fontSize: { magnitude: 11, unit: 'PT' },
                  foregroundColor: { opaqueColor: { rgbColor: { red: 0.45, green: 0.41, blue: 0.65 } } },
                },
                textRange: { type: 'ALL' },
                fields: 'italic,fontSize,foregroundColor',
              },
            });
            // Suppress unused-id warning — conceptTextId reserved for a
            // future style update path. Cast to void so TS stays quiet.
            void conceptTextId;
          }
        });
        try {
          const batchRes = await fetch(
            `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${t.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ requests }),
            },
          );
          if (!batchRes.ok) {
            const text = await batchRes.text().catch(() => '');
            partialBuildWarning = `outline insert failed (${batchRes.status}): ${text.slice(0, 200)}`;
            console.warn(`[slides.create] ${partialBuildWarning}`);
          }
        } catch (err) {
          partialBuildWarning = err instanceof Error ? err.message : String(err);
          console.warn(`[slides.create] outline insert threw: ${partialBuildWarning}`);
        }
      }

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
      // The cover slide was created with the deck. partialBuildWarning is
      // surfaced via the api-error code only when the outline insert
      // failed entirely; otherwise we return success and let the operator
      // see which slides materialised.
      if (partialBuildWarning) {
        return {
          ok: false,
          code: 'api-error',
          reason: `slides outline insert failed: ${partialBuildWarning}`,
          hint: `Deck was created (id=${presentationId}) but content slides could not be added.`,
        };
      }
      return { ok: true, output: { presentationId, webViewLink } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'api-error', reason: msg };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Connector — Sheets create.
// ─────────────────────────────────────────────────────────────────────────

interface SheetsCreateInput {
  title: string;
  /**
   * Optional initial values. First row is treated as the header row.
   * Each subsequent row is a string array of cell values.
   */
  rows?: string[][];
  /** Optional sheet (tab) name. Defaults to "Sheet1". */
  sheetName?: string;
}
interface SheetsCreateOutput {
  spreadsheetId: string;
  webViewLink: string | null;
}

const sheetsCreate: GoogleConnector<SheetsCreateInput, SheetsCreateOutput> = {
  id: 'google.sheets.create',
  label: 'Sheets · Create spreadsheet',
  description: 'Create a new Google Sheets spreadsheet, optionally seeded with header + rows.',
  category: 'spreadsheet',
  source: 'sheets',
  requiredScopes: GOOGLE_SCOPES.sheets,
  requiresApproval: false,
  inputSchema: {
    title: { type: 'string', description: 'Spreadsheet title', required: true },
    rows: { type: 'string[][]', description: 'Header row + data rows; first row is the header' },
    sheetName: { type: 'string', description: 'Tab name (defaults to Sheet1)' },
  },
  outputSchema: {
    spreadsheetId: { type: 'string', description: 'Sheets spreadsheet id' },
    webViewLink: { type: 'string', description: 'Sheets web view URL' },
  },
  async execute(input, ctx) {
    const t = await requireToken(ctx.personaId, 'sheets');
    if (!t.ok) return t;
    const title = (input.title ?? '').trim();
    if (!title) return { ok: false, code: 'invalid-input', reason: 'title required' };
    const sheetName = (input.sheetName ?? '').trim() || 'Sheet1';
    try {
      // Create the spreadsheet shell with the named tab.
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: sheetName } }],
        }),
      });
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        return { ok: false, code: 'api-error', reason: `sheets create failed (${createRes.status}): ${text.slice(0, 200)}` };
      }
      const created = (await createRes.json()) as { spreadsheetId?: string };
      const spreadsheetId = created.spreadsheetId ?? '';

      // Seed with rows if provided. First row is treated as the header.
      const rows = Array.isArray(input.rows)
        ? input.rows
            .filter((r): r is string[] => Array.isArray(r))
            .map((r) => r.map((cell) => (typeof cell === 'string' ? cell : String(cell ?? ''))))
        : [];
      if (spreadsheetId && rows.length > 0) {
        try {
          const valuesRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${t.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ values: rows }),
            },
          );
          if (!valuesRes.ok) {
            const text = await valuesRes.text().catch(() => '');
            return {
              ok: false,
              code: 'api-error',
              reason: `sheets values append failed (${valuesRes.status}): ${text.slice(0, 200)}`,
              hint: `Spreadsheet was created (id=${spreadsheetId}) but rows could not be appended.`,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            ok: false,
            code: 'api-error',
            reason: `sheets values append threw: ${msg}`,
            hint: `Spreadsheet was created (id=${spreadsheetId}) but rows could not be appended.`,
          };
        }
      }

      // webViewLink via Drive — best-effort.
      let webViewLink: string | null = null;
      try {
        const driveToken = await requireToken(ctx.personaId, 'drive');
        if (driveToken.ok && spreadsheetId) {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`,
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

      return { ok: true, output: { spreadsheetId, webViewLink } };
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
  'google.calendar.list-events': calendarListEvents as unknown as GoogleConnector,
  'google.tasks.list': tasksList as unknown as GoogleConnector,
  'google.drive.create-doc': driveCreateDoc as unknown as GoogleConnector,
  'google.drive.share-doc': driveShareDoc as unknown as GoogleConnector,
  'google.drive.search': driveSearch as unknown as GoogleConnector,
  'google.docs.append': docsAppend as unknown as GoogleConnector,
  'google.slides.create': slidesCreate as unknown as GoogleConnector,
  'google.sheets.create': sheetsCreate as unknown as GoogleConnector,
};

export function getGoogleConnector(id: GoogleConnectorId): GoogleConnector | null {
  return GOOGLE_CONNECTORS[id] ?? null;
}

export function listGoogleConnectors(): GoogleConnector[] {
  return Object.values(GOOGLE_CONNECTORS);
}
