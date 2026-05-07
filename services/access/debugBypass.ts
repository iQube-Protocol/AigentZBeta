/**
 * debugBypass — operator-authorised, env-gated bypass for the THREE
 * access-spine debug endpoints (NOT the real content-delivery gates).
 *
 * SCOPE — what this file affects:
 *   /api/access/inspect      (debug ALLOW/DENY inspector)
 *   /api/access/whoami       (T0 self-debug)
 *   /api/access/list-assets  (admin-only asset browser)
 *
 * SCOPE — what this file does NOT affect:
 *   /api/content/pdf-page/[cid]    (real PDF gate)
 *   /api/content/cover/[cid]       (real cover gate)
 *   /api/content/video/[cid]       (real video gate)
 *   /api/content/pdf/[cid]         (real PDF gate)
 *   /api/wallet/active-persona     (real T1 surface issuer)
 *   ...and every other gated route in the platform.
 *
 * Toggle: HARDCODED ON during operator-authorised debug period. The
 * three debug endpoints accept unauthenticated callers and synthesise
 * an ActivePersonaContext with isAdmin=true so the operator can run
 * the spine verification recipe without fighting auth.
 *
 * To restore strict auth: revert this file (or change
 * isDebugBypassEnabled() to return false) and re-deploy. There is no
 * env var to set/unset — the operator explicitly asked for the bypass
 * to be 'just there', no Amplify console juggling required.
 *
 * Every bypass invocation emits a loud
 *   [SPINE] DEBUG-OPEN BYPASS route=<...>
 * log line so the audit trail records the period during which the
 * bypass was live.
 *
 * IMPORTANT — never reference this from the four content-delivery
 * gates. Those remain strict regardless of any env var.
 */

import type { ActivePersonaContext } from '@/types/access';

/**
 * TEMPORARY DEBUG — operator-authorised, unconditional bypass.
 *
 * To restore strict auth on the three debug endpoints:
 *   1. Change this function to return false, OR
 *   2. Revert the commit that flipped this on.
 *
 * Tracked as a todo on the engineering session that introduced this:
 * 'Revert ACCESS_DEBUG_OPEN unconditional bypass after spine
 * verification is complete'.
 */
export function isDebugBypassEnabled(): boolean {
  return true; // TEMPORARY DEBUG — restore to `process.env.ACCESS_DEBUG_OPEN === '1'` (or `false`) after testing.
}

export function buildDebugBypassContext(): ActivePersonaContext {
  return {
    // Sentinel ids — clearly not real persona/auth-profile uuids.
    // Distinguishable in any downstream log line.
    personaId: '__debug_bypass_persona__',
    authProfileId: '__debug_bypass_authprofile__',
    identifiability: 'identifiable',
    cartridgeFlags: { isAdmin: true, isPartner: true },
    cohortMemberships: [],
    source: 'api-key',
  };
}

export function logDebugBypass(route: string): void {
  // Loud, single-line, greppable. Audit trail of bypass usage.
  console.warn(
    `[SPINE] DEBUG-OPEN BYPASS route=${route} ` +
    `note='ACCESS_DEBUG_OPEN=1 is set; debug endpoint accepted ` +
    `unauthenticated caller with synthesised admin context'`,
  );
}
