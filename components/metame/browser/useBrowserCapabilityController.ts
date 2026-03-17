"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AAClient,
} from "@metame/aa-client";
import type { RuntimeInboundType, ShellInboundMessage } from "@metame/iframe-bridge";

const STORAGE_KEY = "metame.browser.activeSessionId";

type UseBrowserCapabilityControllerOptions = {
  enabled: boolean;
  emitShellEvent: (type: BrowserRuntimeToShellType, payload: Record<string, unknown>) => void;
};

type BrowserRuntimeToShellType = Extract<RuntimeInboundType, `browser.${string}`>;

type BrowserErrorPayload = {
  sessionId?: string;
  message: string;
  code: string;
};

type BrowserSurfaceState = {
  shellSurfaceState?: string;
  visible?: boolean;
  focused?: boolean;
  bounds?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  [key: string]: unknown;
};

type BrowserRuntimeEvent = {
  type: BrowserRuntimeToShellType;
  payload: Record<string, unknown>;
};

type BrowserSessionResponse = {
  session: {
    sessionId: string;
    status?: string;
    [key: string]: unknown;
  };
  mountPayload?: {
    sessionId: string;
    [key: string]: unknown;
  } | null;
  surfaceState?: BrowserSurfaceState | null;
  badges?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type BrowserOpenInput = {
  intent?: string;
  url?: string;
  query?: string;
  openMode?: "open" | "search" | "research";
};

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}

function resolveTargetUrl(input: BrowserOpenInput | undefined): string | undefined {
  const directUrl = normalizeUrl(input?.url);
  if (directUrl) return directUrl;

  const query = input?.query?.trim();
  if (!query) return undefined;

  const encoded = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encoded}`;
}

function toErrorPayload(error: unknown, sessionId?: string): BrowserErrorPayload {
  return {
    sessionId,
    message: error instanceof Error ? error.message : "Unknown browser runtime error",
    code: "browser_runtime_error",
  };
}

export function useBrowserCapabilityController({ enabled, emitShellEvent }: UseBrowserCapabilityControllerOptions) {
  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const surfaceStateRef = useRef<BrowserSurfaceState | null>(null);

  const aaClient = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_AA_API_BASE_URL;
    if (!baseUrl) return null;
    return new AAClient({
      baseUrl,
      getAuthToken: () => process.env.NEXT_PUBLIC_AA_API_TOKEN ?? null,
    });
  }, []);

  const emitBrowserError = useCallback(
    (error: unknown, sessionId?: string) => {
      emitShellEvent("browser.error", toErrorPayload(error, sessionId));
    },
    [emitShellEvent]
  );

  const closeSubscription = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const consumeRuntimeEvent = useCallback(
    (event: BrowserRuntimeEvent) => {
      if (event.type === "browser.mount") {
        activeSessionIdRef.current = event.payload.sessionId;
        sessionStorage.setItem(STORAGE_KEY, event.payload.sessionId);
      }
      if (event.type === "browser.surface.state") {
        surfaceStateRef.current = event.payload;
      }
      emitShellEvent(event.type, event.payload);
    },
    [emitShellEvent]
  );

  const attachAggregate = useCallback(
    (aggregate: BrowserSessionResponse) => {
      if (aggregate.mountPayload) {
        activeSessionIdRef.current = aggregate.mountPayload.sessionId;
        sessionStorage.setItem(STORAGE_KEY, aggregate.mountPayload.sessionId);
        emitShellEvent("browser.mount", aggregate.mountPayload);
      }
      if (aggregate.surfaceState) {
        surfaceStateRef.current = aggregate.surfaceState;
        emitShellEvent("browser.surface.state", aggregate.surfaceState);
      }
      if (aggregate.badges) {
        emitShellEvent("browser.badges.update", aggregate.badges);
      }
    },
    [emitShellEvent]
  );

  const subscribe = useCallback(
    (sessionId: string) => {
      if (!aaClient) return;
      closeSubscription();
      subscriptionRef.current = aaClient.subscribeToBrowserSessionEvents(sessionId, {
        onEvent: consumeRuntimeEvent,
        onError: (error) => emitBrowserError(error, sessionId),
      });
    },
    [aaClient, closeSubscription, consumeRuntimeEvent, emitBrowserError]
  );

  const patchSurfaceState = useCallback(
    (patch: Partial<BrowserSurfaceState>) => {
      const current = surfaceStateRef.current;
      if (!current) return;
      const next = {
        ...current,
        ...patch,
      };
      surfaceStateRef.current = next;
      emitShellEvent("browser.surface.state", next);
    },
    [emitShellEvent]
  );

  const openBrowser = useCallback(
    async (input?: BrowserOpenInput) => {
      if (!aaClient) {
        emitBrowserError(new Error("AA browser client is not configured"));
        return;
      }

      try {
        let sessionId = activeSessionIdRef.current;
        let aggregate: BrowserSessionResponse | null = null;
        const targetUrl = resolveTargetUrl(input);

        if (sessionId) {
          try {
            const existing = await aaClient.getBrowserSession(sessionId);
            if (existing.session.status !== "closed") {
              aggregate = existing;
            }
          } catch {
            sessionId = null;
          }
        }

        if (!aggregate) {
          const created = await aaClient.createBrowserSession({
            intent: input?.intent,
            targetUrl,
            url: input?.url,
            query: input?.query,
            openMode: input?.openMode,
            mountMode: "overlay",
          });
          aggregate = created;
          sessionId = created.session.sessionId;
        } else if (sessionId && targetUrl) {
          aggregate = await aaClient.navigateBrowserSession(sessionId, { url: targetUrl });
        }

        if (!sessionId) {
          throw new Error("Browser session did not return a session id");
        }

        const mounted = await aaClient.mountBrowserSession(sessionId);
        attachAggregate(mounted);
        subscribe(sessionId);
      } catch (error) {
        emitBrowserError(error, activeSessionIdRef.current || undefined);
      }
    },
    [aaClient, attachAggregate, emitBrowserError, subscribe]
  );

  const closeBrowser = useCallback(
    async (sessionId: string) => {
      if (!aaClient) {
        emitBrowserError(new Error("AA browser client is not configured"), sessionId);
        return;
      }

      try {
        await aaClient.closeBrowserSession(sessionId);
        closeSubscription();
        activeSessionIdRef.current = null;
        surfaceStateRef.current = null;
        sessionStorage.removeItem(STORAGE_KEY);
        emitShellEvent("browser.unmount", { sessionId });
      } catch (error) {
        emitBrowserError(error, sessionId);
      }
    },
    [aaClient, closeSubscription, emitBrowserError, emitShellEvent]
  );

  const handleShellBridgeMessage = useCallback(
    (message: ShellInboundMessage): boolean => {
      if (!message.type.startsWith("browser.")) return false;

      const payload = message.payload || {};
      const sessionId =
        typeof payload.sessionId === "string" ? payload.sessionId : activeSessionIdRef.current || undefined;

      if (message.type === "browser.open.request") {
        void openBrowser({
          intent: typeof payload.intent === "string" ? payload.intent : undefined,
          url: typeof payload.url === "string" ? payload.url : undefined,
          query: typeof payload.query === "string" ? payload.query : undefined,
          openMode:
            payload.openMode === "open" || payload.openMode === "search" || payload.openMode === "research"
              ? payload.openMode
              : undefined,
        });
        return true;
      }

      if (message.type === "browser.close.request") {
        if (sessionId) {
          void closeBrowser(sessionId);
        }
        return true;
      }

      if (message.type === "browser.minimize.request") {
        patchSurfaceState({
          shellSurfaceState: "minimized",
          visible: true,
        });
        return true;
      }

      if (message.type === "browser.expand.request") {
        patchSurfaceState({
          shellSurfaceState: "expanded",
          visible: true,
        });
        return true;
      }

      if (message.type === "browser.focus.changed") {
        patchSurfaceState({
          focused: payload.focused === true,
        });
        return true;
      }

      if (message.type === "browser.surface.bounds.changed" && surfaceStateRef.current) {
        const nextBounds = payload.bounds;
        if (nextBounds && typeof nextBounds === "object") {
          patchSurfaceState({
            bounds: {
              x: Number((nextBounds as Record<string, unknown>).x ?? surfaceStateRef.current.bounds.x),
              y: Number((nextBounds as Record<string, unknown>).y ?? surfaceStateRef.current.bounds.y),
              width: Number((nextBounds as Record<string, unknown>).width ?? surfaceStateRef.current.bounds.width),
              height: Number((nextBounds as Record<string, unknown>).height ?? surfaceStateRef.current.bounds.height),
            },
          });
        }
        return true;
      }

      if (message.type === "browser.takeover.request" || message.type === "browser.resume.request") {
        emitBrowserError(new Error("Takeover and resume land in a later slice"), sessionId);
        return true;
      }

      return false;
    },
    [closeBrowser, emitBrowserError, openBrowser, patchSurfaceState]
  );

  useEffect(() => {
    if (!enabled || !aaClient) return;
    const storedSessionId = sessionStorage.getItem(STORAGE_KEY);
    if (!storedSessionId) return;

    let cancelled = false;
    void aaClient
      .getBrowserSession(storedSessionId)
      .then((aggregate) => {
        if (cancelled || aggregate.session.status === "closed") {
          sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
        attachAggregate(aggregate);
        subscribe(storedSessionId);
      })
      .catch(() => {
        sessionStorage.removeItem(STORAGE_KEY);
      });

    return () => {
      cancelled = true;
      closeSubscription();
    };
  }, [aaClient, attachAggregate, closeSubscription, enabled, subscribe]);

  return {
    handleShellBridgeMessage,
  };
}
