/**
 * Server-side admin gate stub.
 *
 * SCOPE: this is a stub used by Sprint 4 admin API routes (investor dashboard).
 * The full IAM service (in flight on a separate workstream) will replace this
 * with a persona-resolved admin check sourced from the iQube identity layer.
 *
 * Until then, this provides a uniform check site so the swap is a single-file
 * change later — every admin route imports `requireAdmin(req)` instead of
 * inlining its own header check.
 *
 * Acceptance:
 *   • development / localhost — always allowed (so local UI work isn't blocked)
 *   • production — requires `x-admin-token` header matching ADMIN_TOKEN env var
 *
 * DO NOT use this for dual-use endpoints that also serve non-admins. It only
 * answers "is this caller authorized to perform admin actions?", nothing more.
 */

import type { NextRequest } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';

export function requireAdmin(req: NextRequest): boolean {
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalhost = req.url.includes('localhost') || req.url.includes('127.0.0.1');
  if (isDev || isLocalhost) return true;

  const token = req.headers.get('x-admin-token');
  return !!token && token === process.env.ADMIN_TOKEN;
}

/**
 * The spine-resolved admin gate — what the stub above always said would
 * replace it: *"the full IAM service will replace this with a persona-resolved
 * admin check sourced from the iQube identity layer."* That layer has landed,
 * so new routes use this and existing ones migrate.
 *
 * WHY THIS EXISTS AS A SECOND FUNCTION RATHER THAN A REWRITE. Resolving a
 * persona is asynchronous; making `requireAdmin` async would change its
 * signature under nineteen live routes at once. Adding the correct gate beside
 * it lets routes move deliberately, one at a time, each verified. The stub is
 * not being blessed — it is being superseded, and the migration is tracked
 * below rather than pretended away.
 *
 * NO DEV BYPASS. The stub returns `true` for any non-production or localhost
 * request. That is defensible for a route that only ever exposes admin
 * *actions*, which is what its header scopes it to. It is NOT defensible for a
 * route that returns other people's personal data: a preview deployment, a
 * misread NODE_ENV, or a hostname containing "localhost" would open the whole
 * table. This gate has one answer in every environment.
 *
 * CLAUDE.md's spine table is explicit that a hand-rolled admin check is the
 * defect — `persona.cartridgeFlags.isAdmin` is server-resolved and is the
 * single source of that truth. This function is the check SITE, not a second
 * implementation of the decision.
 *
 * The ops-token path is retained for headless callers (cron, scripts) that
 * hold no persona. It requires `ADMIN_OPS_TOKEN` to be set — an unset variable
 * grants nothing, so a misconfigured environment fails closed rather than open.
 */
export async function requireAdminPersona(req: NextRequest): Promise<boolean> {
  const opsToken = process.env.ADMIN_OPS_TOKEN;
  if (opsToken) {
    const header = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
    if (header.startsWith('Bearer ') && header.slice(7) === opsToken) return true;
  }
  try {
    const persona = await getActivePersona(req);
    return persona?.cartridgeFlags?.isAdmin === true;
  } catch {
    // A resolver failure is not an authorization. Fail closed.
    return false;
  }
}
