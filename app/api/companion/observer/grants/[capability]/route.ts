/**
 * DELETE /api/companion/observer/grants/[capability]?site=<domain>
 *
 * PRD-MMC-IMPL-001 Increment 2 (server-side consent/grant API routes).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-001-companion-phase2-implementation-plan.md §2.
 *
 * Spine-authenticated revoke endpoint. Scope is inferred from the optional
 * `?site=` query param: present ⇒ revoke the `'site'`-scoped grant for that
 * domain; absent ⇒ revoke the `'global'`-scoped grant. This matches the
 * plan's own framing ("scoped by an optional `?site=` query param for
 * per-site grants") without inventing a second request-body shape for a
 * DELETE verb.
 *
 * Delegates to `revokeCapability` (Increment 1, pure) — NEVER deletes the
 * underlying row; only the matching active grant's `revokedAt` is set,
 * preserving the audit trail Increment 1 already establishes.
 *
 * Fails closed: no `getActivePersona` resolution ⇒ 401, no DB write
 * attempted.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  OBSERVER_CAPABILITIES,
  type ObserverCapability,
  type ObserverCapabilityScope,
} from '@/types/companionObserver';
import { listActiveGrants, revokeCapability, scopeIsSupported } from '@/services/companion/observerConsent';
import { loadGrantState, markRowRevoked } from '@/app/api/companion/observer/_lib/store';

export const dynamic = 'force-dynamic';

function unauthenticated(): NextResponse {
  return NextResponse.json(
    { error: 'unauthenticated' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function isObserverCapability(value: string): value is ObserverCapability {
  return (OBSERVER_CAPABILITIES as readonly string[]).includes(value);
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ capability: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return unauthenticated();

  const { capability: rawCapability } = await props.params;
  if (!isObserverCapability(rawCapability)) {
    return NextResponse.json(
      { error: 'unknown-capability' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const capability = rawCapability;

  const url = new URL(request.url);
  const site = url.searchParams.get('site')?.trim() || undefined;
  const scope: ObserverCapabilityScope = site ? 'site' : 'global';

  if (!scopeIsSupported(capability, scope)) {
    return NextResponse.json(
      { error: 'unsupported-scope-for-capability' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const state = await loadGrantState(admin, persona.personaId);
  const revokedAt = new Date().toISOString();
  const nextState = revokeCapability(state, capability, scope, site, revokedAt);

  if (nextState !== state) {
    const { error } = await markRowRevoked(admin, persona.personaId, capability, scope, site, revokedAt);
    if (error) {
      return NextResponse.json(
        { error: 'revoke-persist-failed', detail: error },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  return NextResponse.json(
    { grants: listActiveGrants(nextState) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
