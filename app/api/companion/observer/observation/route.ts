/**
 * POST /api/companion/observer/observation
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 1 (RATIFIED 2026-07-23) — closes the gap
 * PRD-MMC-IMPL-002 §1 flagged: "no live, authenticated Companion API session
 * exists to forward this to" (`extension/companion-observer/background.js`'s
 * own `OBSERVATION` case comment). This is that session.
 *
 * Spine-authenticated. Accepts a `BrowserContextObservation`-shaped body
 * (`types/companionObserver.ts`) and stores ONLY the CURRENT observation per
 * persona (upsert, not an append-only log — this is live browsing context,
 * not an audit trail; the DVN/receipt discipline governs audit-worthy
 * events, not passive browsing context).
 *
 * CRITICAL — defense in depth: this route NEVER trusts the client's own
 * `grantedCapabilities` claim in the body. It loads the persona's ACTUAL
 * stored grant state via `loadGrantState` (the exact helper
 * `app/api/companion/observer/grants/route.ts` already uses) and re-runs
 * `assertObservationRespectsGrants` (`services/companion/observerContext.ts`)
 * — the SAME function the extension's background worker runs locally —
 * against that server-side state instead. A client that claims a populated
 * field for a capability that isn't actually granted server-side is
 * rejected with 400 — fail closed, per this session's consent-system
 * discipline. The stored `granted_capabilities` column records the
 * SERVER-COMPUTED active set at write time, never the client's claim.
 *
 * Fails closed: `getActivePersona` returning null produces a 401 with NO
 * Supabase read/write attempted — mirrors every other Companion route this
 * session built.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  OBSERVER_CAPABILITIES,
  type BrowserContextObservation,
  type ObserverCapability,
} from '@/types/companionObserver';
import { listActiveGrants } from '@/services/companion/observerConsent';
import { assertObservationRespectsGrants } from '@/services/companion/observerContext';
import { loadGrantState } from '@/app/api/companion/observer/_lib/store';
import { upsertLatestObservation } from '@/app/api/companion/observer/_lib/observationStore';

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

function isObserverCapabilityArray(value: unknown): value is ObserverCapability[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' && (OBSERVER_CAPABILITIES as readonly string[]).includes(v))
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Structural validation only — does NOT check consent. Confirms the body
 * matches `BrowserContextObservation`'s shape so downstream code can rely on
 * typed fields. Returns the parsed observation or an error string.
 */
function parseObservation(body: unknown): { observation: BrowserContextObservation } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid-body' };
  const b = body as Record<string, unknown>;

  if (!isObserverCapabilityArray(b.grantedCapabilities)) {
    return { error: 'grantedCapabilities must be an array of known ObserverCapability values' };
  }
  if (typeof b.observedAt !== 'string' || b.observedAt.trim().length === 0) {
    return { error: 'observedAt (ISO timestamp string) is required' };
  }
  if (
    !isOptionalString(b.currentTabDomain) ||
    !isOptionalString(b.currentTabTitle) ||
    !isOptionalString(b.selectionText) ||
    !isOptionalString(b.pageDocumentExcerpt)
  ) {
    return { error: 'currentTabDomain/currentTabTitle/selectionText/pageDocumentExcerpt must be strings when present' };
  }

  return {
    observation: {
      grantedCapabilities: b.grantedCapabilities,
      ...(b.currentTabDomain !== undefined ? { currentTabDomain: b.currentTabDomain as string } : {}),
      ...(b.currentTabTitle !== undefined ? { currentTabTitle: b.currentTabTitle as string } : {}),
      ...(b.selectionText !== undefined ? { selectionText: b.selectionText as string } : {}),
      ...(b.pageDocumentExcerpt !== undefined ? { pageDocumentExcerpt: b.pageDocumentExcerpt as string } : {}),
      observedAt: b.observedAt,
    },
  };
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

  const parsed = parseObservation(rawBody);
  if ('error' in parsed) return badRequest('invalid-observation', parsed.error);
  const { observation } = parsed;

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Load the persona's ACTUAL stored grant state — never the client's own
  // `grantedCapabilities` claim above, which is structurally validated only.
  const actualState = await loadGrantState(admin, persona.personaId);

  try {
    assertObservationRespectsGrants(observation, actualState);
  } catch (err) {
    return badRequest(
      'observation-violates-granted-capabilities',
      err instanceof Error ? err.message : String(err),
    );
  }

  // The server-computed active set at write time — the honest record, not
  // the client's (possibly stale) claim.
  const actualGrantedCapabilities = Array.from(
    new Set(listActiveGrants(actualState).map((g) => g.capability)),
  );

  const { error } = await upsertLatestObservation(
    admin,
    persona.personaId,
    observation,
    actualGrantedCapabilities,
  );
  if (error) {
    return NextResponse.json(
      { error: 'observation-persist-failed', detail: error },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
