class OllamaError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "OllamaError";
    this.code = options.code || "OLLAMA_ERROR";
    this.status = options.status;
    this.retriable = Boolean(options.retriable);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOllamaError(payload, fallbackStatus) {
  const message =
    payload && typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : "Local model request failed.";

  if (fallbackStatus === 404) {
    return new OllamaError(message, {
      status: 503,
      code: "MODEL_UNAVAILABLE",
      retriable: false,
    });
  }

  if (fallbackStatus >= 500) {
    return new OllamaError(message, {
      status: 502,
      code: "UPSTREAM_ERROR",
      retriable: true,
    });
  }

  return new OllamaError(message, {
    status: fallbackStatus || 500,
    code: "BAD_REQUEST",
    retriable: false,
  });
}

function createRequestBody(input, defaultModel) {
  const body = {
    model: input.model || defaultModel,
    messages: input.messages,
    stream: Boolean(input.stream),
  };

  const options = {};
  if (typeof input.temperature === "number") options.temperature = input.temperature;
  if (typeof input.maxTokens === "number") options.num_predict = input.maxTokens;
  if (Object.keys(options).length > 0) body.options = options;

  return body;
}

async function fetchWithRetry(fn, retries, baseDelayMs) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      const shouldRetry =
        attempt <= retries &&
        ((error instanceof OllamaError && error.retriable) ||
          (error && typeof error === "object" && error.code === "ECONNREFUSED"));
      if (!shouldRetry) throw error;
      await sleep(baseDelayMs * attempt);
    }
  }
}

function createOllamaClient(config = {}) {
  const baseUrl = (config.baseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const defaultModel = config.defaultModel || process.env.OLLAMA_MODEL || "llama3.1:8b";
  const timeoutMs = Number(config.timeoutMs || process.env.OLLAMA_TIMEOUT_MS || 45000);
  const retries = Number(config.retries || process.env.OLLAMA_RETRIES || 2);

  async function makeRequest(input, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
    try {
      return await fetchWithRetry(
        async () => {
          let response;
          try {
            response = await fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(createRequestBody(input, defaultModel)),
              signal: controller.signal,
            });
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              throw new OllamaError("Timed out waiting for local model response.", {
                status: 504,
                code: "TIMEOUT",
                retriable: false,
              });
            }
            throw error;
          }

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw extractOllamaError(payload, response.status);
          }

          return response;
        },
        retries,
        250
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async function chat(input) {
    const response = await makeRequest({ ...input, stream: false }, input.signal);
    const json = await response.json();
    const content = json?.message?.content;
    if (typeof content !== "string") {
      throw new OllamaError("Malformed response from local model.", {
        status: 502,
        code: "MALFORMED_RESPONSE",
      });
    }
    return {
      content,
      model: json.model || input.model || defaultModel,
      totalDuration: json.total_duration,
    };
  }

  async function* streamChat(input) {
    const response = await makeRequest({ ...input, stream: true }, input.signal);
    if (!response.body) {
      throw new OllamaError("No stream body from local model.", {
        status: 502,
        code: "MALFORMED_RESPONSE",
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          const payload = JSON.parse(line);
          const token = payload?.message?.content;
          if (typeof token === "string" && token.length > 0) {
            yield token;
          }
          if (payload?.done) return;
        }

        newlineIndex = buffer.indexOf("\n");
      }
    }
  }

  return {
    chat,
    streamChat,
  };
}

module.exports = {
  OllamaError,
  createOllamaClient,
};
