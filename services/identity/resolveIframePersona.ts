/**
 * resolveIframePersona — iframe-context fallback for active-persona resolution.
 *
 * The codex iframe (`/triad/embed/codex/...`) doesn't reliably carry the
 * Supabase Authorization header or x-auth-profile-id header that
 * `getActivePersona(req)` requires (services/identity/getActivePersona.ts:255-256).
 * In that context `getActivePersona` returns null and every downstream
 * `persona_owns` check resolves to false, breaking the codex tabs even
 * when the ContentQube registry has the rows and the persona has the
 * entitlements.
 *
 * This helper provides a narrow, read-only fallback: if `?personaId=` is
 * present in the URL and corresponds to a real `personas` row, return a
 * minimal `ActivePersonaContext` sufficient for `userOwnsAsset` and
 * `evaluateAccess` to resolve correctly.
 *
 * Security envelope:
 *   - `cartridgeFlags.isAdmin` and `isPartner` are HARD-CODED to false here.
 *     URL fallback can NEVER grant admin/partner privileges; admin surfaces
 *     must continue to use `getActivePersona(req)` directly and reject
 *     unauthenticated callers.
 *   - The personaId is verified to exist in the `personas` table before
 *     a context is returned. Random UUIDs in the URL don't resolve.
 *   - This is the same trust level the legacy `/api/codex/owned`,
 *     `/api/codex/knyt-purchases`, and `/api/entitlements/list` routes
 *     already operate at — they all read `personaId` from the URL directly.
 *   - Identifiability defaults to the floor ('semi_anonymous').
 *   - The `authProfileId` is set to the persona's row `auth_profile_id`
 *     so downstream callers that join on it (e.g. cohort lookups) still
 *     work. Read-only.
 *
 * When to use:
 *   - Routes that need `persona_owns` resolution from inside the codex
 *     iframe (i.e. registry routes consumed by ScrollsTab, CharactersTab,
 *     KnytShelfTab, KnytTab).
 *   - Wrap `getActivePersona(req)` so the cookie/token path remains
 *     primary and the URL fallback only fires when null.
 *
 * When NOT to use:
 *   - Admin-gated routes (e.g. /api/registry/content-qube/browse).
 *   - Routes that mutate state (purchases, mints, receipts) — those must
 *     verify the caller via the spine, not via a URL claim.
 *   - Anywhere `cartridgeFlags.isAdmin` is meaningful.
 */

import type { NextRequest } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { ActivePersonaContext } from '@/types/access';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IdentityFloor = ActivePersonaContext['identifiability'];
const IDENTIFIABILITY_FLOOR: IdentityFloor = 'semi_anonymous';

interface PersonaRow {
  id: string;
  auth_profile_id: string | null;
  default_identity_state: string | null;
  fio_handle: string | null;
}

async function lookupPersonaFromUrl(req: NextRequest): Promise<PersonaRow | null> {
  const raw = req.nextUrl.searchParams.get('personaId')?.trim();
  if (!raw) return null;

  const supabase = getSupabaseServer();
  if (!supabase) return null;

  // FIO handle (arkagent@knyt style) — same resolution path used by
  // /api/codex/owned. The UUID-only guard was too strict: KnytTab's
  // effectivePersonaId can be a FIO handle when activePersonaId from
  // PersonaContext resolves before the UUID prop arrives.
  if (raw.includes('@')) {
    const { data, error } = await supabase
      .from('personas')
      .select('id, auth_profile_id, default_identity_state, fio_handle')
      .eq('fio_handle', raw)
      .eq('status', 'active')
      .single();
    if (error || !data) return null;
    return data as PersonaRow;
  }

  if (!UUID_RE.test(raw)) return null;

  const { data, error } = await supabase
    .from('personas')
    .select('id, auth_profile_id, default_identity_state, fio_handle')
    .eq('id', raw)
    .eq('status', 'active')
    .single();
  if (error || !data) return null;
  return data as PersonaRow;
}

function rowToContext(row: PersonaRow): ActivePersonaContext {
  const identifiability: IdentityFloor =
    row.default_identity_state === 'anonymous' ||
    row.default_identity_state === 'semi_anonymous' ||
    row.default_identity_state === 'semi_identifiable' ||
    row.default_identity_state === 'identifiable'
      ? (row.default_identity_state as IdentityFloor)
      : IDENTIFIABILITY_FLOOR;

  return {
    personaId: row.id,
    authProfileId: row.auth_profile_id ?? '',
    identifiability,
    cartridgeFlags: {
      isAdmin: false,
      isPartner: false,
    },
    cohortMemberships: [],
    fioHandle: row.fio_handle ?? null,
    source: 'session-cookie',
  };
}

/**
 * Resolve the active persona for a read-only iframe-context route.
 *
 * Strategy:
 *   1. Try `getActivePersona(req)` — the spine path (cookie / Authorization
 *      header / x-auth-profile-id). Always preferred when present.
 *   2. If null, look up `?personaId=` in the URL against the `personas`
 *      table. Returns a minimal context with admin/partner flags forced
 *      to false (URL claims never grant privileges).
 *   3. Otherwise null — callers must treat as unauthenticated.
 */
export async function resolveIframePersona(
  req: NextRequest,
): Promise<ActivePersonaContext | null> {
  const primary = await getActivePersona(req).catch(() => null);
  if (primary) return primary;

  const row = await lookupPersonaFromUrl(req);
  if (!row) return null;
  return rowToContext(row);
}
