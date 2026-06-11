"use client";

/**
 * useSupabaseSessionPersonas
 *
 * Bridges the Supabase auth session to the SmartWallet persona system.
 * When a user is signed in, fetches all personas linked to their account
 * via the server-side email → crm_auth_profiles → personas resolution chain.
 *
 * The server endpoint accepts `Authorization: Bearer <access_token>` and
 * handles all the identity resolution; the hook is a thin client bridge.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";
import type { PersonaState } from "@/types/smartWallet";

const AUTH_PROFILE_STORAGE_KEYS = ["authProfileId", "agentiq_auth_profile_id"] as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getDeviceAuthProfileId(): string | null {
  if (typeof window === "undefined") return null;
  for (const key of AUTH_PROFILE_STORAGE_KEYS) {
    const v = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (v && isUuid(v.trim())) return v.trim();
  }
  return null;
}

/** Fire-and-forget: link the device localStorage UUID to the signed-in canonical profile. */
async function linkDeviceProfile(accessToken: string): Promise<void> {
  const deviceProfileId = getDeviceAuthProfileId();
  if (!deviceProfileId) return;
  try {
    await fetch("/api/wallet/identity/link-device", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ deviceProfileId }),
    });
  } catch {
    // non-fatal
  }
}

/**
 * Fire-and-forget: consolidate all UUIDs and personas associated with the
 * signed-in email into a single canonical crm_auth_profiles entry.
 * Runs on every sign-in; idempotent.
 */
async function consolidateIdentity(accessToken: string): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    await fetch("/api/wallet/identity/consolidate", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    console.warn('[useSupabaseSessionPersonas] consolidateIdentity failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

function isAgentPersona(fioHandle?: string | null, displayName?: string): boolean {
  const h = (fioHandle ?? "").toLowerCase();
  const n = (displayName ?? "").toLowerCase();
  return h.includes("aigent") || h.includes("@aigent") || n.includes("aigent") || n.includes("agent");
}

function mapToPersonaState(record: Record<string, unknown>): PersonaState {
  const fioHandle = typeof record.fioHandle === "string" ? record.fioHandle : undefined;
  const displayName = typeof record.displayName === "string" ? record.displayName : "Persona";
  const worldIdStatus = (record.worldIdStatus as string | null) ?? "unverified";

  return {
    id: String(record.id),
    displayName,
    fioHandle,
    identifiability:
      (record.defaultIdentityState as "anonymous" | "pseudo" | "semi" | "full" | null) ??
      "pseudo",
    reputationBucket: typeof record.reputationBucket === "number" ? record.reputationBucket : 0,
    reputationScore: typeof record.reputationScore === "number" ? record.reputationScore : 0,
    worldIdStatus:
      worldIdStatus === "verified_human" || worldIdStatus === "agent_declared"
        ? worldIdStatus
        : "unverified",
    isAgent: isAgentPersona(fioHandle, displayName),
    appOrigin: typeof record.appOrigin === "string" ? record.appOrigin : "",
    badges: Array.isArray(record.badges) ? (record.badges as string[]) : [],
    evmAddress: typeof record.evmAddress === "string" && /^0x[0-9a-fA-F]{40}$/.test(record.evmAddress)
      ? record.evmAddress as `0x${string}`
      : undefined,
  };
}

export interface SessionIdentity {
  sessionEmail: string | null;
  sessionPersonas: PersonaState[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{
    error: string | null;
    requiresEmailConfirmation: boolean;
  }>;
  refreshPersonas: () => Promise<void>;
}

// Bootstrap-starter helper retired (2026-05-09). FIO registration is now
// mandatory at signup, so the hook no longer auto-creates a placeholder
// persona. The PersonaSetupWizard handles the full signup → FIO chain
// register → persona row flow. See bootstrap-starter route for the legacy
// API path (retained for direct callers, no longer auto-invoked).

export function useSupabaseSessionPersonas(): SessionIdentity {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionPersonas, setSessionPersonas] = useState<PersonaState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSessionEmail(null);
    setSessionPersonas([]);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[useSupabaseSessionPersonas] signIn returned error:', error.message, error);
        return { error: error.message };
      }
      return { error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useSupabaseSessionPersonas] signIn threw:', msg, err);
      return { error: `Auth service unreachable — ${msg}` };
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null; requiresEmailConfirmation: boolean }> => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, requiresEmailConfirmation: false };
    // Supabase signals "confirmation required" via empty identities array on the
    // returned user. When confirmation is OFF (dev), session is populated and
    // onAuthStateChange will fire SIGNED_IN, triggering starter bootstrap.
    const requiresEmailConfirmation = !data.session;
    return { error: null, requiresEmailConfirmation };
  }, []);

  // Stores the current access token so refreshPersonas can re-use it without
  // requiring a new getSession() call on every persona creation.
  const accessTokenRef = useRef<string | null>(null);
  // Guards against the Supabase double-fire: getSession() resolves AND onAuthStateChange
  // immediately fires INITIAL_SESSION on mount, causing duplicate consolidate+persona calls.
  // Track the last consolidation timestamp; skip if within 10 seconds.
  const lastConsolidatedAtRef = useRef<number>(0);

  const fetchPersonas = useCallback(async (accessToken: string, force = false, sessionEmail: string | null = null) => {
    // Guard the wizard auto-open in SmartWalletDrawer: setIsLoading(true) here
    // (not just on initial mount) means every code path that triggers a refetch
    // — getSession() at mount, onAuthStateChange on sign-in/token-refresh,
    // refreshPersonas after persona create — keeps `isLoading` truthy while the
    // fetch is in flight. Without this, the drawer's auto-open effect saw a
    // brief window where sessionEmail was set and isLoading was already false
    // from a previous resolve, so allAvailablePersonas.length === 0 was briefly
    // observed and the wizard flickered open.
    setIsLoading(true);
    try {
      const now = Date.now();
      const skipConsolidate = !force && (now - lastConsolidatedAtRef.current) < 10_000;
      if (!skipConsolidate) {
        lastConsolidatedAtRef.current = now;
        // consolidate only merges email-confirmed duplicate profiles + JWT user UUID.
        // linkDeviceProfile is NOT called here — device UUID linking is 'device_session'
        // mode only and must be an explicit user action to preserve identity sovereignty.
        await consolidateIdentity(accessToken);
      }
      const personaCtrl = new AbortController();
      const personaTimer = setTimeout(() => personaCtrl.abort(), 12_000);
      const res = await fetch("/api/wallet/personas", {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: personaCtrl.signal,
      });
      clearTimeout(personaTimer);
      if (!res.ok) {
        console.warn('[useSupabaseSessionPersonas] /api/wallet/personas returned', res.status);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      // Operator decision (2026-05-09): FIO registration is mandatory at
      // signup. When a signed-in user has zero personas, we DO NOT auto-
      // create a placeholder anymore — instead the drawer auto-opens the
      // PersonaSetupWizard in mandatory mode, which generates a FIO
      // keypair and registers the handle on-chain (funded by the
      // FIO_SYSTEM_* wallet) before the persona row is finalised.
      //
      // The bootstrap-starter API endpoint is retained for direct API
      // callers but is no longer the default path. The hook signals
      // "must complete setup" via the empty list — see SessionIdentity
      // consumers in SmartWalletDrawer.
      setSessionPersonas(list.map((r: Record<string, unknown>) => mapToPersonaState(r)));
    } catch {
      // non-fatal — wallet still works without session personas
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshPersonas = useCallback(async () => {
    if (!accessTokenRef.current) return;
    await fetchPersonas(accessTokenRef.current, true);
  }, [fetchPersonas]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Bootstrap from current session. fetchPersonas owns the isLoading
    // lifecycle now — keep this branch lean and only flip loading false when
    // there is no session at all.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        accessTokenRef.current = session.access_token;
        setSessionEmail(session.user.email);
        fetchPersonas(session.access_token, false, session.user.email);
      } else {
        setIsLoading(false);
      }
    });

    // React to auth state changes (sign-in, sign-out, token refresh).
    // INITIAL_SESSION fires immediately on subscribe and overlaps with getSession();
    // the 10s dedup in fetchPersonas prevents a double consolidate+fetch on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        accessTokenRef.current = session.access_token;
        setSessionEmail(session.user.email);
        fetchPersonas(session.access_token, false, session.user.email);
      } else {
        accessTokenRef.current = null;
        setSessionEmail(null);
        setSessionPersonas([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchPersonas]);

  return { sessionEmail, sessionPersonas, isLoading, signOut, signIn, signUp, refreshPersonas };
}
