"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  AAClient,
} from "@metame/aa-client";
import type {
  BrowserActionStatus,
  BrowserDrawerDataPayload,
  BrowserErrorPayload,
  BrowserRuntimeEvent,
  BrowserSessionResponse,
  BrowserSurfaceState,
  SurfaceBounds,
} from "@metame/browser-contracts";
import type { ShellInboundMessage } from "@metame/iframe-bridge";

const STORAGE_KEY = "metame.browser.activeSessionId";
const AA_CONFIG_STORAGE_KEY = "metame.browser.aaClientConfig";

type RuntimeAaConfig = {
  baseUrl: string;
  token: string | null;
};

declare global {
  interface Window {
    __METAME_RUNTIME_AA_CONFIG__?: RuntimeAaConfig;
  }
}

type UseBrowserCapabilityControllerOptions = {
  enabled: boolean;
  emitShellEvent: (type: BrowserRuntimeToShellType, payload: Record<string, unknown>) => void;
};

type BrowserRuntimeToShellType = BrowserRuntimeEvent["type"];

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

function toSurfaceBounds(
  bounds: Record<string, unknown>,
  fallback: SurfaceBounds
): SurfaceBounds {
  return {
    x: Number(bounds.x ?? fallback.x),
    y: Number(bounds.y ?? fallback.y),
    width: Number(bounds.width ?? fallback.width),
    height: Number(bounds.height ?? fallback.height),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRuntimeAaConfig(): RuntimeAaConfig | null {
  if (typeof window === "undefined") return null;

  const fromWindow = window.__METAME_RUNTIME_AA_CONFIG__;
  if (fromWindow?.baseUrl) {
    return {
      baseUrl: fromWindow.baseUrl,
      token: fromWindow.token ?? null,
    };
  }

  try {
    const raw = sessionStorage.getItem(AA_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const baseUrl = asNonEmptyString(parsed.baseUrl);
    if (!baseUrl) return null;
    return {
      baseUrl,
      token: asNonEmptyString(parsed.token),
    };
  } catch {
    return null;
  }
}

function unwrapBrowserPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

export function useBrowserCapabilityController({ enabled, emitShellEvent }: UseBrowserCapabilityControllerOptions) {
  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const surfaceStateRef = useRef<BrowserSurfaceState | null>(null);
  const aaClientRef = useRef<{
    baseUrl: string;
    token: string | null;
    client: AAClient;
  } | null>(null);

  const getAaClient = useCallback(() => {
    const runtimeConfig = readRuntimeAaConfig();
    const baseUrl = process.env.NEXT_PUBLIC_AA_API_BASE_URL || runtimeConfig?.baseUrl || null;
    if (!baseUrl) return null;

    const token = process.env.NEXT_PUBLIC_AA_API_TOKEN || runtimeConfig?.token || null;
    const cached = aaClientRef.current;
    if (cached && cached.baseUrl === baseUrl && cached.token === token) {
      return cached.client;
    }

    const client = new AAClient({
      baseUrl,
      getAuthToken: () => token,
    });
    aaClientRef.current = {
      baseUrl,
      token,
      client,
    };
    return client;
  }, []);

  const emitBrowserError = useCallback(
    (error: unknown, sessionId?: string) => {
      emitShellEvent("browser.error", toErrorPayload(error, sessionId));
    },
    [emitShellEvent]
  );

  const emitActionStatus = useCallback(
    (payload: BrowserActionStatus) => {
      emitShellEvent("browser.action.status", payload);
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
      const aaClient = getAaClient();
      if (!aaClient) return;
      closeSubscription();
      subscriptionRef.current = aaClient.subscribeToBrowserSessionEvents(sessionId, {
        onEvent: consumeRuntimeEvent,
        onError: (error) => emitBrowserError(error, sessionId),
      });
    },
    [closeSubscription, consumeRuntimeEvent, emitBrowserError, getAaClient]
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

  const refreshDrawerData = useCallback(
    async (sessionId: string) => {
      const aaClient = getAaClient();
      if (!aaClient) {
        emitActionStatus({
          sessionId,
          action: "drawer_refresh",
          status: "error",
          message: "AA browser client is not configured",
        });
        return;
      }

      try {
        const [historyResponse, artifactsResponse, receiptsResponse] = await Promise.all([
          aaClient.getBrowserHistory(sessionId),
          aaClient.getBrowserArtifacts(sessionId),
          aaClient.getBrowserReceipts(sessionId),
        ]);
        const payload: BrowserDrawerDataPayload = {
          sessionId,
          history: historyResponse.history,
          artifacts: artifactsResponse.artifacts,
          receipts: receiptsResponse.receipts,
          refreshedAt: nowIso(),
        };
        emitShellEvent("browser.drawer.data", payload);
        emitActionStatus({
          sessionId,
          action: "drawer_refresh",
          status: "completed",
          message: "Browser history synced",
        });
      } catch (error) {
        emitActionStatus({
          sessionId,
          action: "drawer_refresh",
          status: "error",
          message: error instanceof Error ? error.message : "Unable to refresh browser history",
        });
        emitBrowserError(error, sessionId);
      }
    },
    [emitActionStatus, emitBrowserError, emitShellEvent, getAaClient]
  );

  const requestExtract = useCallback(
    async (sessionId: string, payload: Record<string, unknown>) => {
      const aaClient = getAaClient();
      if (!aaClient) {
        emitActionStatus({
          sessionId,
          action: "extract",
          status: "error",
          message: "AA browser client is not configured",
        });
        return;
      }

      emitActionStatus({
        sessionId,
        action: "extract",
        status: "running",
        message: "Extracting current page details into runtime artifacts…",
      });

      try {
        const result = await aaClient.extractBrowserSession(sessionId, payload);
        emitActionStatus({
          sessionId,
          action: "extract",
          status: "completed",
          message: `Extract saved as ${result.artifact.artifactType} artifact.`,
        });
        await refreshDrawerData(sessionId);
      } catch (error) {
        emitActionStatus({
          sessionId,
          action: "extract",
          status: "error",
          message: error instanceof Error ? error.message : "Extract failed",
        });
        emitBrowserError(error, sessionId);
      }
    },
    [emitActionStatus, emitBrowserError, getAaClient, refreshDrawerData]
  );

  const requestSave = useCallback(
    async (sessionId: string, payload: Record<string, unknown>) => {
      const aaClient = getAaClient();
      if (!aaClient) {
        emitActionStatus({
          sessionId,
          action: "save",
          status: "error",
          message: "AA browser client is not configured",
        });
        return;
      }

      emitActionStatus({
        sessionId,
        action: "save",
        status: "running",
        message: "Saving browser output into the runtime estate…",
      });

      try {
        const result = await aaClient.browserSave(sessionId, payload);
        emitActionStatus({
          sessionId,
          action: "save",
          status: "completed",
          message: `Saved browser output to ${result.save.destinationType}.`,
        });
        await refreshDrawerData(sessionId);
      } catch (error) {
        emitActionStatus({
          sessionId,
          action: "save",
          status: "error",
          message: error instanceof Error ? error.message : "Save failed",
        });
        emitBrowserError(error, sessionId);
      }
    },
    [emitActionStatus, emitBrowserError, getAaClient, refreshDrawerData]
  );

  const openBrowser = useCallback(
    async (input?: BrowserOpenInput) => {
      const aaClient = getAaClient();
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
    [attachAggregate, emitBrowserError, getAaClient, subscribe]
  );

  const closeBrowser = useCallback(
    async (sessionId: string) => {
      const aaClient = getAaClient();
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
    [closeSubscription, emitBrowserError, emitShellEvent, getAaClient]
  );

  const startTakeover = useCallback(
    async (sessionId: string) => {
      const aaClient = getAaClient();
      if (!aaClient) {
        emitBrowserError(new Error("AA browser client is not configured"), sessionId);
        return;
      }

      try {
        const aggregate = await aaClient.startBrowserTakeover(sessionId);
        attachAggregate(aggregate);
      } catch (error) {
        emitBrowserError(error, sessionId);
      }
    },
    [attachAggregate, emitBrowserError, getAaClient]
  );

  const endTakeover = useCallback(
    async (sessionId: string) => {
      const aaClient = getAaClient();
      if (!aaClient) {
        emitBrowserError(new Error("AA browser client is not configured"), sessionId);
        return;
      }

      try {
        const aggregate = await aaClient.endBrowserTakeover(sessionId);
        attachAggregate(aggregate);
      } catch (error) {
        emitBrowserError(error, sessionId);
      }
    },
    [attachAggregate, emitBrowserError, getAaClient]
  );

  const handleShellBridgeMessage = useCallback(
    (message: ShellInboundMessage): boolean => {
      if (!message.type.startsWith("browser.")) return false;

      const payload = unwrapBrowserPayload(message.payload || {});
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
            bounds: toSurfaceBounds(nextBounds as Record<string, unknown>, surfaceStateRef.current.bounds),
          });
        }
        return true;
      }

      if (message.type === "browser.drawer.refresh.request") {
        if (sessionId) {
          emitActionStatus({
            sessionId,
            action: "drawer_refresh",
            status: "running",
            message: "Refreshing browser history",
          });
          void refreshDrawerData(sessionId);
        }
        return true;
      }

      if (message.type === "browser.extract.request") {
        if (sessionId) {
          void requestExtract(sessionId, payload);
        }
        return true;
      }

      if (message.type === "browser.save.request") {
        if (sessionId) {
          void requestSave(sessionId, payload);
        }
        return true;
      }

      if (message.type === "browser.takeover.request") {
        if (sessionId) {
          void startTakeover(sessionId);
        }
        return true;
      }

      if (message.type === "browser.resume.request") {
        if (sessionId) {
          void endTakeover(sessionId);
        }
        return true;
      }

      return false;
    },
    [closeBrowser, emitActionStatus, endTakeover, openBrowser, patchSurfaceState, refreshDrawerData, requestExtract, requestSave, startTakeover]
  );

  useEffect(() => {
    if (!enabled) return;
    const aaClient = getAaClient();
    if (!aaClient) return;
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
  }, [attachAggregate, closeSubscription, enabled, getAaClient, subscribe]);

  return {
    handleShellBridgeMessage,
  };
}
