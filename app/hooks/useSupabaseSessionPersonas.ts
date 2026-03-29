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

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type { PersonaState } from "@/types/smartWallet";

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key);
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
  };
}

export interface SessionIdentity {
  sessionEmail: string | null;
  sessionPersonas: PersonaState[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
}

export function useSupabaseSessionPersonas(): SessionIdentity {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionPersonas, setSessionPersonas] = useState<PersonaState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPersonas = useCallback(async (accessToken: string) => {
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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Bootstrap from current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setSessionEmail(session.user.email);
        fetchPersonas(session.access_token).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // React to auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setSessionEmail(session.user.email);
        fetchPersonas(session.access_token);
      } else {
        setSessionEmail(null);
        setSessionPersonas([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchPersonas]);

  return { sessionEmail, sessionPersonas, isLoading, signOut, signIn };
}
