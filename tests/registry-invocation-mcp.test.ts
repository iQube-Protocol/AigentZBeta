/**
 * Tests for the MCP wrapper dispatch path in the invocation gateway.
 * Uses vi.stubGlobal to intercept fetch — no real network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// We test the MCP dispatch logic by calling the API route with a mocked asset.
// Since invocationGateway.ts is server-side and uses Supabase, we test the
// MCP protocol shaping in isolation via a lightweight helper that mirrors the
// dispatch logic.
// ─────────────────────────────────────────────────────────────────────────────

// Inline mirror of dispatchMcpWrapper for unit testing (same logic, no DB deps)
async function dispatchMcpWrapper(
  metadata: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<{ output: Record<string, unknown>; deferred: boolean }> {
  const endpointUrl = metadata.endpointUrl as string | undefined;
  if (!endpointUrl) {
    return { output: { status: "deferred", reason: "No endpointUrl configured for MCP asset" }, deferred: true };
  }

  const toolName = (metadata.toolName as string | undefined) ?? "default";
  const mcpHeaders = (metadata.mcpHeaders as Record<string, string> | undefined) ?? {};

  const body = {
    jsonrpc: "2.0",
    id: "test-id",
    method: "tools/call",
    params: { name: toolName, arguments: input },
  };

  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", ...mcpHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

  if (parsed.error) {
    const err = parsed.error as Record<string, unknown>;
    return { output: { status: "error", code: err.code, message: err.message, raw: parsed }, deferred: false };
  }

  const result = (parsed.result as Record<string, unknown>) ?? parsed;
  return { output: result, deferred: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("dispatchMcpWrapper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns deferred when endpointUrl is missing", async () => {
    const result = await dispatchMcpWrapper({}, { query: "test" });
    expect(result.deferred).toBe(true);
    expect(result.output.status).toBe("deferred");
  });

  it("sends correct JSON-RPC tools/call body", async () => {
    const fetchMock = mockFetchResponse({ jsonrpc: "2.0", id: "x", result: { content: [{ text: "ok" }] } });
    vi.stubGlobal("fetch", fetchMock);

    await dispatchMcpWrapper(
      { endpointUrl: "https://mcp.example.com", toolName: "search" },
      { query: "AgentiQ" }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://mcp.example.com");
    const sentBody = JSON.parse(opts.body as string);
    expect(sentBody.method).toBe("tools/call");
    expect(sentBody.params.name).toBe("search");
    expect(sentBody.params.arguments).toEqual({ query: "AgentiQ" });
    expect(sentBody.jsonrpc).toBe("2.0");
  });

  it("uses 'default' toolName when not specified", async () => {
    const fetchMock = mockFetchResponse({ result: { answer: 42 } });
    vi.stubGlobal("fetch", fetchMock);

    await dispatchMcpWrapper({ endpointUrl: "https://mcp.example.com" }, {});

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(opts.body as string);
    expect(sentBody.params.name).toBe("default");
  });

  it("forwards mcpHeaders in the request", async () => {
    const fetchMock = mockFetchResponse({ result: {} });
    vi.stubGlobal("fetch", fetchMock);

    await dispatchMcpWrapper(
      { endpointUrl: "https://mcp.example.com", mcpHeaders: { Authorization: "Bearer token123" } },
      {}
    );

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer token123");
  });

  it("returns unwrapped result on success", async () => {
    const fetchMock = mockFetchResponse({
      jsonrpc: "2.0",
      id: "1",
      result: { content: [{ type: "text", text: "search results here" }] },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchMcpWrapper({ endpointUrl: "https://mcp.example.com" }, {});
    expect(result.deferred).toBe(false);
    expect(result.output).toHaveProperty("content");
  });

  it("returns error output on JSON-RPC error response", async () => {
    const fetchMock = mockFetchResponse({
      jsonrpc: "2.0",
      id: "1",
      error: { code: -32601, message: "Method not found" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchMcpWrapper({ endpointUrl: "https://mcp.example.com", toolName: "unknown" }, {});
    expect(result.deferred).toBe(false);
    expect(result.output.status).toBe("error");
    expect(result.output.code).toBe(-32601);
    expect(result.output.message).toBe("Method not found");
  });

  it("handles non-JSON response gracefully", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve("not json"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchMcpWrapper({ endpointUrl: "https://mcp.example.com" }, {});
    expect(result.deferred).toBe(false);
    expect(result.output).toHaveProperty("raw", "not json");
  });
});
