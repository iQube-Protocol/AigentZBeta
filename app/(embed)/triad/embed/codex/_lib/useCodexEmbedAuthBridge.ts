"use client";

import { useEffect, useMemo, useState } from "react";
import embedPolicy from "@/configs/embed/policy.v1.json";

const AUTH_PROFILE_STORAGE_KEYS = [
  "authProfileId",
  "agentiq_auth_profile_id",
] as const;

const PERSONA_STORAGE_KEYS = [
  "currentPersonaId",
  "activePersonaId",
] as const;

type AuthBridgeMessage = {
  type?: string;
  personaId?: string;
  authProfileId?: string;
  isAdmin?: boolean;
  payload?: {
    personaId?: string;
    authProfileId?: string;
    isAdmin?: boolean;
  };
};

function normalizeOriginPattern(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function parseAllowedOrigins(): string[] {
  const configured = (process.env.NEXT_PUBLIC_EMBED_AUTH_ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOriginPattern)
    .filter(Boolean);
  const defaults = (embedPolicy.authAllowedOrigins || []).map(normalizeOriginPattern);
  return Array.from(new Set([...defaults, ...configured]));
}

function firstStoredValue(keys: readonly string[]): string | undefined {
  if (typeof window === "undefined") return undefined;
  for (const key of keys) {
    try {
      const localValue = window.localStorage.getItem(key);
      if (localValue && localValue.trim().length > 0) return localValue.trim();
    } catch { /* storage blocked (e.g. Brave strict mode) */ }
    try {
      const sessionValue = window.sessionStorage.getItem(key);
      if (sessionValue && sessionValue.trim().length > 0) return sessionValue.trim();
    } catch { /* storage blocked */ }
  }
  return undefined;
}

function persistValue(keys: readonly string[], value?: string) {
  if (typeof window === "undefined" || !value) return;
  for (const key of keys) {
    try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
    try { window.sessionStorage.setItem(key, value); } catch { /* ignore */ }
  }
}

function sanitizeValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function matchesSubdomainWildcard(origin: string, pattern: string): boolean {
  const wildcard = pattern.match(/^(https?):\/\/\*\.(.+)$/i);
  if (!wildcard) return false;
  try {
    const originUrl = new URL(origin);
    const protocol = `${wildcard[1].toLowerCase()}:`;
    const suffix = wildcard[2].toLowerCase();
    if (originUrl.protocol.toLowerCase() !== protocol) return false;
    const host = originUrl.hostname.toLowerCase();
    return host === suffix || host.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

function matchesPortWildcard(origin: string, pattern: string): boolean {
  const wildcard = pattern.match(/^(https?):\/\/([^:/?#]+):\*$/i);
  if (!wildcard) return false;
  try {
    const originUrl = new URL(origin);
    const protocol = `${wildcard[1].toLowerCase()}:`;
    const host = wildcard[2].toLowerCase();
    return originUrl.protocol.toLowerCase() === protocol && originUrl.hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string, allowedOrigins: string[]) {
  if (allowedOrigins.length === 0) return true;
  const normalizedOrigin = normalizeOriginPattern(origin);
  return allowedOrigins.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern === normalizedOrigin) return true;
    if (pattern.includes("*.")) return matchesSubdomainWildcard(normalizedOrigin, pattern);
    if (pattern.endsWith(":*")) return matchesPortWildcard(normalizedOrigin, pattern);
    return false;
  });
}

async function resolvePersonaFromAuthProfile(authProfileId: string): Promise<string | undefined> {
  try {
    const response = await fetch(
      `/api/wallet/personas?authProfileId=${encodeURIComponent(authProfileId)}`,
      {
        headers: {
          "x-auth-profile-id": authProfileId,
        },
      }
    );

    if (!response.ok) return undefined;

    const json = await response.json();
    const personas = Array.isArray(json)
      ? json
      : Array.isArray(json?.personas)
        ? json.personas
        : [];

    const firstPersonaId = sanitizeValue(personas[0]?.id);
    if (firstPersonaId) {
      persistValue(PERSONA_STORAGE_KEYS, firstPersonaId);
      return firstPersonaId;
    }
  } catch (error) {
    console.error("[CodexEmbedAuthBridge] Failed to resolve persona from auth profile:", error);
  }

  return undefined;
}

type UseCodexEmbedAuthBridgeResult = {
  personaId?: string;
  authProfileId?: string;
  isAdmin?: boolean;
};

type UseCodexEmbedAuthBridgeOptions = {
  initialPersonaId?: string;
  initialAuthProfileId?: string;
  initialIsAdmin?: boolean;
};

type UseCodexEmbedAuthBridgeInput = string | UseCodexEmbedAuthBridgeOptions | undefined;

function normalizeInput(input: UseCodexEmbedAuthBridgeInput): UseCodexEmbedAuthBridgeOptions {
  if (typeof input === "string") {
    return { initialPersonaId: input };
  }
  return input || {};
}

function sanitizeBool(value: unknown): boolean | undefined {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return undefined;
}

export function useCodexEmbedAuthBridge(
  input?: UseCodexEmbedAuthBridgeInput
): UseCodexEmbedAuthBridgeResult {
  const { initialPersonaId, initialAuthProfileId, initialIsAdmin } = normalizeInput(input);
  // Lazy initializer: prefer the URL-provided persona, otherwise fall back
  // to whatever the host shell already wrote to localStorage. firstStoredValue
  // returns undefined on the server (typeof window === "undefined"), so the
  // server render and the very first client render still match — but every
  // subsequent client render after hydration sees the persisted value
  // immediately, eliminating the "personaId undefined on first paint" window
  // that hid KnytRemixButton, gated PDF downloads, etc.
  const [personaId, setPersonaId] = useState<string | undefined>(
    () => sanitizeValue(initialPersonaId) || firstStoredValue(PERSONA_STORAGE_KEYS)
  );
  const [authProfileId, setAuthProfileId] = useState<string | undefined>(
    () => sanitizeValue(initialAuthProfileId) || firstStoredValue(AUTH_PROFILE_STORAGE_KEYS)
  );
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(initialIsAdmin);
  const allowedOrigins = useMemo(() => parseAllowedOrigins(), []);

  useEffect(() => {
    const nextPersonaId = sanitizeValue(initialPersonaId);
    if (!nextPersonaId) return;
    setPersonaId((prev) => prev || nextPersonaId);
  }, [initialPersonaId]);

  useEffect(() => {
    const nextAuthProfileId = sanitizeValue(initialAuthProfileId);
    if (!nextAuthProfileId) return;
    persistValue(AUTH_PROFILE_STORAGE_KEYS, nextAuthProfileId);
    setAuthProfileId((prev) => prev || nextAuthProfileId);
  }, [initialAuthProfileId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedAuthProfileId = firstStoredValue(AUTH_PROFILE_STORAGE_KEYS);
    const storedPersonaId = firstStoredValue(PERSONA_STORAGE_KEYS);

    if (storedAuthProfileId) setAuthProfileId((prev) => prev || storedAuthProfileId);
    if (!personaId && storedPersonaId) setPersonaId(storedPersonaId);
  }, [personaId]);

  // Cross-surface persona sync: PersonaContext writes currentPersonaId and
  // dispatches a StorageEvent so embeds (and same-document hooks) react without
  // a page reload.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "currentPersonaId" || !e.newValue) return;
      const incoming = sanitizeValue(e.newValue);
      if (!incoming || incoming === personaId) return;
      persistValue(PERSONA_STORAGE_KEYS, incoming);
      setPersonaId(incoming);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [personaId]);

  useEffect(() => {
    if (personaId || !authProfileId) return;

    let cancelled = false;
    resolvePersonaFromAuthProfile(authProfileId).then((resolvedPersonaId) => {
      if (cancelled || !resolvedPersonaId) return;
      setPersonaId(resolvedPersonaId);
    });

    return () => {
      cancelled = true;
    };
  }, [personaId, authProfileId]);

  // Auto-detect admin status authoritatively via the spine endpoint.
  //
  // Earlier versions of this hook tried to fetch /api/codex/admin-check
  // with personaId-as-email — but personaId is a UUID, not an email, so
  // the fetch never fired and isAdmin stayed undefined. Result: in the
  // KNYT cartridge embed, admin-gated tabs were dark even when the user
  // was signed in as an admin and had selected their admin persona at
  // the parent shell.
  //
  // The spine endpoint /api/wallet/active-persona returns
  // cartridgeFlags.isAdmin authoritatively from the server-side
  // resolver (services/identity/getActivePersona.ts). It uses the
  // already-canonicalised authProfileId + every multi-email-merged
  // linked profile + a fallback via crm_auth_profile_emails alias
  // table. This is the single source of truth for 'is this caller
  // an admin' regardless of which persona is active — no email-
  // string heuristics, no UUID parsing.
  //
  // Re-runs whenever personaId changes (i.e. the parent shell
  // broadcasts aa-persona-change-v1 or the embed boots fresh).
  // Bearer token is the standard supabase-js access token from
  // localStorage; without it the endpoint returns 401 and we leave
  // isAdmin undefined (treated as false by every consumer).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!personaId) return;

    let cancelled = false;

    // Read JWT from localStorage directly — avoid getSession()'s refresh-
    // token chatter that would emit AuthApiError on signed-out callers.
    let jwt = '';
    try {
      const k = Object.keys(window.localStorage).find(
        (x) => x.startsWith('sb-') && x.endsWith('-auth-token'),
      );
      if (k) {
        const raw = window.localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw) as
            | { access_token?: string; currentSession?: { access_token?: string } }
            | null;
          jwt = parsed?.access_token ?? parsed?.currentSession?.access_token ?? '';
        }
      }
    } catch { /* unauthenticated browsing */ }

    if (!jwt) return; // no auth → cannot resolve flags; leave undefined

    fetch('/api/wallet/active-persona', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.cartridgeFlags?.isAdmin === 'boolean') {
          setIsAdmin(data.cartridgeFlags.isAdmin);
        }
      })
      .catch(() => { /* non-fatal */ });

    return () => { cancelled = true; };
  }, [personaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sendReadySignal = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "aa-auth-context-ready-v1" }, "*");
      }
    };

    const handleMessage = async (event: MessageEvent<AuthBridgeMessage>) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || typeof message !== "object" || !message.type) return;

      if (!isOriginAllowed(event.origin, allowedOrigins)) {
        if (message.type === "aa-auth-context-v1") {
          window.parent.postMessage(
            {
              type: "aa-auth-context-ack-v1",
              accepted: false,
              reason: "origin_not_allowed",
            },
            event.origin
          );
        }
        return;
      }

      // Shell broadcast: persona switched in the wallet drawer or PersonaContext.
      // Update local state so the active codex tab re-renders with the new persona.
      if (message.type === "aa-persona-change-v1") {
        const incoming = sanitizeValue(message.personaId);
        if (incoming && incoming !== personaId) {
          persistValue(PERSONA_STORAGE_KEYS, incoming);
          setPersonaId(incoming);
        }
        return;
      }

      if (message.type === "aa-auth-context-request-v1") {
        window.parent.postMessage(
          {
            type: "aa-auth-context-state-v1",
            personaId: personaId || firstStoredValue(PERSONA_STORAGE_KEYS) || null,
            authProfileId: authProfileId || firstStoredValue(AUTH_PROFILE_STORAGE_KEYS) || null,
          },
          event.origin
        );
        return;
      }

      if (message.type !== "aa-auth-context-v1") return;

      const payload = typeof message.payload === "object" && message.payload ? message.payload : message;
      const incomingAuthProfileId = sanitizeValue(payload.authProfileId);
      let incomingPersonaId = sanitizeValue(payload.personaId);
      const incomingIsAdmin = sanitizeBool(payload.isAdmin);

      if (incomingAuthProfileId) {
        persistValue(AUTH_PROFILE_STORAGE_KEYS, incomingAuthProfileId);
        setAuthProfileId(incomingAuthProfileId);
      }

      if (!incomingPersonaId && incomingAuthProfileId) {
        incomingPersonaId = await resolvePersonaFromAuthProfile(incomingAuthProfileId);
      }

      if (incomingPersonaId) {
        persistValue(PERSONA_STORAGE_KEYS, incomingPersonaId);
        setPersonaId(incomingPersonaId);
      }

      if (incomingIsAdmin !== undefined) {
        setIsAdmin(incomingIsAdmin);
      }

      window.parent.postMessage(
        {
          type: "aa-auth-context-ack-v1",
          accepted: true,
          personaId: incomingPersonaId || personaId || firstStoredValue(PERSONA_STORAGE_KEYS) || null,
          authProfileId:
            incomingAuthProfileId ||
            authProfileId ||
            firstStoredValue(AUTH_PROFILE_STORAGE_KEYS) ||
            null,
        },
        event.origin
      );
    };

    window.addEventListener("message", handleMessage);
    sendReadySignal();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [allowedOrigins, authProfileId, personaId]);

  return { personaId, authProfileId, isAdmin };
}
