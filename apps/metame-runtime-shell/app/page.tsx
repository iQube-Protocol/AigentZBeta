"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AAClient,
  isRuntimeShellConfig,
  type RuntimeMenuItem,
  type RuntimeShellConfig,
  type RuntimeShellConfigUpdate,
} from "@metame/aa-client";
import {
  createShellMessage,
  isRuntimeInboundMessage,
  postShellMessage,
  validateOrigin,
  type RuntimeInboundMessage,
  type ShellOutboundType,
} from "@metame/iframe-bridge";
import type {
  BrowserBadgeState,
  BrowserErrorPayload,
  BrowserMountPayload,
  BrowserStepState,
  BrowserSurfaceState,
} from "@metame/browser-contracts";
import { BrowserSurfaceHost } from "./components/browser/BrowserSurfaceHost";
import { RuntimeFrame } from "./components/RuntimeFrame";
import { RuntimeHeader } from "./components/RuntimeHeader";
import { SmartMenu } from "./components/SmartMenu";
import {
  appendDiagnosticsAaLog,
  appendDiagnosticsBridgeLog,
  setDiagnosticsShellConfig,
} from "./diagnostics/diagnostics";

const RUNTIME_ORIGIN_ENV = process.env.NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN ?? "";
const RUNTIME_URL_ENV = process.env.NEXT_PUBLIC_RUNTIME_IFRAME_URL ?? "";
const BROWSER_MVP_ENABLED = process.env.NEXT_PUBLIC_BROWSER_MVP_ENABLED === "true";

type BrowserShellEntry = {
  mountPayload?: BrowserMountPayload;
  surfaceState?: BrowserSurfaceState;
  badges?: BrowserBadgeState;
  step?: BrowserStepState;
  error?: BrowserErrorPayload | null;
};

type BrowserShellStore = {
  activeSessionId: string | null;
  entries: Record<string, BrowserShellEntry>;
};

type BrowserShellAction =
  | { type: "mount"; payload: BrowserMountPayload }
  | { type: "unmount"; payload: { sessionId: string } }
  | { type: "surface"; payload: BrowserSurfaceState }
  | { type: "badges"; payload: BrowserBadgeState }
  | { type: "step"; payload: BrowserStepState }
  | { type: "error"; payload: BrowserErrorPayload }
  | { type: "local_surface"; payload: { sessionId: string; patch: Partial<BrowserSurfaceState> } };

const INITIAL_BROWSER_STORE: BrowserShellStore = {
  activeSessionId: null,
  entries: {},
};

function shouldIgnoreBrowserUpdate(store: BrowserShellStore, sessionId: string): boolean {
  return !!store.activeSessionId && store.activeSessionId !== sessionId;
}

function browserShellReducer(store: BrowserShellStore, action: BrowserShellAction): BrowserShellStore {
  if (action.type === "mount") {
    const sessionId = action.payload.sessionId;
    return {
      activeSessionId: sessionId,
      entries: {
        ...store.entries,
        [sessionId]: {
          ...(store.entries[sessionId] || {}),
          mountPayload: action.payload,
          error: null,
        },
      },
    };
  }

  if (action.type === "unmount") {
    if (store.activeSessionId !== action.payload.sessionId) {
      return store;
    }
    return {
      activeSessionId: null,
      entries: {
        ...store.entries,
        [action.payload.sessionId]: {
          ...(store.entries[action.payload.sessionId] || {}),
          surfaceState: store.entries[action.payload.sessionId]?.surfaceState
            ? {
                ...store.entries[action.payload.sessionId]!.surfaceState!,
                mounted: false,
                visible: false,
              }
            : undefined,
        },
      },
    };
  }

  if (action.type === "surface") {
    if (shouldIgnoreBrowserUpdate(store, action.payload.sessionId)) return store;
    return {
      activeSessionId: store.activeSessionId ?? action.payload.sessionId,
      entries: {
        ...store.entries,
        [action.payload.sessionId]: {
          ...(store.entries[action.payload.sessionId] || {}),
          surfaceState: action.payload,
        },
      },
    };
  }

  if (action.type === "badges") {
    if (shouldIgnoreBrowserUpdate(store, action.payload.sessionId)) return store;
    return {
      activeSessionId: store.activeSessionId ?? action.payload.sessionId,
      entries: {
        ...store.entries,
        [action.payload.sessionId]: {
          ...(store.entries[action.payload.sessionId] || {}),
          badges: action.payload,
        },
      },
    };
  }

  if (action.type === "step") {
    if (shouldIgnoreBrowserUpdate(store, action.payload.sessionId)) return store;
    return {
      activeSessionId: store.activeSessionId ?? action.payload.sessionId,
      entries: {
        ...store.entries,
        [action.payload.sessionId]: {
          ...(store.entries[action.payload.sessionId] || {}),
          step: action.payload,
        },
      },
    };
  }

  if (action.type === "error") {
    const sessionId = action.payload.sessionId || store.activeSessionId;
    if (!sessionId) return store;
    if (shouldIgnoreBrowserUpdate(store, sessionId)) return store;
    return {
      activeSessionId: store.activeSessionId ?? sessionId,
      entries: {
        ...store.entries,
        [sessionId]: {
          ...(store.entries[sessionId] || {}),
          error: action.payload,
        },
      },
    };
  }

  const current = store.entries[action.payload.sessionId];
  if (!current?.surfaceState) return store;
  return {
    ...store,
    entries: {
      ...store.entries,
      [action.payload.sessionId]: {
        ...current,
        surfaceState: {
          ...current.surfaceState,
          ...action.payload.patch,
        },
      },
    },
  };
}

function ensureThinShellIframeUrl(input: string): string {
  if (!input) return input;
  try {
    const parsed = new URL(input);
    if (!parsed.searchParams.has("embed")) parsed.searchParams.set("embed", "1");
    if (!parsed.searchParams.has("shell")) parsed.searchParams.set("shell", "thin");
    return parsed.toString();
  } catch {
    return input;
  }
}

function resolveDeviceClass(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function mergeShellConfig(current: RuntimeShellConfig | null, update: RuntimeShellConfigUpdate): RuntimeShellConfig | null {
  const next = update.shell_config ?? update;
  if (!current) {
    return isRuntimeShellConfig(next) ? next : null;
  }

  return {
    tenant_id: next.tenant_id ?? current.tenant_id,
    persona_id: next.persona_id ?? current.persona_id,
    session: next.session ?? current.session,
    selectors: next.selectors ?? current.selectors,
    menu: next.menu ?? current.menu,
    iframe: next.iframe ?? current.iframe,
  };
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isWalletLayoutMessage(
  value: unknown
): value is { type: "wallet-layout-change"; layout: "narrow" | "wide"; width_px?: number; anchor?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as { type?: unknown; layout?: unknown };
  return (
    record.type === "wallet-layout-change" &&
    (record.layout === "narrow" || record.layout === "wide")
  );
}

export default function RuntimeShellHomePage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [config, setConfig] = useState<RuntimeShellConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [runtimeFrameLayout, setRuntimeFrameLayout] = useState<"default" | "narrow" | "wide">("default");
  const [browserStore, setBrowserStore] = useState<BrowserShellStore>(INITIAL_BROWSER_STORE);

  const aaClient = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_AA_API_BASE_URL;
    if (!baseUrl) return null;

    return new AAClient({
      baseUrl,
      getAuthToken: () => process.env.NEXT_PUBLIC_AA_API_TOKEN ?? null,
      onRequestLog: appendDiagnosticsAaLog,
    });
  }, []);

  const runtimeOrigin = config?.iframe.postMessageOrigin || RUNTIME_ORIGIN_ENV;
  const runtimeUrl = ensureThinShellIframeUrl(config?.iframe.url || RUNTIME_URL_ENV);

  const refreshConfig = useCallback(async () => {
    if (!aaClient) {
      setError("Missing NEXT_PUBLIC_AA_API_BASE_URL");
      setLoading(false);
      return;
    }

    try {
      const nextConfig = await aaClient.getShellConfig();
      setConfig(nextConfig);
      setDiagnosticsShellConfig(nextConfig);
      setError(null);
    } catch (nextError) {
      setError(safeError(nextError));
    } finally {
      setLoading(false);
    }
  }, [aaClient]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const postShellEvent = useCallback(
    (type: ShellOutboundType, payload: Record<string, unknown>) => {
      if (!runtimeOrigin) {
        appendDiagnosticsBridgeLog({
          timestamp: new Date().toISOString(),
          direction: "error",
          type,
          error: "Missing runtime origin",
        });
        return false;
      }

      const targetWindow = iframeRef.current?.contentWindow;
      if (!targetWindow) {
        appendDiagnosticsBridgeLog({
          timestamp: new Date().toISOString(),
          direction: "error",
          type,
          error: "iframe contentWindow unavailable",
        });
        return false;
      }

      try {
        const message = createShellMessage(type, payload, {
          tenant_id: config?.tenant_id,
          persona_id: config?.persona_id,
        });
        postShellMessage(targetWindow, runtimeOrigin, message);
        appendDiagnosticsBridgeLog({
          timestamp: new Date().toISOString(),
          direction: "outbound",
          type: message.type,
          msg_id: message.msg_id,
          origin: runtimeOrigin,
          payload: message.payload,
        });
        return true;
      } catch (postError) {
        appendDiagnosticsBridgeLog({
          timestamp: new Date().toISOString(),
          direction: "error",
          type,
          origin: runtimeOrigin,
          error: safeError(postError),
        });
        return false;
      }
    },
    [config?.persona_id, config?.tenant_id, runtimeOrigin]
  );

  useEffect(() => {
    if (!config || !runtimeOrigin || !iframeLoaded || handoffSent) return;

    const readySent = postShellEvent("SHELL_READY", {
      iframe_url: runtimeUrl,
      shell_version: "0.1.0",
    });

    const handoffSentNow = postShellEvent("HANDOFF", {
      handoff_token: config.iframe.bootstrap.handoff_token,
      context: config.iframe.bootstrap.context,
    });

    if (readySent && handoffSentNow) {
      setHandoffSent(true);
    }
  }, [config, handoffSent, iframeLoaded, postShellEvent, runtimeOrigin, runtimeUrl]);

  useEffect(() => {
    setHandoffSent(false);
    setRuntimeReady(false);
    setIframeLoaded(false);
    setRuntimeFrameLayout("default");
  }, [runtimeUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (runtimeOrigin && validateOrigin(event.origin, runtimeOrigin) && isWalletLayoutMessage(event.data)) {
        const layout = event.data.layout;
        setRuntimeFrameLayout(layout);
        appendDiagnosticsBridgeLog({
          timestamp: new Date().toISOString(),
          direction: "inbound",
          type: "wallet-layout-change",
          origin: event.origin,
          payload: {
            layout,
            width_px: event.data.width_px,
            anchor: event.data.anchor,
          },
        });
        return;
      }

      if (!isRuntimeInboundMessage(event.data)) return;
      if (!runtimeOrigin || !validateOrigin(event.origin, runtimeOrigin)) return;

      const message = event.data as RuntimeInboundMessage;
      appendDiagnosticsBridgeLog({
        timestamp: new Date().toISOString(),
        direction: "inbound",
        type: message.type,
        msg_id: message.msg_id,
        origin: event.origin,
        payload: message.payload,
      });

      if (message.type === "RUNTIME_READY") {
        setRuntimeReady(true);
        return;
      }

      if (message.type === "browser.mount") {
        setBrowserStore((current) => browserShellReducer(current, { type: "mount", payload: message.payload as BrowserMountPayload }));
        return;
      }

      if (message.type === "browser.unmount") {
        setBrowserStore((current) =>
          browserShellReducer(current, { type: "unmount", payload: message.payload as { sessionId: string } })
        );
        return;
      }

      if (message.type === "browser.surface.state") {
        setBrowserStore((current) =>
          browserShellReducer(current, { type: "surface", payload: message.payload as BrowserSurfaceState })
        );
        return;
      }

      if (message.type === "browser.badges.update") {
        setBrowserStore((current) =>
          browserShellReducer(current, { type: "badges", payload: message.payload as BrowserBadgeState })
        );
        return;
      }

      if (message.type === "browser.step.update") {
        setBrowserStore((current) =>
          browserShellReducer(current, { type: "step", payload: message.payload as BrowserStepState })
        );
        return;
      }

      if (message.type === "browser.error") {
        setBrowserStore((current) =>
          browserShellReducer(current, { type: "error", payload: message.payload as BrowserErrorPayload })
        );
        return;
      }

      if (message.type === "REQUEST_TRUST_REFRESH") {
        void refreshConfig();
        return;
      }

      if (message.type === "WELCOME_COMPLETE" || message.type === "STATE_SYNC" || message.type === "TRUST_UPDATE") {
        return;
      }

      if (message.type === "NAVIGATE") {
        const path = typeof message.payload.path === "string" ? message.payload.path : null;
        const href = typeof message.payload.href === "string" ? message.payload.href : null;
        const target = href || path;
        if (!target) return;
        if (/^https?:\/\//i.test(target)) {
          window.location.assign(target);
          return;
        }
        router.push(target);
        return;
      }

      if (message.type === "OPEN_CAPSULE") {
        const href = typeof message.payload.href === "string" ? message.payload.href : null;
        const path = typeof message.payload.path === "string" ? message.payload.path : null;
        const target = href || path;
        if (!target) return;
        if (/^https?:\/\//i.test(target)) {
          window.location.assign(target);
          return;
        }
        router.push(target);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshConfig, router, runtimeOrigin]);

  useEffect(() => {
    if (!runtimeOrigin || !iframeLoaded) return;

    function emitDeviceContext() {
      postShellEvent("DEVICE_CONTEXT_UPDATE", {
        device: resolveDeviceClass(window.innerWidth),
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
      });
    }

    emitDeviceContext();
    window.addEventListener("resize", emitDeviceContext);
    return () => window.removeEventListener("resize", emitDeviceContext);
  }, [iframeLoaded, postShellEvent, runtimeOrigin]);

  const handleAigentChange = useCallback(
    async (aigentId: string) => {
      if (!config || !aaClient) return;

      setBusyActionId("aigent");
      setError(null);
      try {
        const update = await aaClient.postSelectors({
          aigent_id: aigentId,
          llm_id: config.selectors.llm.current.id,
        });
        const next = mergeShellConfig(config, update);
        setConfig(next);
        setDiagnosticsShellConfig(next);
        postShellEvent("SELECTOR_CHANGE", {
          aigent_id: aigentId,
          llm_id: next?.selectors.llm.current.id,
        });
      } catch (nextError) {
        setError(safeError(nextError));
      } finally {
        setBusyActionId(null);
      }
    },
    [aaClient, config, postShellEvent]
  );

  const handleLlmChange = useCallback(
    async (llmId: string) => {
      if (!config || !aaClient) return;

      setBusyActionId("llm");
      setError(null);
      try {
        const update = await aaClient.postSelectors({
          aigent_id: config.selectors.aigent.current.id,
          llm_id: llmId,
        });
        const next = mergeShellConfig(config, update);
        setConfig(next);
        setDiagnosticsShellConfig(next);
        postShellEvent("SELECTOR_CHANGE", {
          aigent_id: next?.selectors.aigent.current.id,
          llm_id: llmId,
        });
      } catch (nextError) {
        setError(safeError(nextError));
      } finally {
        setBusyActionId(null);
      }
    },
    [aaClient, config, postShellEvent]
  );

  const handleMenuAction = useCallback(
    async (item: RuntimeMenuItem, payload: Record<string, unknown> = {}) => {
      if (!config || !aaClient) return;

      setBusyActionId(item.id);
      setError(null);
      try {
        const update = await aaClient.postMenuAction({
          action_id: item.id,
          payload,
        });
        const next = mergeShellConfig(config, update);
        setConfig(next);
        setDiagnosticsShellConfig(next);
        const updateRecord = update as RuntimeShellConfigUpdate & {
          menu_event?: {
            prompt?: string;
            intent?: string;
          };
        };
        postShellEvent("MENU_ACTION", {
          action_id: item.id,
          prompt: updateRecord.menu_event?.prompt ?? item.trigger?.prompt,
          intent: updateRecord.menu_event?.intent ?? item.trigger?.intent,
          payload,
        });
      } catch (nextError) {
        setError(safeError(nextError));
      } finally {
        setBusyActionId(null);
      }
    },
    [aaClient, config, postShellEvent]
  );

  const activeBrowserEntry = browserStore.activeSessionId ? browserStore.entries[browserStore.activeSessionId] : null;

  const handleBrowserLaunch = useCallback(() => {
    postShellEvent("browser.open.request", { intent: "Open browser" });
  }, [postShellEvent]);

  const handleBrowserClose = useCallback(() => {
    const sessionId = browserStore.activeSessionId;
    if (!sessionId) return;
    setBrowserStore((current) =>
      browserShellReducer(current, { type: "local_surface", payload: { sessionId, patch: { visible: false } } })
    );
    postShellEvent("browser.close.request", { sessionId });
  }, [browserStore.activeSessionId, postShellEvent]);

  const handleBrowserMinimize = useCallback(() => {
    const sessionId = browserStore.activeSessionId;
    if (!sessionId) return;
    setBrowserStore((current) =>
      browserShellReducer(current, {
        type: "local_surface",
        payload: { sessionId, patch: { shellSurfaceState: "minimized", visible: true } },
      })
    );
    postShellEvent("browser.minimize.request", { sessionId });
  }, [browserStore.activeSessionId, postShellEvent]);

  const handleBrowserExpand = useCallback(() => {
    const sessionId = browserStore.activeSessionId;
    if (!sessionId) return;
    setBrowserStore((current) =>
      browserShellReducer(current, {
        type: "local_surface",
        payload: { sessionId, patch: { shellSurfaceState: "expanded", visible: true } },
      })
    );
    postShellEvent("browser.expand.request", { sessionId });
  }, [browserStore.activeSessionId, postShellEvent]);

  const handleBrowserFocus = useCallback(
    (focused: boolean) => {
      const sessionId = browserStore.activeSessionId;
      if (!sessionId) return;
      postShellEvent("browser.focus.changed", { sessionId, focused });
    },
    [browserStore.activeSessionId, postShellEvent]
  );

  const handleBrowserBoundsChanged = useCallback(
    (bounds: BrowserSurfaceState["bounds"]) => {
      const sessionId = browserStore.activeSessionId;
      if (!sessionId) return;
      postShellEvent("browser.surface.bounds.changed", { sessionId, bounds });
    },
    [browserStore.activeSessionId, postShellEvent]
  );

  const hasRuntimeEndpoint = Boolean(runtimeUrl && runtimeOrigin);

  if (loading && !config) {
    return (
      <main className="shell-root" style={{ placeItems: "center" }}>
        <div className="shell-chip">Loading shell config…</div>
      </main>
    );
  }

  if (!config) {
    return (
      <main className="shell-root" style={{ placeItems: "center", padding: "1rem" }}>
        <div className="error-bar">Unable to load shell config: {error ?? "Unknown error"}</div>
      </main>
    );
  }

  return (
    <main className="shell-root">
      <Link href="/dev" className="dev-link">
        /dev
      </Link>

      <RuntimeHeader
        trustSignals={config.session.trust_signals}
        aigentOptions={config.selectors.aigent.options}
        llmOptions={config.selectors.llm.options}
        selectedAigentId={config.selectors.aigent.current.id}
        selectedLlmId={config.selectors.llm.current.id}
        onAigentChange={handleAigentChange}
        onLlmChange={handleLlmChange}
        busy={busyActionId !== null}
      />

      <section className="shell-main">
        {error ? <div className="error-bar">{error}</div> : null}
        {!hasRuntimeEndpoint ? (
          <div className="error-bar" style={{ marginTop: error ? "0.5rem" : 0 }}>
            Missing runtime iframe URL and/or origin. Set `NEXT_PUBLIC_RUNTIME_IFRAME_URL` and
            `NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN`.
          </div>
        ) : (
          <>
            <div className="status-row" style={{ marginBottom: "0.45rem" }}>
              <span>
                Tenant: <strong>{config.tenant_id}</strong> · Persona: <strong>{config.persona_id}</strong>
              </span>
              <span className="status-pill">{runtimeReady ? "Runtime ready" : "Handshake pending"}</span>
            </div>
            <div className="runtime-stage">
              <RuntimeFrame
                iframeRef={iframeRef}
                src={runtimeUrl}
                runtimeReady={runtimeReady}
                onLoad={() => setIframeLoaded(true)}
                layoutMode={runtimeFrameLayout}
              />
              {BROWSER_MVP_ENABLED && activeBrowserEntry?.mountPayload && activeBrowserEntry.surfaceState ? (
                <BrowserSurfaceHost
                  mountPayload={activeBrowserEntry.mountPayload}
                  surfaceState={activeBrowserEntry.surfaceState}
                  badges={activeBrowserEntry.badges}
                  step={activeBrowserEntry.step}
                  error={activeBrowserEntry.error}
                  onClose={handleBrowserClose}
                  onMinimize={handleBrowserMinimize}
                  onExpand={handleBrowserExpand}
                  onFocusChanged={handleBrowserFocus}
                  onBoundsChanged={handleBrowserBoundsChanged}
                />
              ) : null}
            </div>
          </>
        )}
      </section>

      <SmartMenu
        menu={config.menu}
        busyActionId={busyActionId}
        onAction={handleMenuAction}
        browserEnabled={BROWSER_MVP_ENABLED}
        browserActive={Boolean(browserStore.activeSessionId)}
        onBrowserLaunch={handleBrowserLaunch}
      />
    </main>
  );
}
