import {
  browserCreateSessionRequestSchema,
  browserCreateSessionResponseSchema,
  browserRuntimeEventSchema,
} from "@metame/browser-contracts";
import {
  createRuntimeMessage,
  createShellMessage,
  isRuntimeInboundMessage,
  isShellOutboundMessage,
} from "@metame/iframe-bridge";

describe("browser contracts", () => {
  it("parses a browser create-session response", () => {
    const parsed = browserCreateSessionResponseSchema.parse({
      session: {
        sessionId: "session-1",
        provider: "mock",
        providerSessionId: "provider-1",
        executionMode: "playwright",
        trustMode: "managed",
        privacyMode: "standard",
        status: "active",
        currentUrl: "https://metame.browser.local",
        currentTitle: "metaMe Browser",
        currentDomain: "metame.browser.local",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      mountPayload: {
        sessionId: "session-1",
        provider: "mock",
        mountMode: "overlay",
        liveView: {
          type: "iframe",
          url: "data:text/html,hello",
        },
        chrome: {
          title: "metaMe Browser",
          trustMode: "managed",
          privacyMode: "standard",
          executionMode: "playwright",
          activeAgentLabel: "metaMe Aigent",
        },
        capabilities: {
          canTakeover: false,
          canResize: true,
          canMinimize: true,
          canDock: true,
        },
      },
      surfaceState: {
        sessionId: "session-1",
        mounted: true,
        mountMode: "overlay",
        shellSurfaceState: "expanded",
        focused: true,
        takeoverActive: false,
        visible: true,
        bounds: { x: 0, y: 88, width: 390, height: 640 },
      },
      badges: {
        sessionId: "session-1",
        trustMode: "managed",
        privacyMode: "standard",
        executionMode: "playwright",
        activeAgentLabel: "metaMe Aigent",
        provider: "mock",
      },
    });

    expect(parsed.session.sessionId).toBe("session-1");
    expect(parsed.mountPayload.provider).toBe("mock");
  });

  it("accepts browser bridge messages through iframe-bridge validators", () => {
    const runtimeMessage = createRuntimeMessage("browser.mount", {
      sessionId: "session-1",
      provider: "mock",
      mountMode: "overlay",
      liveView: { type: "iframe", url: "data:text/html,hello" },
      chrome: {
        title: "metaMe Browser",
        trustMode: "managed",
        privacyMode: "standard",
        executionMode: "playwright",
        activeAgentLabel: "metaMe Aigent",
      },
      capabilities: {
        canTakeover: false,
        canResize: true,
        canMinimize: true,
        canDock: true,
      },
    });
    const shellMessage = createShellMessage("browser.open.request", {
      intent: "Open browser",
    });

    expect(isRuntimeInboundMessage(runtimeMessage)).toBe(true);
    expect(isShellOutboundMessage(shellMessage)).toBe(true);
    expect(
      browserRuntimeEventSchema.parse({
        type: runtimeMessage.type,
        payload: runtimeMessage.payload,
      }).type
    ).toBe("browser.mount");
  });

  it("accepts URL and search-oriented browser open payloads", () => {
    expect(
      browserCreateSessionRequestSchema.parse({
        openMode: "open",
        url: "example.com",
      }).url
    ).toBe("example.com");

    expect(
      browserCreateSessionRequestSchema.parse({
        openMode: "research",
        query: "metaMe browser runtime",
      }).query
    ).toBe("metaMe browser runtime");
  });
});
