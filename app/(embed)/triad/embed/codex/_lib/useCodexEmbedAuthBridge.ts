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
    const localValue = window.localStorage.getItem(key);
    if (localValue && localValue.trim().length > 0) return localValue.trim();

    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue && sessionValue.trim().length > 0) return sessionValue.trim();
  }
  return undefined;
}

function persistValue(keys: readonly string[], value?: string) {
  if (typeof window === "undefined" || !value) return;
  for (const key of keys) {
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(key, value);
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
  const [personaId, setPersonaId] = useState<string | undefined>(sanitizeValue(initialPersonaId));
  const [authProfileId, setAuthProfileId] = useState<string | undefined>();
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

  // Auto-detect admin status via the platform admin-check API when no explicit
  // isAdmin signal was received from the parent (postMessage or query param).
  // personaId may be an email (e.g. dele@metame.com) — the API accepts either.
  useEffect(() => {
    if (isAdmin !== undefined) return; // already resolved
    if (!personaId) return;
    // Only query if personaId looks like an email (the admin-check API uses email)
    if (!personaId.includes('@')) return;

    let cancelled = false;
    fetch(`/api/codex/admin-check?email=${encodeURIComponent(personaId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data?.isAdmin === 'boolean') {
          setIsAdmin(data.isAdmin);
        }
      })
      .catch(() => { /* non-fatal — isAdmin stays undefined (treated as false) */ });

    return () => { cancelled = true; };
  }, [personaId, isAdmin]);

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
