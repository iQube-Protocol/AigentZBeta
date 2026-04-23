const crypto = require("crypto");
const { validateChatRequest } = require("../validation.cjs");

function mapAgentError(error) {
  if (error && typeof error === "object") {
    if (error.code === "TIMEOUT") {
      return { status: 504, message: "Model request timed out." };
    }
    if (error.code === "MODEL_UNAVAILABLE") {
      return { status: 503, message: "Requested local model is unavailable." };
    }
    if (typeof error.status === "number" && error.status >= 400) {
      return { status: error.status, message: "Agent request failed." };
    }
  }
  return { status: 500, message: "Unexpected agent error." };
}

function writeSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createAgentChatHandler(deps) {
  const authorizeAgentUse = deps.authorizeAgentUse;
  const ollamaClient = deps.ollamaClient;
  const rateLimiter = deps.rateLimiter;
  const logger = deps.logger || console;

  return async function handleAgentChat(req, res) {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    const startedAt = Date.now();
    const validation = validateChatRequest(req.body);

    if (!validation.ok) {
      return res.status(validation.status).json({
        error: validation.error,
        requestId,
      });
    }

    const input = validation.data;
    const contextTokenCount = Array.isArray(input.contextTokenIds) ? input.contextTokenIds.length : 0;
    const rateKey = `${input.walletAddress}:${req.ip || "unknown"}`;
    const limitResult = rateLimiter.check(rateKey);
    if (!limitResult.allowed) {
      return res.status(429).json({
        error: "Rate limit exceeded. Please retry shortly.",
        retryAfterMs: limitResult.retryAfterMs,
        requestId,
      });
    }

    const authz = await authorizeAgentUse({
      walletAddress: input.walletAddress,
      agentTokenId: input.agentTokenId,
    });
    if (!authz.allowed) {
      return res.status(authz.status || 403).json({
        error: authz.reason || "Unauthorized agent access.",
        requestId,
      });
    }

    const modelName = input.model || process.env.OLLAMA_MODEL || "llama3.1:8b";

    if (!input.stream) {
      try {
        const result = await ollamaClient.chat({
          messages: input.messages,
          model: modelName,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        });
        const latencyMs = Date.now() - startedAt;
        logger.info(
          `[Agent][${requestId}] chat success ${latencyMs}ms contextTokens=${contextTokenCount}`
        );
        return res.json({
          requestId,
          model: result.model || modelName,
          content: result.content,
          latencyMs,
          contextTokenIds: input.contextTokenIds,
        });
      } catch (error) {
        const mapped = mapAgentError(error);
        logger.error(`[Agent][${requestId}] chat failed: ${mapped.message}`);
        return res.status(mapped.status).json({ error: mapped.message, requestId });
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const abortController = new AbortController();
    req.on("close", () => abortController.abort("client_closed"));

    try {
      writeSse(res, "start", {
        requestId,
        model: modelName,
        contextTokenCount,
        contextTokenIds: input.contextTokenIds,
      });
      for await (const token of ollamaClient.streamChat({
        messages: input.messages,
        model: modelName,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        signal: abortController.signal,
      })) {
        writeSse(res, "token", { token });
      }
      const latencyMs = Date.now() - startedAt;
      writeSse(res, "done", { requestId, model: modelName, latencyMs });
      logger.info(
        `[Agent][${requestId}] stream success ${latencyMs}ms contextTokens=${contextTokenCount}`
      );
      res.end();
    } catch (error) {
      const mapped = mapAgentError(error);
      logger.error(`[Agent][${requestId}] stream failed: ${mapped.message}`);
      writeSse(res, "error", { requestId, error: mapped.message, status: mapped.status });
      res.end();
    }
  };
}

function registerAgentRoutes(app, deps) {
  const handler = createAgentChatHandler(deps);
  app.post("/api/agent/chat", handler);
}

module.exports = {
  createAgentChatHandler,
  registerAgentRoutes,
};
