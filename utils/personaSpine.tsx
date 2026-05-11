'use client';
/**
 * PersonaSpine — canonical client-side protocol for persona-bound auth.
 *
 * The persona slice of the broader identity spine. Every browser surface
 * (tab, sub-tab, drawer, chip, capsule, ExperienceQube, iQube card, modal,
 * sidebar) accesses persona identity, auth-bearer, and spine-bound fetches
 * through this single module. Server-side resolution stays in
 * `services/identity/getActivePersona.ts` — this module is the consumer-side
 * companion.
 *
 * Privacy contract (per types/access.ts):
 *   - Exposes T1 only (personaSessionToken, displayLabel, identifiability,
 *     cartridgeFlags, cohortMemberships, sessionExpiresAt).
 *   - Never returns T0 (personaId, authProfileId, rootDid, kybeAttestation,
 *     cross-persona fioHandle).
 *
 * Composition (extends, does not replace):
 *   - utils/supabaseBrowser.ts → getSupabaseAccessToken / authedFetchHeaders
 *   - app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts →
 *     URL/postMessage/storage → personaId hint that feeds this module
 *   - /api/wallet/active-persona → server source of truth for T1 surface
 *
 * See docs/architecture/persona-spine-client-protocol.md for the spec and
 * the adoption checklist that governs every surface migration.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import {
  getSupabaseAccessToken,
  getSupabaseBrowserClient,
} from '@/utils/supabaseBrowser';
import type {
  ActivePersonaSurface,
  Identifiability,
} from '@/types/access';

// ─────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────

export type PersonaSpineStatus =
  | 'idle'             // not requested yet
  | 'loading'          // first fetch in flight
  | 'ready'            // surface populated
  | 'refreshing'      // ready + silent refetch in flight
  | 'unauthenticated' // no Supabase session OR /active-persona returned 401
  | 'error';           // network / server / token-issuance failure

export interface PersonaSpineState {
  status: PersonaSpineStatus;

  /** T1 — the only persona handle that may touch the wire. */
  personaSessionToken: string | null;

  /** Cosmetic display label. Never derived from personaId or fioHandle. */
  displayLabel: string | null;

  /** Privacy floor — semi_anonymous unless the persona row says otherwise. */
  identifiability: Identifiability | null;

  /** Cartridge-role flags (server-resolved; URL params never bypass these). */
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };

  /** Cohort group ids — T1-safe (identifies the group, not the member). */
  cohortMemberships: string[];

  /** ISO-8601 expiry; surface refreshes silently 60s before. */
  sessionExpiresAt: string | null;

  /** Diagnostic string when status === 'error'. */
  error: string | null;

  /** Force a refresh. No-op while loading. */
  refresh: () => Promise<void>;
}

export interface PersonaSpineOptions {
  /**
   * Optional personaId from the codex embed bridge (URL / postMessage /
   * localStorage). Spine remains authoritative; the hint only helps the
   * server pick the right persona when the caller owns several.
   */
  personaIdHint?: string;

  /**
   * If true and the spine resolves to unauthenticated, the hook calls
   * Supabase signOut() to clear any stale session before reporting state.
   * Default false — most surfaces want to render a sign-in prompt instead.
   */
  signOutOnUnauthenticated?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Module-level singleton store
//
// One in-flight request per browser tab. Both `usePersonaSpine` (React) and
// `readPersonaSurface` / `personaFetch` (imperative) hit this same store —
// no parallel fetches, no race between hook consumers and bare fetches.
// ─────────────────────────────────────────────────────────────────────────

interface InternalState {
  status: PersonaSpineStatus;
  surface: ActivePersonaSurface | null;
  error: string | null;
  /** Hint last used; refetch when it changes. */
  lastHint: string | undefined;
  /** Single in-flight promise to dedupe concurrent calls. */
  inflight: Promise<void> | null;
}

const initialState: InternalState = {
  status: 'idle',
  surface: null,
  error: null,
  lastHint: undefined,
  inflight: null,
};

let store: InternalState = { ...initialState };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function setStore(patch: Partial<InternalState>) {
  store = { ...store, ...patch };
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): InternalState {
  return store;
}

// SSR: deterministic empty state so React hydration doesn't trip.
const ssrSnapshot: InternalState = { ...initialState };
function getServerSnapshot(): InternalState {
  return ssrSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────
// Refresh scheduling — silent re-issue ≥60s before token expiry.
// ─────────────────────────────────────────────────────────────────────────

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(expiresAtIso: string | null | undefined) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (!expiresAtIso) return;
  const expiresMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresMs)) return;
  const refreshAt = expiresMs - 60_000;
  const delay = Math.max(refreshAt - Date.now(), 5_000);
  refreshTimer = setTimeout(() => {
    void doFetch({ silent: true });
  }, delay);
}

// ─────────────────────────────────────────────────────────────────────────
// Core fetch — dedupes, attaches Bearer, normalises errors.
// ─────────────────────────────────────────────────────────────────────────

async function doFetch(opts?: { silent?: boolean; hint?: string }): Promise<void> {
  // Single-flight: if a fetch is in progress, reuse its promise.
  if (store.inflight) {
    return store.inflight;
  }

  const hint = opts?.hint ?? store.lastHint;
  const silent = !!opts?.silent;

  const nextStatus: PersonaSpineStatus =
    silent && store.status === 'ready' ? 'refreshing' : 'loading';

  setStore({ status: nextStatus, error: null, lastHint: hint });

  const promise = (async () => {
    try {
      const token = await getSupabaseAccessToken();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const url = hint
        ? `/api/wallet/active-persona?personaId=${encodeURIComponent(hint)}`
        : '/api/wallet/active-persona';

      const res = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });

      if (res.status === 401) {
        setStore({ status: 'unauthenticated', surface: null, error: null });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        const msg = (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string')
          ? body.error
          : `active-persona failed (${res.status})`;
        setStore({ status: 'error', error: msg });
        return;
      }

      const surface = (await res.json()) as ActivePersonaSurface;
      setStore({ status: 'ready', surface, error: null });
      scheduleRefresh(surface.sessionExpiresAt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStore({ status: 'error', error: msg });
    } finally {
      setStore({ inflight: null });
    }
  })();

  setStore({ inflight: promise });
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────
// Invalidation triggers — set up once per browser tab.
// ─────────────────────────────────────────────────────────────────────────

let triggersWired = false;
const PERSONA_CHANGE_EVENT = 'aa-persona-change-v1';

function wireInvalidationTriggers() {
  if (triggersWired || typeof window === 'undefined') return;
  triggersWired = true;

  // (a) postMessage broadcast from the embed bridge / persona switcher
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string } | null | undefined;
    if (data && typeof data === 'object' && data.type === PERSONA_CHANGE_EVENT) {
      void doFetch({ hint: undefined });
    }
  });

  // (b) Supabase auth state changes — sign-in, sign-out, token refresh
  try {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        setStore({
          status: 'unauthenticated',
          surface: null,
          error: null,
          lastHint: undefined,
        });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void doFetch();
      }
    });
  } catch {
    /* Supabase client unavailable — fall through, fetch on demand */
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Imperative API — for non-React callers (modal init, drawer constructors,
// imperative services that don't run inside the React tree).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns the current T1 surface, fetching once if uninitialised.
 * Null when unauthenticated or on error.
 */
export async function readPersonaSurface(opts?: {
  personaIdHint?: string;
}): Promise<ActivePersonaSurface | null> {
  wireInvalidationTriggers();
  const hint = opts?.personaIdHint;
  if (store.status === 'idle' || (hint && hint !== store.lastHint)) {
    await doFetch({ hint });
  } else if (store.inflight) {
    await store.inflight;
  }
  return store.surface;
}

/**
 * Canonical authenticated fetch. Drop-in `fetch()` replacement for any
 * client→/api/* call that needs to surface as the active persona's caller.
 *
 *  - Sends `Authorization: Bearer <supabase-jwt>` (when available)
 *  - Sends `credentials: 'include'` so same-origin cookies flow
 *  - Optionally appends `?personaId=<hint>` for multi-persona disambiguation
 *  - Does NOT auto-attach the PST as a header — the server resolves identity
 *    via `getActivePersona(request)` which already accepts PST via cookie/
 *    `?pst=`. Surfaces that want to pin a specific PST must pass it via
 *    `init.headers` explicitly. Phase 2+ may add a `pst:` option here.
 */
export async function personaFetch(
  input: RequestInfo | URL,
  init: RequestInit & { personaIdHint?: string } = {},
): Promise<Response> {
  wireInvalidationTriggers();

  const { personaIdHint, headers: initHeaders, ...rest } = init;
  const token = await getSupabaseAccessToken();

  const headers = new Headers(initHeaders ?? {});
  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Append the personaId hint to the URL when caller provided one and the
  // URL didn't already carry it. We never overwrite an explicit ?personaId=.
  let finalInput: RequestInfo | URL = input;
  if (personaIdHint && typeof input === 'string') {
    try {
      const url = new URL(input, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (!url.searchParams.has('personaId')) {
        url.searchParams.set('personaId', personaIdHint);
        // Preserve relative URLs — strip origin if input was relative.
        finalInput = input.startsWith('/')
          ? `${url.pathname}${url.search}${url.hash}`
          : url.toString();
      }
    } catch {
      /* leave URL untouched on parse failure */
    }
  }

  return fetch(finalInput, {
    ...rest,
    headers,
    credentials: rest.credentials ?? 'include',
  });
}

/** Manually trigger a re-fetch. Useful after a persona switch UI action. */
export async function refreshPersonaSpine(): Promise<void> {
  await doFetch();
}

/** Broadcast a persona-change event — for surfaces that own the switch UI. */
export function broadcastPersonaChange(personaId?: string): void {
  if (typeof window === 'undefined') return;
  window.postMessage({ type: PERSONA_CHANGE_EVENT, personaId }, window.location.origin);
}

// ─────────────────────────────────────────────────────────────────────────
// React hook — the canonical consumer-side API.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The one hook every surface uses to access the active persona's T1 surface.
 *
 * Behaviour:
 *   - On first mount: triggers a fetch (deduped across simultaneous mounts).
 *   - Re-fetches when `personaIdHint` changes.
 *   - Re-renders on postMessage 'aa-persona-change-v1', Supabase auth events,
 *     and silent TTL refresh.
 *   - Returns the same singleton state to every caller — no fan-out fetches.
 *
 * Use it in any surface: tab, sub-tab, drawer, chip, capsule, ExperienceQube
 * card, iQube viewer, modal. For consequential `/api/*` calls, prefer
 * `personaFetch()` over hand-rolling `Authorization`.
 */
export function usePersonaSpine(opts: PersonaSpineOptions = {}): PersonaSpineState {
  const { personaIdHint, signOutOnUnauthenticated = false } = opts;

  // Subscribe to the singleton store via React's official primitive.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // First mount + hint change → kick off a fetch. doFetch dedupes internally.
  useEffect(() => {
    wireInvalidationTriggers();
    if (
      snapshot.status === 'idle' ||
      (personaIdHint && personaIdHint !== snapshot.lastHint)
    ) {
      void doFetch({ hint: personaIdHint });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaIdHint]);

  // Optional auto-sign-out for surfaces that should hard-bounce on auth loss.
  useEffect(() => {
    if (!signOutOnUnauthenticated) return;
    if (snapshot.status !== 'unauthenticated') return;
    try {
      void getSupabaseBrowserClient().auth.signOut();
    } catch {
      /* non-fatal */
    }
  }, [snapshot.status, signOutOnUnauthenticated]);

  const surface = snapshot.surface;

  return {
    status: snapshot.status,
    personaSessionToken: surface?.personaSessionToken ?? null,
    displayLabel: surface?.displayLabel ?? null,
    identifiability: surface?.identifiability ?? null,
    cartridgeFlags: surface?.cartridgeFlags ?? { isAdmin: false, isPartner: false },
    cohortMemberships: surface?.cohortMemberships ?? [],
    sessionExpiresAt: surface?.sessionExpiresAt ?? null,
    error: snapshot.error,
    refresh: refreshPersonaSpine,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PersonaSpineGate — the canonical render-state gate.
//
// Most surfaces have the same five-state UX:
//   idle/loading   → spinner
//   refreshing     → render ready children (silent refresh)
//   unauthenticated → "sign in" fallback
//   error          → diagnostic with retry
//   ready          → children
//
// Surfaces should NOT each re-implement that switch. Pass the state from
// `usePersonaSpine` and the gate handles the boilerplate. The PRD §13
// permission-state copy can be layered on top via `unauthenticatedFallback`.
// ─────────────────────────────────────────────────────────────────────────

export interface PersonaSpineGateProps {
  state: PersonaSpineState;
  children: ReactNode;
  /** Override the loading view (spinner by default). */
  loadingFallback?: ReactNode;
  /** Override the unauth view (sign-in prompt by default). */
  unauthenticatedFallback?: ReactNode;
  /** Override the error view (diagnostic + retry by default). */
  errorFallback?: (error: string, retry: () => Promise<void>) => ReactNode;
}

export function PersonaSpineGate({
  state,
  children,
  loadingFallback,
  unauthenticatedFallback,
  errorFallback,
}: PersonaSpineGateProps): ReactNode {
  if (state.status === 'ready' || state.status === 'refreshing') {
    return children;
  }
  if (state.status === 'unauthenticated') {
    return (
      unauthenticatedFallback ?? (
        <div className="p-6 text-sm text-slate-400">
          Sign in with an active persona to continue.
        </div>
      )
    );
  }
  if (state.status === 'error') {
    return (
      errorFallback?.(state.error ?? 'unknown error', state.refresh) ?? (
        <div className="p-6 text-sm">
          <p className="text-amber-400 mb-2">
            Could not load persona context: {state.error ?? 'unknown error'}
          </p>
          <button
            onClick={() => void state.refresh()}
            className="px-3 py-1 rounded border border-slate-700 hover:border-violet-500/60"
          >
            Retry
          </button>
        </div>
      )
    );
  }
  // idle | loading
  return (
    loadingFallback ?? (
      <div className="p-6 text-sm text-slate-400">Loading persona context…</div>
    )
  );
}
