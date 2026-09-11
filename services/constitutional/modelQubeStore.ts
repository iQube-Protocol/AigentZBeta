/**
 * ModelQube store — the DB-backed half of the ModelQube registry (CFS-015
 * Strand Two). Merges operator-declared model choices (operator_model_qubes)
 * with the in-code seed so they actually participate in LIVE routing, closing
 * the "captured but not routed" honest limit.
 *
 * Why a separate module: modelQube.ts is PURE (no DB, no clock, no network) and
 * must stay that way (it's isomorphic, imported client-side). This module owns
 * the impure part — the Supabase read, the process.env key-presence check, and
 * the in-memory cache — and composes the pure seed + pure `operatorModelToQube`
 * mapper. The router hydrates this cache (async) before reading the merged set
 * (sync), so `resolveModelQubeRoute` stays synchronous.
 *
 * Fail-open: if no DB is configured or a read fails, the store returns the
 * seed-only set — routing never breaks because an operator table is absent.
 *
 * Server-only.
 */

import { createClient } from '@supabase/supabase-js';
import {
  CONSTITUTIONAL_MODEL_QUBES,
  operatorModelToQube,
  type ModelQube,
  type OperatorModelDeclaration,
} from '@/services/constitutional/modelQube';
import { ROUTABLE_PROVIDER_IDS } from '@/types/constitutional';
import type { SovereigntyTier } from '@/services/constitutional/modelQube';

// In-memory cache of operator-declared qubes + a TTL so a hot path doesn't read
// the DB on every route. Reset only on process restart (Lambda cold start).
let operatorQubes: ModelQube[] = [];
let lastHydrated = 0;
const HYDRATE_TTL_MS = 60_000;

/** Lazy client — built only when needed, so importing the store requires no env
 *  (the seed-only path works at build time / in the sandbox). */
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface OperatorRow {
  id: string;
  provider: string;
  model: string;
  key_env: string;
  tier: string;
}

/**
 * Refresh the operator-declared qube cache from the DB (TTL-throttled). Reads
 * process.env to resolve each row's key presence (the impure step the pure
 * mapper can't do), then maps rows → ModelQubes. Fail-open: on no-DB or a read
 * error the prior cache is kept (or stays empty), never throwing into routing.
 */
export async function hydrateModelQubes(force = false): Promise<void> {
  if (!force && Date.now() - lastHydrated < HYDRATE_TTL_MS) return;
  lastHydrated = Date.now(); // set early — a concurrent caller won't re-stampede
  const client = getClient();
  if (!client) return; // seed-only
  try {
    const { data, error } = await client
      .from('operator_model_qubes')
      .select('id,provider,model,key_env,tier');
    if (error || !Array.isArray(data)) return;
    operatorQubes = (data as OperatorRow[]).map((r) => {
      const decl: OperatorModelDeclaration = {
        id: r.id,
        provider: r.provider,
        model: r.model,
        keyEnvPresent: Boolean(process.env[r.key_env]),
        tier: (r.tier as SovereigntyTier) ?? 'frontier',
      };
      return operatorModelToQube(decl, ROUTABLE_PROVIDER_IDS);
    });
  } catch {
    // keep the prior cache — a transient DB error must not break routing
  }
}

/**
 * The ACTIVE ModelQube set the router ranks over: the in-code seed plus the
 * hydrated operator-declared qubes. Synchronous (reads the cache) so
 * `resolveModelQubeRoute` / `routeFor` stay sync; call `hydrateModelQubes()`
 * first to freshen the cache.
 */
export function getActiveModelQubes(): ModelQube[] {
  return [...CONSTITUTIONAL_MODEL_QUBES, ...operatorQubes];
}
