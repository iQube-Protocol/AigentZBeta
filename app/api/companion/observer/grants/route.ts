/**
 * GET/POST /api/companion/observer/grants
 *
 * PRD-MMC-IMPL-001 Increment 2 (server-side consent/grant API routes).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-001-companion-phase2-implementation-plan.md §2.
 *
 * Spine-authenticated, persona-scoped list + grant endpoint for the
 * Observer's seven capability grants (`types/companionObserver.ts`,
 * Increment 1). This route is a thin persistence + spine-auth shell around
 * Increment 1's pure state-machine functions — it never reimplements
 * `grantCapability` / `listActiveGrants` inline.
 *
 * GET  — returns the caller's currently-active grants. T1-safe: the
 *        response body is `{ grants: ObserverCapabilityGrant[] }` and
 *        contains NO `personaId` / `authProfileId` / `rootDid` anywhere,
 *        mirroring `GET /api/wallet/active-persona`'s own tier discipline.
 * POST — body `{ capability, scope, siteDomain? }`. Rejects an
 *        unsupported scope for the given capability with 400 (never
 *        silently coerces — `scopeIsSupported`, Increment 1). Grants are
 *        idempotent per Increment 1's own `grantCapability` semantics.
 *
 * Fails closed: `getActivePersona` returning null on either verb produces
 * a 401 with NO Supabase read/write attempted.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  OBSERVER_CAPABILITIES,
  type ObserverCapability,
  type ObserverCapabilityScope,
} from '@/types/companionObserver';
import { grantCapability, listActiveGrants, scopeIsSupported } from '@/services/companion/observerConsent';
import { insertGrantRow, loadGrantState } from '@/app/api/companion/observer/_lib/store';

export const dynamic = 'force-dynamic';

function unauthenticated(): NextResponse {
  return NextResponse.json(
    { error: 'unauthenticated' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function isObserverCapability(value: unknown): value is ObserverCapability {
  return typeof value === 'string' && (OBSERVER_CAPABILITIES as readonly string[]).includes(value);
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

  const state = await loadGrantState(admin, persona.personaId);
  return NextResponse.json(
    { grants: listActiveGrants(state) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return unauthenticated();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json-body' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { capability, scope, siteDomain } = (body ?? {}) as {
    capability?: unknown;
    scope?: unknown;
    siteDomain?: unknown;
  };

  if (!isObserverCapability(capability)) {
    return NextResponse.json(
      { error: 'unknown-capability' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (scope !== 'global' && scope !== 'site') {
    return NextResponse.json(
      { error: 'invalid-scope' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const requestedScope = scope as ObserverCapabilityScope;

  if (!scopeIsSupported(capability, requestedScope)) {
    return NextResponse.json(
      { error: 'unsupported-scope-for-capability' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let resolvedSiteDomain: string | undefined;
  if (requestedScope === 'site') {
    if (typeof siteDomain !== 'string' || siteDomain.trim().length === 0) {
      return NextResponse.json(
        { error: 'site-domain-required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    resolvedSiteDomain = siteDomain.trim();
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const state = await loadGrantState(admin, persona.personaId);
  const nextState = grantCapability(state, capability, requestedScope, resolvedSiteDomain);

  if (nextState !== state) {
    // grantCapability (Increment 1) appends exactly one new entry when the
    // state actually changes — the idempotent "already active" case returns
    // the SAME state reference and never reaches here.
    const added = nextState[capability][nextState[capability].length - 1];
    const { error } = await insertGrantRow(admin, persona.personaId, added);
    if (error) {
      return NextResponse.json(
        { error: 'grant-persist-failed', detail: error },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  return NextResponse.json(
    { grants: listActiveGrants(nextState) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
