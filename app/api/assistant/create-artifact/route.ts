/**
 * POST /api/assistant/create-artifact
 *
 * Aigent Me Phase 6 — Artifact Creation (alpha stub).
 * Per PRD v0.2 §12 (Create artifact) and §10 FR10 / FR11.
 *
 * Body:
 *   {
 *     artifactType: 'google-doc'|'gmail-draft'|'calendar-block'|'brief'|
 *                   'post-set'|'image-prompt'|'video-script'|'slide-outline'|
 *                   'venture-report';
 *     title?: string;          // defaults from intent / specialist response
 *     sourceIntentId?: string; // links the artifact to a queued intent
 *     destination?: 'runtime'|'drive'|'gmail'|'cartridge_store';
 *     specialistId?: string;   // when the artifact came from a specialist response
 *   }
 *
 * Alpha behavior:
 *   - Phase 6 ships the structural pipeline + receipt emission.
 *   - destination='runtime' (default) → record an ArtifactRecord-like
 *     summary in an ActivityReceipt + return the synthesised artifact id.
 *     No external write yet; the artifact lives as a receipt-bound record
 *     until Phase 6.b wires Google Workspace OAuth + actual API calls.
 *   - destination='drive'|'gmail'|'cartridge_store' → returns 501 with a
 *     diagnostic naming the deferred work.
 *
 * Privacy:
 *   - personaId from spine.
 *   - The IntentQube + ExperienceQube meta slice supply the context label;
 *     no BlakQube values written to the receipt's context_shared field.
 *   - Every create emits an ActivityReceipt of action_type='artifact_created'.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getIntentQube } from '@/services/iqube/intentQube';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getGoogleConnector } from '@/services/google/connectors';

export const dynamic = 'force-dynamic';

const VALID_ARTIFACT_TYPES = new Set<string>([
  'google-doc',
  'google-sheet',
  'gmail-draft',
  'calendar-block',
  'brief',
  'post-set',
  'image-prompt',
  'video-script',
  'slide-outline',
  'venture-report',
  'marketa-email',
]);

const VALID_DESTINATIONS = new Set<string>([
  'runtime',
  'drive',
  'gmail',
  'calendar',
  'cartridge_store',
]);

// Phase 6.b Part 2.5 — gmail destination is live (gmail-draft → gmail.draft
// connector eager-creates a real draft, returns location URL + the send
// connector for the second-tier ApprovalCard).
// Phase 6.b Part 2.5c — calendar + drive destinations live:
//   - calendar-block + no attendees → eager-create via calendar.create-event
//     (no approval needed; event is private to the user).
//   - calendar-block + attendees    → runtime-only artifact carrying
//     calendar.invite-external as the action connector. Send invites
//     triggers the second-tier ApprovalCard because invites externalise.
//   - google-doc → eager-create via drive.create-doc (no approval); if the
//     drafter suggested shareSuggestions, artifact binds drive.share-doc
//     for an approval-gated share.
// cartridge_store stays deferred until Phase 7 work.
const DEFERRED_DESTINATIONS = new Set<string>(['cartridge_store']);

interface PostBody {
  artifactType?: string;
  title?: string;
  sourceIntentId?: string;
  destination?: string;
  specialistId?: string;
  /**
   * Phase 6.b Part 2.5 — connector input forwarded to the eager-create
   * connector (e.g. `{ to, subject, bodyText }` for a gmail-draft).
   * Required when `destination='gmail'`.
   */
  connectorInput?: Record<string, unknown>;
}

interface CreateArtifactSurface {
  artifactId: string;
  artifactType: string;
  title: string;
  destination: 'runtime' | 'gmail' | 'calendar' | 'drive';
  status: 'draft';
  receiptId: string | null;
  intentId: string | null;
  message: string;
  createdAt: string;
  locationUrl?: string | null;
  /**
   * Optional connector-emitted warning when a partial success
   * happened (e.g. Drive created the doc but the Docs API was
   * disabled so the body insert failed 403). Surfaced as an amber
   * callout on the artifact card. When the warning text contains a
   * Google Cloud Console URL, the card extracts it as a clickable
   * "Enable API" CTA so the operator can fix the disabled-API issue
   * in one click and re-run.
   */
  warning?: string | null;
  actionConnectorId?: string;
  actionConnectorLabel?: string;
  actionInput?: Record<string, unknown>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.artifactType || !VALID_ARTIFACT_TYPES.has(body.artifactType)) {
    return NextResponse.json(
      {
        error: 'invalid-artifactType',
        detail: `artifactType must be one of: ${Array.from(VALID_ARTIFACT_TYPES).join(', ')}`,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const destination = body.destination ?? 'runtime';
  if (!VALID_DESTINATIONS.has(destination)) {
    return NextResponse.json(
      { error: 'invalid-destination' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (DEFERRED_DESTINATIONS.has(destination)) {
    return NextResponse.json(
      {
        error: 'destination-not-implemented',
        detail:
          `destination='${destination}' lands in Phase 6.b alongside Google Workspace OAuth. ` +
          `For alpha, use destination='runtime'.`,
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    let cartridge = 'metame';
    let derivedTitle = body.title?.trim() || `Untitled ${body.artifactType}`;
    if (body.sourceIntentId) {
      const intent = await getIntentQube(body.sourceIntentId);
      if (intent) {
        cartridge = intent.activeCartridge || cartridge;
        if (!body.title) derivedTitle = `${body.artifactType} for ${intent.intentName}`;
      }
    }

    const createdAt = new Date().toISOString();
    const artifactId = `art_${cryptoRandomId()}`;

    // ─────────────────────────────────────────────────────────────────
    // Phase 6.b Part 2.5 — Gmail destination. Eager-create a real draft
    // via the gmail.draft connector so the user sees it in Gmail. The
    // ArtifactCard then carries the gmail.send connector id; clicking
    // Send triggers the second-tier ApprovalCard before externalising.
    // ─────────────────────────────────────────────────────────────────
    if (destination === 'gmail') {
      if (body.artifactType !== 'gmail-draft') {
        return NextResponse.json(
          {
            error: 'destination-mismatch',
            detail: `destination='gmail' requires artifactType='gmail-draft'.`,
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const draftConnector = getGoogleConnector('google.gmail.draft');
      if (!draftConnector) {
        return NextResponse.json(
          { error: 'connector-unavailable', detail: 'gmail.draft connector not registered' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const input = body.connectorInput ?? {};
      const draftResult = await draftConnector.execute(input, {
        personaId: context.personaId,
        intentId: body.sourceIntentId ?? null,
        cartridge,
      });
      if (!draftResult.ok) {
        return NextResponse.json(
          {
            error: 'draft-create-failed',
            code: draftResult.code,
            detail: draftResult.reason,
            hint: draftResult.hint,
          },
          { status: draftResult.code === 'not-connected' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const draftId = (draftResult.output as { draftId?: string } | undefined)?.draftId ?? '';
      const locationUrl = draftId ? `https://mail.google.com/mail/u/0/#drafts/${draftId}` : null;

      const receipt = await createActivityReceipt({
        personaId: context.personaId,
        intentId: body.sourceIntentId ?? null,
        activeCartridge: cartridge,
        actionType: 'artifact_created',
        summary: `Created Gmail draft: ${derivedTitle}`,
        agentsInvoked: [
          'aigent-me',
          ...(body.specialistId ? [body.specialistId] : []),
        ],
        toolsUsed: ['google.gmail.draft'],
        iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
        contextShared: ['intent-summary', 'experience-meta-slice'],
        artifactsCreated: [`gmail-draft:${draftId || derivedTitle}`],
        approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
      });

      const surface: CreateArtifactSurface = {
        artifactId,
        artifactType: 'gmail-draft',
        title: derivedTitle,
        destination: 'gmail',
        status: 'draft',
        receiptId: receipt?.id ?? null,
        intentId: body.sourceIntentId ?? null,
        message:
          `Gmail draft created. Click "Send draft" to externalise — ` +
          `an approval card will confirm before the email leaves your account.`,
        createdAt,
        locationUrl,
        actionConnectorId: 'google.gmail.send',
        actionConnectorLabel: 'Send draft',
        // Forward the draft id so the send connector targets it directly.
        // gmail.send keys on `fromDraftId`; fall back to the raw compose
        // input when the draft id is missing.
        actionInput: draftId ? { fromDraftId: draftId } : input,
      };

      return NextResponse.json(surface, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // Phase 6.b Part 2.5c — Calendar destination.
    // No external attendees → eager-create a private event via
    //   calendar.create-event (no approval). Artifact carries the Open
    //   link; no Send button needed.
    // External attendees present → defer creation. Artifact is runtime-
    //   only with actionConnectorId='google.calendar.invite-external'.
    //   The Send-invites click runs invite-external in one shot, which
    //   creates the event AND sends invites (approval-gated).
    // ─────────────────────────────────────────────────────────────────
    if (destination === 'calendar') {
      if (body.artifactType !== 'calendar-block') {
        return NextResponse.json(
          { error: 'destination-mismatch', detail: `destination='calendar' requires artifactType='calendar-block'.` },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const input = (body.connectorInput ?? {}) as {
        summary?: string;
        description?: string;
        startIso?: string;
        endIso?: string;
        timeZone?: string;
        attendeeEmails?: string[];
      };
      if (!input.summary || !input.startIso || !input.endIso) {
        return NextResponse.json(
          { error: 'invalid-connector-input', detail: 'summary + startIso + endIso required' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const attendeeEmails = Array.isArray(input.attendeeEmails)
        ? input.attendeeEmails.filter((e): e is string => typeof e === 'string' && /@/.test(e))
        : [];

      if (attendeeEmails.length === 0) {
        // Private event — eager-create.
        const createEvent = getGoogleConnector('google.calendar.create-event');
        if (!createEvent) {
          return NextResponse.json(
            { error: 'connector-unavailable', detail: 'calendar.create-event not registered' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const result = await createEvent.execute(
          {
            summary: input.summary,
            description: input.description ?? '',
            startIso: input.startIso,
            endIso: input.endIso,
            timeZone: input.timeZone ?? 'UTC',
          },
          { personaId: context.personaId, intentId: body.sourceIntentId ?? null, cartridge },
        );
        if (!result.ok) {
          return NextResponse.json(
            { error: 'event-create-failed', code: result.code, detail: result.reason, hint: result.hint },
            { status: result.code === 'not-connected' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const output = result.output as { eventId?: string; htmlLink?: string | null } | undefined;
        const eventId = output?.eventId ?? '';
        const locationUrl = output?.htmlLink ?? (eventId ? `https://calendar.google.com/calendar/u/0/r/eventedit/${eventId}` : null);

        const receipt = await createActivityReceipt({
          personaId: context.personaId,
          intentId: body.sourceIntentId ?? null,
          activeCartridge: cartridge,
          actionType: 'artifact_created',
          summary: `Created Calendar event: ${input.summary}`,
          agentsInvoked: ['aigent-me', ...(body.specialistId ? [body.specialistId] : [])],
          toolsUsed: ['google.calendar.create-event'],
          iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
          contextShared: ['intent-summary', 'experience-meta-slice'],
          artifactsCreated: [`calendar-block:${eventId || input.summary}`],
          approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
        });

        const surface: CreateArtifactSurface = {
          artifactId,
          artifactType: 'calendar-block',
          title: input.summary,
          destination: 'calendar',
          status: 'draft',
          receiptId: receipt?.id ?? null,
          intentId: body.sourceIntentId ?? null,
          message: 'Calendar event created (private — no attendees).',
          createdAt,
          locationUrl,
        };
        return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
      }

      // External attendees present — defer creation behind the approval gate.
      const receipt = await createActivityReceipt({
        personaId: context.personaId,
        intentId: body.sourceIntentId ?? null,
        activeCartridge: cartridge,
        actionType: 'artifact_created',
        summary: `Drafted Calendar event with ${attendeeEmails.length} external attendee(s): ${input.summary}`,
        agentsInvoked: ['aigent-me', ...(body.specialistId ? [body.specialistId] : [])],
        toolsUsed: ['runtime'],
        iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
        contextShared: ['intent-summary', 'experience-meta-slice'],
        artifactsCreated: [`calendar-block:${input.summary}`],
        approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
      });

      const surface: CreateArtifactSurface = {
        artifactId,
        artifactType: 'calendar-block',
        title: input.summary,
        destination: 'calendar',
        status: 'draft',
        receiptId: receipt?.id ?? null,
        intentId: body.sourceIntentId ?? null,
        message:
          `Event drafted with ${attendeeEmails.length} external attendee(s). ` +
          `Click "Send invites" to create the event and notify attendees — approval required.`,
        createdAt,
        actionConnectorId: 'google.calendar.invite-external',
        actionConnectorLabel: 'Send invites',
        actionInput: {
          summary: input.summary,
          description: input.description ?? '',
          startIso: input.startIso,
          endIso: input.endIso,
          timeZone: input.timeZone ?? 'UTC',
          attendeeEmails,
          sendUpdates: 'all',
        },
      };
      return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ─────────────────────────────────────────────────────────────────
    // Phase 6.b Part 2.5c — Drive destination (Google Doc / Slides).
    // For google-doc:
    //   Eager-create via drive.create-doc (no approval). If the caller
    //   passed shareSuggestions, the artifact binds google.drive.share-doc
    //   to the first suggestion; subsequent suggestions require manual
    //   re-shares for now (kept simple in alpha).
    // For slide-outline:
    //   Eager-create via slides.create (no approval). No second-tier
    //   needed — Slides decks are private by default and sharing happens
    //   through the Drive surface.
    // ─────────────────────────────────────────────────────────────────
    if (destination === 'drive') {
      if (
        body.artifactType !== 'google-doc' &&
        body.artifactType !== 'slide-outline' &&
        body.artifactType !== 'google-sheet'
      ) {
        return NextResponse.json(
          { error: 'destination-mismatch', detail: `destination='drive' requires artifactType='google-doc', 'slide-outline', or 'google-sheet'.` },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      if (body.artifactType === 'google-doc') {
        const input = (body.connectorInput ?? {}) as {
          title?: string;
          bodyText?: string;
          shareSuggestions?: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>;
        };
        if (!input.title) {
          return NextResponse.json(
            { error: 'invalid-connector-input', detail: 'title required' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const createDoc = getGoogleConnector('google.drive.create-doc');
        if (!createDoc) {
          return NextResponse.json(
            { error: 'connector-unavailable', detail: 'drive.create-doc not registered' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const result = await createDoc.execute(
          { title: input.title, bodyText: input.bodyText ?? '' },
          { personaId: context.personaId, intentId: body.sourceIntentId ?? null, cartridge },
        );
        if (!result.ok) {
          return NextResponse.json(
            { error: 'doc-create-failed', code: result.code, detail: result.reason, hint: result.hint },
            { status: result.code === 'not-connected' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const output = result.output as {
          documentId?: string;
          webViewLink?: string | null;
          warning?: string;
        } | undefined;
        const documentId = output?.documentId ?? '';
        const locationUrl = output?.webViewLink ?? (documentId ? `https://docs.google.com/document/d/${documentId}/edit` : null);
        const bodyWarning = output?.warning ?? null;
        const shareSuggestions = Array.isArray(input.shareSuggestions) ? input.shareSuggestions : [];
        const firstShare = shareSuggestions.find((s) => s && typeof s.email === 'string' && /@/.test(s.email));

        const receipt = await createActivityReceipt({
          personaId: context.personaId,
          intentId: body.sourceIntentId ?? null,
          activeCartridge: cartridge,
          actionType: 'artifact_created',
          summary: `Created Google Doc: ${input.title}`,
          agentsInvoked: ['aigent-me', ...(body.specialistId ? [body.specialistId] : [])],
          toolsUsed: ['google.drive.create-doc'],
          iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
          contextShared: ['intent-summary', 'experience-meta-slice'],
          artifactsCreated: [`google-doc:${documentId || input.title}`],
          approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
        });

        const surface: CreateArtifactSurface = {
          artifactId,
          artifactType: 'google-doc',
          title: input.title,
          destination: 'drive',
          status: 'draft',
          receiptId: receipt?.id ?? null,
          intentId: body.sourceIntentId ?? null,
          message: firstShare
            ? `Doc created. Click "Share doc" to grant ${firstShare.email} ${firstShare.role} access — approval required.`
            : 'Doc created privately in your Drive.',
          createdAt,
          locationUrl,
          ...(bodyWarning ? { warning: bodyWarning } : {}),
          ...(firstShare && documentId
            ? {
                actionConnectorId: 'google.drive.share-doc',
                actionConnectorLabel: `Share with ${firstShare.email}`,
                actionInput: {
                  documentId,
                  email: firstShare.email,
                  role: firstShare.role,
                  sendNotification: true,
                },
              }
            : {}),
        };
        return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (body.artifactType === 'google-sheet') {
        const input = (body.connectorInput ?? {}) as {
          title?: string;
          sheetName?: string;
          rows?: string[][];
        };
        if (!input.title) {
          return NextResponse.json(
            { error: 'invalid-connector-input', detail: 'title required' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const sheets = getGoogleConnector('google.sheets.create');
        if (!sheets) {
          return NextResponse.json(
            { error: 'connector-unavailable', detail: 'sheets.create not registered' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const sheetsResult = await sheets.execute(
          {
            title: input.title,
            ...(input.sheetName ? { sheetName: input.sheetName } : {}),
            rows: Array.isArray(input.rows) ? input.rows : [],
          },
          { personaId: context.personaId, intentId: body.sourceIntentId ?? null, cartridge },
        );
        if (!sheetsResult.ok) {
          return NextResponse.json(
            { error: 'sheets-create-failed', code: sheetsResult.code, detail: sheetsResult.reason, hint: sheetsResult.hint },
            { status: sheetsResult.code === 'not-connected' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const sheetsOut = sheetsResult.output as { spreadsheetId?: string; webViewLink?: string | null } | undefined;
        const spreadsheetId = sheetsOut?.spreadsheetId ?? '';
        const locationUrl = sheetsOut?.webViewLink ?? (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null);

        const receipt = await createActivityReceipt({
          personaId: context.personaId,
          intentId: body.sourceIntentId ?? null,
          activeCartridge: cartridge,
          actionType: 'artifact_created',
          summary: `Created Google Sheet: ${input.title}`,
          agentsInvoked: ['aigent-me', ...(body.specialistId ? [body.specialistId] : [])],
          toolsUsed: ['google.sheets.create'],
          iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
          contextShared: ['intent-summary', 'experience-meta-slice'],
          artifactsCreated: [`google-sheet:${spreadsheetId || input.title}`],
          approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
        });

        const surface: CreateArtifactSurface = {
          artifactId,
          artifactType: 'google-sheet',
          title: input.title,
          destination: 'drive',
          status: 'draft',
          receiptId: receipt?.id ?? null,
          intentId: body.sourceIntentId ?? null,
          message: 'Google Sheet created privately in your Drive.',
          createdAt,
          locationUrl,
        };
        return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
      }

      // slide-outline
      const input = (body.connectorInput ?? {}) as {
        title?: string;
        outline?: string[];
        sections?: Array<{ title: string; bullets: string[]; diagramConcept?: string }>;
      };
      if (!input.title) {
        return NextResponse.json(
          { error: 'invalid-connector-input', detail: 'title required' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const slides = getGoogleConnector('google.slides.create');
      if (!slides) {
        return NextResponse.json(
          { error: 'connector-unavailable', detail: 'slides.create not registered' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const slidesResult = await slides.execute(
        {
          title: input.title,
          outline: Array.isArray(input.outline) ? input.outline : [],
          sections: Array.isArray(input.sections) ? input.sections : undefined,
        },
        { personaId: context.personaId, intentId: body.sourceIntentId ?? null, cartridge },
      );
      if (!slidesResult.ok) {
        return NextResponse.json(
          { error: 'slides-create-failed', code: slidesResult.code, detail: slidesResult.reason, hint: slidesResult.hint },
          { status: slidesResult.code === 'not-connected' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const slidesOut = slidesResult.output as { presentationId?: string; webViewLink?: string | null } | undefined;
      const presentationId = slidesOut?.presentationId ?? '';
      const locationUrl = slidesOut?.webViewLink ?? (presentationId ? `https://docs.google.com/presentation/d/${presentationId}/edit` : null);

      const receipt = await createActivityReceipt({
        personaId: context.personaId,
        intentId: body.sourceIntentId ?? null,
        activeCartridge: cartridge,
        actionType: 'artifact_created',
        summary: `Created Slides deck: ${input.title}`,
        agentsInvoked: ['aigent-me', ...(body.specialistId ? [body.specialistId] : [])],
        toolsUsed: ['google.slides.create'],
        iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
        contextShared: ['intent-summary', 'experience-meta-slice'],
        artifactsCreated: [`slide-outline:${presentationId || input.title}`],
        approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
      });

      const surface: CreateArtifactSurface = {
        artifactId,
        artifactType: 'slide-outline',
        title: input.title,
        destination: 'drive',
        status: 'draft',
        receiptId: receipt?.id ?? null,
        intentId: body.sourceIntentId ?? null,
        message: 'Slides deck created privately in your Drive.',
        createdAt,
        locationUrl,
      };
      return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ─────────────────────────────────────────────────────────────────
    // Phase 6.b Part 3 — Marketa email artifact. Marketa send is always
    // a "send-then-store" flow (Mailjet has no draft state), so we just
    // record the artifact in the runtime with the action connector
    // bound; the Send button + SecondTierApprovalCard externalise it.
    // ─────────────────────────────────────────────────────────────────
    if (body.artifactType === 'marketa-email') {
      const input = (body.connectorInput ?? {}) as {
        to?: string;
        subject?: string;
        bodyText?: string;
        cc?: string;
        bcc?: string;
        fromName?: string;
        campaignId?: string;
        cohortId?: string;
        /** Persona upload ids selected as attachments by the operator
         *  in the compose modal. Resolved server-side by the marketa
         *  connector at send time via the upload service. */
        attachmentUploadIds?: string[];
      };
      // Cohort branch — when the operator picked a campaign + cohort,
      // the artifact targets the marketa.send-cohort connector which
      // fans out via Mailjet batch to every member. Single approval
      // for the whole cohort; `to` field becomes optional (and gets
      // dropped from actionInput since the connector resolves
      // recipients server-side from the CRM).
      const isCohortSend = !!input.campaignId && (!!input.cohortId || input.campaignId === 'ks_prospects');
      if (isCohortSend) {
        if (!input.subject || !input.bodyText) {
          return NextResponse.json(
            { error: 'invalid-connector-input', detail: 'subject + bodyText required for cohort send' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        const receiptRow = await createActivityReceipt({
          personaId: context.personaId,
          intentId: body.sourceIntentId ?? null,
          activeCartridge: cartridge,
          actionType: 'artifact_created',
          summary: `Drafted Marketa cohort email: ${input.subject} → ${input.campaignId}:${input.cohortId ?? 'all'}`,
          agentsInvoked: ['aigent-me', 'marketa'],
          toolsUsed: ['runtime'],
          iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
          contextShared: ['intent-summary', 'experience-meta-slice'],
          artifactsCreated: [`marketa-cohort-email:${input.subject}`],
          approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
        });
        const cohortLabel = `${input.campaignId}${input.cohortId ? `:${input.cohortId}` : ''}`;
        const surface: CreateArtifactSurface = {
          artifactId,
          artifactType: 'marketa-cohort-email',
          title: `${input.subject} → ${cohortLabel}`,
          destination: 'runtime',
          status: 'draft',
          receiptId: receiptRow?.id ?? null,
          intentId: body.sourceIntentId ?? null,
          message: `Marketa cohort email drafted for ${cohortLabel}. Click "Approve & send" to fan out to every member via Mailjet.`,
          createdAt,
          actionConnectorId: 'marketa.send-cohort',
          actionConnectorLabel: 'Approve & send to cohort',
          actionInput: {
            campaignId: input.campaignId,
            ...(input.cohortId ? { cohortId: input.cohortId } : {}),
            subject: input.subject,
            bodyText: input.bodyText,
            ...(input.fromName ? { fromName: input.fromName } : {}),
            ...(Array.isArray(input.attachmentUploadIds) && input.attachmentUploadIds.length > 0
              ? { attachmentUploadIds: input.attachmentUploadIds }
              : {}),
          },
        };
        return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
      }

      // Single-recipient branch — the legacy transactional path.
      if (!input.to || !input.subject || !input.bodyText) {
        return NextResponse.json(
          { error: 'invalid-connector-input', detail: 'to + subject + bodyText required' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const receiptRow = await createActivityReceipt({
        personaId: context.personaId,
        intentId: body.sourceIntentId ?? null,
        activeCartridge: cartridge,
        actionType: 'artifact_created',
        summary: `Drafted Marketa email: ${input.subject}`,
        agentsInvoked: ['aigent-me', 'marketa'],
        toolsUsed: ['runtime'],
        iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
        contextShared: ['intent-summary', 'experience-meta-slice'],
        artifactsCreated: [`marketa-email:${input.subject}`],
        approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
      });
      const surface: CreateArtifactSurface = {
        artifactId,
        artifactType: 'marketa-email',
        title: input.subject,
        destination: 'runtime',
        status: 'draft',
        receiptId: receiptRow?.id ?? null,
        intentId: body.sourceIntentId ?? null,
        message: `Marketa email drafted for ${input.to}. Click "Send via Mailjet" to externalise — approval required.`,
        createdAt,
        actionConnectorId: 'marketa.send-transactional',
        actionConnectorLabel: 'Send via Mailjet',
        actionInput: {
          to: input.to,
          subject: input.subject,
          bodyText: input.bodyText,
          ...(input.cc ? { cc: input.cc } : {}),
          ...(input.bcc ? { bcc: input.bcc } : {}),
          ...(input.fromName ? { fromName: input.fromName } : {}),
          ...(input.campaignId ? { campaignId: input.campaignId } : {}),
          ...(input.cohortId ? { cohortId: input.cohortId } : {}),
          ...(Array.isArray(input.attachmentUploadIds) && input.attachmentUploadIds.length > 0
            ? { attachmentUploadIds: input.attachmentUploadIds }
            : {}),
        },
      };
      return NextResponse.json(surface, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Runtime destination — receipt-bound record only.
    const receipt = await createActivityReceipt({
      personaId: context.personaId,
      intentId: body.sourceIntentId ?? null,
      activeCartridge: cartridge,
      actionType: 'artifact_created',
      summary: `Created ${body.artifactType}: ${derivedTitle}`,
      agentsInvoked: [
        'aigent-me',
        ...(body.specialistId ? [body.specialistId] : []),
      ],
      toolsUsed: ['runtime'],
      iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
      contextShared: ['intent-summary', 'experience-meta-slice'],
      artifactsCreated: [`${body.artifactType}:${derivedTitle}`],
      approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
    });

    const surface: CreateArtifactSurface = {
      artifactId,
      artifactType: body.artifactType,
      title: derivedTitle,
      destination: 'runtime',
      status: 'draft',
      receiptId: receipt?.id ?? null,
      intentId: body.sourceIntentId ?? null,
      message:
        `Artifact created in the runtime as a draft. ` +
        `Externalising to Drive / Calendar / Slides lands in Phase 6.b Part 2.5b.`,
      createdAt,
    };

    return NextResponse.json(surface, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/create-artifact] failed: ${msg}`);
    return NextResponse.json(
      { error: 'create-artifact-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

function cryptoRandomId(): string {
  // 10-char URL-safe id; collision-tolerant for alpha. Server-side only.
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
