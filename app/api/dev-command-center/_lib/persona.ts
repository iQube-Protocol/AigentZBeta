/**
 * Timeout-guarded persona resolution for the Dev Command Center routes.
 *
 * Every CDE route (terminal / github / linear / devtools) awaits
 * getActivePersona(request) before doing any work. That resolver runs several
 * Supabase queries; if the identity spine's DB is slow or unreachable FROM THE
 * SERVER it can hang to the Lambda ceiling, which the browser experiences as a
 * viewport that never responds (even for a pure command like `env-check` that
 * does no network work of its own). We cannot modify the spine (protected), but
 * we CAN bound the route's call to it so the pane degrades to a fast, honest
 * 503 that names the failing layer instead of a mystery 12s client abort.
 *
 * Mirrors the withTimeout pattern already used for the IC/DVN probes in
 * _lib/diagnostics.ts.
 */

import type { NextRequest } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import type { ActivePersonaContext } from '@/types/access';

export const PERSONA_TIMEOUT_MS = 6000;

export type PersonaResolution =
  | { status: 'ok'; persona: ActivePersonaContext }
  | { status: 'unauthenticated' }
  | { status: 'timeout' };

/** Message rendered by every CDE pane when identity resolution times out. */
export const PERSONA_TIMEOUT_MESSAGE =
  'identity resolution timed out — the identity spine (Supabase) did not respond from the server within 6s';

/**
 * Resolve the active persona with a hard deadline. On timeout returns
 * `{ status: 'timeout' }` (distinct from unauthenticated) so the route can emit
 * a 503 with an honest diagnostic rather than letting the request hang.
 */
export async function resolvePersonaOrTimeout(
  request: NextRequest,
  ms: number = PERSONA_TIMEOUT_MS,
): Promise<PersonaResolution> {
  const TIMEOUT = Symbol('persona-timeout');
  const raced = await Promise.race([
    getActivePersona(request).catch(() => null),
    new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), ms)),
  ]);
  if (raced === TIMEOUT) return { status: 'timeout' };
  if (!raced) return { status: 'unauthenticated' };
  return { status: 'ok', persona: raced };
}
