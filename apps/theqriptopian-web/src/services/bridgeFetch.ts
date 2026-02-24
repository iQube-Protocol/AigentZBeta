import type { RequestInit } from "react";
import { getBridgeHeaderContext } from "@/utils/bridgeHeaders";

let bridgeInterceptorInstalled = false;

function applyBridgeHeaders(headers: Headers) {
  const { personaId, tenantId, devOverride } = getBridgeHeaderContext();

  if (personaId && !headers.has("x-persona-id")) {
    headers.set("x-persona-id", personaId);
  }
  if (tenantId && !headers.has("x-tenant-id")) {
    headers.set("x-tenant-id", tenantId);
  }
  if (devOverride && !headers.has("x-dev-override")) {
    headers.set("x-dev-override", devOverride);
  }

  return headers;
}

export function initializeBridgeRequestInterceptor() {
  if (typeof window === "undefined" || bridgeInterceptorInstalled) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.url;
    const isMarketaBridge = url.includes("/api/marketa/lvb/bridge");

    if (isMarketaBridge) {
      if (input instanceof Request) {
        const headers = applyBridgeHeaders(new Headers(input.headers));
        input = new Request(input, { headers });
        init = undefined;
      } else {
        const headers = applyBridgeHeaders(new Headers(init?.headers));
        init = { ...init, headers };
      }
    }

    return originalFetch(input, init);
  };

  bridgeInterceptorInstalled = true;
}
