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
  }, [runtimeUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
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
            <RuntimeFrame
              iframeRef={iframeRef}
              src={runtimeUrl}
              runtimeReady={runtimeReady}
              onLoad={() => setIframeLoaded(true)}
            />
          </>
        )}
      </section>

      <SmartMenu menu={config.menu} busyActionId={busyActionId} onAction={handleMenuAction} />
    </main>
  );
}
