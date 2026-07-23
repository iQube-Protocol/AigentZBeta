/**
 * GET/POST /api/companion/capture
 *
 * PRD-MMC-IMPL-003 Increment 2, DESIGN — awaiting operator ratification.
 * The route where a capture interaction (Recognition) actually becomes a
 * constitutional object (Constitution) — PRD-MMC-IMPL-003 §0.8's governing
 * invariant made concrete: "nothing enters the Constitutional Runtime except
 * by an explicit act of constitutionalization," and that act happens HERE,
 * server-side, never in the extension.
 *
 * POST accepts a `CapturedObject`-shaped body. CRITICAL — defense in depth,
 * mirroring `app/api/companion/observer/observation/route.ts` exactly: this
 * route NEVER trusts a client-claimed grant. It loads the persona's ACTUAL
 * stored grant state via `loadGrantState` (the same helper the Observer
 * routes already use) and runs `assertCaptureRespectsGrants`
 * (`services/companion/captureConsent.ts`) against that server-side state.
 * A client that claims a source kind for a capability that isn't actually
 * granted server-side is rejected with 400.
 *
 * PDF source kind: the client is NOT expected to supply `contentText` for
 * `sourceKind: 'pdf'` — this route derives it server-side from `sourceUrl`
 * via the existing `services/content/pdfExtractionService.ts`
 * (PRD-MMC-IMPL-003 §0.5) — the extension only identifies and hands off,
 * the runtime constitutionalizes.
 *
 * Every capture is inserted with `status: 'inbox'` — there is no "create
 * directly assigned" path (PRD-MMC-IMPL-003 §0.3).
 *
 * Fails closed: `getActivePersona` returning null produces a 401 with NO
 * Supabase read/write attempted — mirrors every other Companion route.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  CAPTURE_SOURCE_KINDS,
  CAPTURED_CONTENT_MAX_CHARS,
  type CaptureSourceKind,
  type CapturedObject,
} from '@/types/companionCapture';
import { assertCaptureRespectsGrants } from '@/services/companion/captureConsent';
import { loadGrantState } from '@/app/api/companion/observer/_lib/store';
import { insertCapturedObject, listCapturedObjects } from './_lib/store';

export const dynamic = 'force-dynamic';

function unauthenticated(): NextResponse {
  return NextResponse.json(
    { error: 'unauthenticated' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function badRequest(error: string, detail?: string): NextResponse {
  return NextResponse.json(
    { error, ...(detail ? { detail } : {}) },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

function isCaptureSourceKind(value: unknown): value is CaptureSourceKind {
  return typeof value === 'string' && (CAPTURE_SOURCE_KINDS as readonly string[]).includes(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/** Structural validation only — does NOT check consent. */
function parseCapture(body: unknown): { capture: CapturedObject } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid-body' };
  const b = body as Record<string, unknown>;

  if (!isCaptureSourceKind(b.sourceKind)) {
    return { error: `sourceKind must be one of ${CAPTURE_SOURCE_KINDS.join(', ')}` };
  }
  if (typeof b.capturedAt !== 'string' || b.capturedAt.trim().length === 0) {
    return { error: 'capturedAt (ISO timestamp string) is required' };
  }
  if (!isOptionalString(b.sourceUrl) || !isOptionalString(b.title) || !isOptionalString(b.contentText)) {
    return { error: 'sourceUrl/title/contentText must be strings when present' };
  }
  if (b.sourceKind !== 'pdf' && (!b.contentText || (b.contentText as string).trim().length === 0)) {
    return { error: 'contentText is required for every sourceKind except pdf (server-derived)' };
  }

  return {
    capture: {
      sourceKind: b.sourceKind,
      ...(b.sourceUrl !== undefined ? { sourceUrl: b.sourceUrl as string } : {}),
      ...(b.title !== undefined ? { title: b.title as string } : {}),
      ...(b.contentText !== undefined ? { contentText: (b.contentText as string).slice(0, CAPTURED_CONTENT_MAX_CHARS) } : {}),
      capturedAt: b.capturedAt,
    },
  };
}

/** Derive site domain from a capture's sourceUrl for the site-scoped grant
 *  check — mirrors how the Observer route reads siteDomain from
 *  `currentTabDomain` directly (a capture has a URL, not a bare domain
 *  field, so this parses it the same way a browser would). */
function siteDomainFromCapture(capture: CapturedObject): string | undefined {
  if (!capture.sourceUrl) return undefined;
  try {
    return new URL(capture.sourceUrl).hostname;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return unauthenticated();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('invalid-json-body');
  }

  const parsed = parseCapture(rawBody);
  if ('error' in parsed) return badRequest('invalid-capture', parsed.error);
  let { capture } = parsed;

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Load the persona's ACTUAL stored grant state — never the client's claim.
  const actualState = await loadGrantState(admin, persona.personaId);

  try {
    assertCaptureRespectsGrants(capture, actualState, siteDomainFromCapture(capture));
  } catch (err) {
    return badRequest(
      'capture-violates-granted-capabilities',
      err instanceof Error ? err.message : String(err),
    );
  }

  // PDF: the runtime constitutionalizes, the extension only hands off a URL.
  if (capture.sourceKind === 'pdf') {
    if (!capture.sourceUrl) return badRequest('sourceUrl is required for a pdf capture');
    try {
      const { getPDFExtractionService } = await import('@/services/content/pdfExtractionService');
      const result = await getPDFExtractionService().extractFromUrl(capture.sourceUrl);
      if (!result.success || !result.fullText) {
        return badRequest('pdf-extraction-failed', result.error ?? 'no text extracted');
      }
      capture = { ...capture, contentText: result.fullText.slice(0, CAPTURED_CONTENT_MAX_CHARS) };
    } catch (e) {
      return badRequest('pdf-extraction-failed', e instanceof Error ? e.message : String(e));
    }
  }

  const { record, error } = await insertCapturedObject(admin, persona.personaId, capture);
  if (error || !record) {
    return NextResponse.json(
      { error: 'capture-persist-failed', detail: error },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({ ok: true, capture: record }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return unauthenticated();

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const captures = await listCapturedObjects(admin, persona.personaId);
  return NextResponse.json({ ok: true, captures }, { headers: { 'Cache-Control': 'no-store' } });
}
