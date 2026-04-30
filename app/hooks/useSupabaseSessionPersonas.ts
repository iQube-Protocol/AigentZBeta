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
    await fetch("/api/wallet/identity/consolidate", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // non-fatal
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
  refreshPersonas: () => Promise<void>;
}

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
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  // Stores the current access token so refreshPersonas can re-use it without
  // requiring a new getSession() call on every persona creation.
  const accessTokenRef = useRef<string | null>(null);
  // Guards against the Supabase double-fire: getSession() resolves AND onAuthStateChange
  // immediately fires INITIAL_SESSION on mount, causing duplicate consolidate+persona calls.
  // Track the last consolidation timestamp; skip if within 10 seconds.
  const lastConsolidatedAtRef = useRef<number>(0);

  const fetchPersonas = useCallback(async (accessToken: string, force = false) => {
    const now = Date.now();
    const skipConsolidate = !force && (now - lastConsolidatedAtRef.current) < 10_000;
    if (!skipConsolidate) {
      lastConsolidatedAtRef.current = now;
      // consolidate only merges email-confirmed duplicate profiles + JWT user UUID.
      // linkDeviceProfile is NOT called here — device UUID linking is 'device_session'
      // mode only and must be an explicit user action to preserve identity sovereignty.
      await consolidateIdentity(accessToken);
    }
    try {
      const res = await fetch("/api/wallet/personas", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setSessionPersonas(list.map((r: Record<string, unknown>) => mapToPersonaState(r)));
    } catch {
      // non-fatal — wallet still works without session personas
    }
  }, []);

  const refreshPersonas = useCallback(async () => {
    if (!accessTokenRef.current) return;
    await fetchPersonas(accessTokenRef.current, true);
  }, [fetchPersonas]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Bootstrap from current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        accessTokenRef.current = session.access_token;
        setSessionEmail(session.user.email);
        fetchPersonas(session.access_token).finally(() => setIsLoading(false));
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
        fetchPersonas(session.access_token);
      } else {
        accessTokenRef.current = null;
        setSessionEmail(null);
        setSessionPersonas([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchPersonas]);

  return { sessionEmail, sessionPersonas, isLoading, signOut, signIn, refreshPersonas };
}
