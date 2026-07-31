/**
 * QubeTalk read-path access gate.
 *
 * ── The incident this exists to close (2026-07-28) ──────────────────────────
 *
 * QubeTalk history rendered in full to an ANONYMOUS visitor loading a Companion
 * embed URL in a private window. Four independent failures had to hold at once,
 * and every one of them did:
 *
 *   1. `GET /api/qubetalk/channels` and `.../[id]/messages` performed NO caller
 *      authentication whatsoever.
 *   2. `tenant_id` — the only thing resembling a scope — arrived as a QUERY
 *      PARAMETER. A filter the caller chooses is not an authorization; the
 *      Companion literally requests `?tenant_id=metame`.
 *   3. The server reads through `getSupabaseServer()`, which prefers
 *      `SUPABASE_SERVICE_ROLE_KEY` — and the service role BYPASSES RLS. The
 *      table policies never execute on this path at all.
 *   4. Those policies are inert anyway: they gate on
 *      `current_setting('app.current_tenant_id')`, a Postgres session variable
 *      that is never set anywhere in the codebase. CB-1 exactly — a mechanism
 *      that cannot fire is indistinguishable from one that does not exist.
 *
 * Failures 3 and 4 mean the RLS on `qubetalk_channels` / `qubetalk_messages`
 * has never once protected a row. It reads as protection in review, which is
 * why the gap survived: the migration *looks* like it did the work.
 *
 * ── What this gate does ─────────────────────────────────────────────────────
 *
 * Authenticates the caller through the identity spine and returns the tenant
 * scope the caller is ACTUALLY entitled to. The requested `tenant_id` is
 * treated as a REQUEST, never as a grant: it is checked against the caller's
 * resolved scope and refused when it does not match.
 *
 * Fails closed. No persona ⇒ 401 and no rows, which is the correct answer for
 * an anonymous embed regardless of what the surface would like to render.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';

/** The tenant every persona-scoped QubeTalk surface reads under today. */
export const DEFAULT_PERSONA_TENANT = 'metame';

export interface ChannelAccess {
  personaId: string;
  /** The tenant the caller may read. Derived server-side, never from input. */
  tenantId: string;
  isAdmin: boolean;
}

export type ChannelAccessResult =
  | { ok: true; access: ChannelAccess }
  | { ok: false; response: NextResponse };

/**
 * Resolve the caller and the tenant scope they may read.
 *
 * `requestedTenantId` is what the client asked for. It is honoured only when
 * the caller is entitled to it — an admin may read any tenant; everyone else
 * reads the persona tenant and nothing else. Asking for another tenant is a
 * 403, not a silent downgrade, so a misconfigured surface surfaces as an error
 * instead of quietly returning the wrong tenant's history.
 */
export async function requireChannelAccess(
  request: NextRequest,
  requestedTenantId: string | null,
): Promise<ChannelAccessResult> {
  const persona = await getActivePersona(request).catch(() => null);

  if (!persona?.personaId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      ),
    };
  }

  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  const allowedTenant = DEFAULT_PERSONA_TENANT;

  if (requestedTenantId && requestedTenantId !== allowedTenant && !isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Not authorized for the requested tenant' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    access: {
      personaId: persona.personaId,
      tenantId: isAdmin && requestedTenantId ? requestedTenantId : allowedTenant,
      isAdmin,
    },
  };
}
