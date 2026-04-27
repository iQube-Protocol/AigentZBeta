import { describe, it, expect, vi } from "vitest";
import { createAgentChatHandler } from "../../server/agent/routes/chat.cjs";

type MockResponse = {
  statusCode: number;
  jsonPayload?: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  setHeader: () => void;
  write: () => void;
  end: () => void;
};

function makeRes(): MockResponse {
  return {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      return this;
    },
    setHeader() {},
    write() {},
    end() {},
  };
}

function makeDeps() {
  return {
    authorizeAgentUse: vi.fn(async () => ({ allowed: true, status: 200 })),
    ollamaClient: {
      chat: vi.fn(async () => ({ content: "hello from local model", model: "llama3.1:8b" })),
      streamChat: vi.fn(),
    },
    rateLimiter: { check: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })) },
    logger: { info: vi.fn(), error: vi.fn() },
  };
}

describe("createAgentChatHandler", () => {
  const baseBody = {
    walletAddress: "0x1111111111111111111111111111111111111111",
    messages: [{ role: "user", content: "hello" }],
    contextTokenIds: [12, 13],
    stream: false,
  };

  it("returns successful chat response", async () => {
    const deps = makeDeps();
    const handler = createAgentChatHandler(deps);
    const req = {
      body: baseBody,
      headers: {},
      ip: "127.0.0.1",
      on: vi.fn(),
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(deps.authorizeAgentUse).toHaveBeenCalledOnce();
    expect(deps.ollamaClient.chat).toHaveBeenCalledOnce();
    expect(res.jsonPayload).toMatchObject({
      model: "llama3.1:8b",
      content: "hello from local model",
      contextTokenIds: [12, 13],
    });
  });

  it("returns 400 for invalid contextTokenIds", async () => {
    const deps = makeDeps();
    const handler = createAgentChatHandler(deps);
    const req = {
      body: {
        ...baseBody,
        contextTokenIds: [1, -4],
      },
      headers: {},
      ip: "127.0.0.1",
      on: vi.fn(),
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect((res.jsonPayload as { error: string }).error).toContain("contextTokenIds");
  });

  it("returns 403 for unauthorized wallet", async () => {
    const deps = makeDeps();
    deps.authorizeAgentUse = vi.fn(async () => ({
      allowed: false,
      status: 403,
      reason: "Wallet does not have specific access.",
    }));
    const handler = createAgentChatHandler(deps);
    const req = {
      body: baseBody,
      headers: {},
      ip: "127.0.0.1",
      on: vi.fn(),
    };
    const res = makeRes();

    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect((res.jsonPayload as { error: string }).error).toContain("specific access");
  });

  it("returns 504 on local model timeout", async () => {
    const deps = makeDeps();
    deps.ollamaClient.chat = vi.fn(async () => {
      const error = new Error("Timed out waiting for local model response.");
      (error as Error & { code?: string }).code = "TIMEOUT";
      throw error;
    });
    const handler = createAgentChatHandler(deps);
    const req = {
      body: baseBody,
      headers: {},
      ip: "127.0.0.1",
      on: vi.fn(),
    };
    const res = makeRes();

    await handler(req, res);
    expect(res.statusCode).toBe(504);
  });

  it("returns 503 when model is unavailable", async () => {
    const deps = makeDeps();
    deps.ollamaClient.chat = vi.fn(async () => {
      const error = new Error("Model not found");
      (error as Error & { code?: string; status?: number }).code = "MODEL_UNAVAILABLE";
      (error as Error & { status?: number }).status = 503;
      throw error;
    });
    const handler = createAgentChatHandler(deps);
    const req = {
      body: baseBody,
      headers: {},
      ip: "127.0.0.1",
      on: vi.fn(),
    };
    const res = makeRes();

    await handler(req, res);
    expect(res.statusCode).toBe(503);
  });

  it("does not leak raw model error details", async () => {
    const deps = makeDeps();
    deps.ollamaClient.chat = vi.fn(async () => {
      throw new Error("prompt leak: ssn=111-22-3333");
    });
    const handler = createAgentChatHandler(deps);
    const req = {
      body: baseBody,
      headers: {},
      ip: "127.0.0.1",
      on: vi.fn(),
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect((res.jsonPayload as { error: string }).error).not.toContain("ssn");
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Unexpected agent error.")
    );
  });
});
