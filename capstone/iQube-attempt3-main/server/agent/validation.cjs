const CHAT_ROLES = new Set(["system", "user", "assistant"]);
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 8000;
const MAX_PROMPT_CHARS = 60000;
const MAX_CONTEXT_TOKENS = 25;

function toNumberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function validateChatRequest(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Request body must be a JSON object." };
  }

  const walletAddress =
    typeof body.walletAddress === "string" ? body.walletAddress.trim().toLowerCase() : "";
  if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return { ok: false, status: 400, error: "walletAddress must be a valid 0x Ethereum address." };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, status: 400, error: "messages must be a non-empty array." };
  }
  if (body.messages.length > MAX_MESSAGES) {
    return { ok: false, status: 400, error: `messages exceeds max length of ${MAX_MESSAGES}.` };
  }

  const messages = [];
  let totalChars = 0;
  for (const item of body.messages) {
    if (!item || typeof item !== "object") {
      return { ok: false, status: 400, error: "Each message must be an object." };
    }
    const role = typeof item.role === "string" ? item.role : "";
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (!CHAT_ROLES.has(role)) {
      return { ok: false, status: 400, error: "Message role must be system, user, or assistant." };
    }
    if (!content) {
      return { ok: false, status: 400, error: "Message content cannot be empty." };
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        status: 400,
        error: `Single message exceeds max length of ${MAX_MESSAGE_CHARS} chars.`,
      };
    }
    totalChars += content.length;
    messages.push({ role, content });
  }

  if (totalChars > MAX_PROMPT_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `Total message length exceeds max of ${MAX_PROMPT_CHARS} chars.`,
    };
  }

  const agentTokenId = toNumberOrUndefined(body.agentTokenId);
  if (agentTokenId !== undefined && (!Number.isInteger(agentTokenId) || agentTokenId < 0)) {
    return { ok: false, status: 400, error: "agentTokenId must be a non-negative integer." };
  }

  let contextTokenIds = [];
  if (body.contextTokenIds !== undefined) {
    if (!Array.isArray(body.contextTokenIds)) {
      return { ok: false, status: 400, error: "contextTokenIds must be an array of non-negative integers." };
    }
    if (body.contextTokenIds.length > MAX_CONTEXT_TOKENS) {
      return {
        ok: false,
        status: 400,
        error: `contextTokenIds exceeds max length of ${MAX_CONTEXT_TOKENS}.`,
      };
    }
    const deduped = new Set();
    for (const value of body.contextTokenIds) {
      const tokenId = Number(value);
      if (!Number.isInteger(tokenId) || tokenId < 0) {
        return { ok: false, status: 400, error: "contextTokenIds must be an array of non-negative integers." };
      }
      deduped.add(tokenId);
    }
    contextTokenIds = Array.from(deduped);
  }

  const temperature = toNumberOrUndefined(body.temperature);
  if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
    return { ok: false, status: 400, error: "temperature must be between 0 and 2." };
  }

  const maxTokens = toNumberOrUndefined(body.maxTokens);
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096)) {
    return { ok: false, status: 400, error: "maxTokens must be an integer between 1 and 4096." };
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (model.length > 128) {
    return { ok: false, status: 400, error: "model name must be <= 128 characters." };
  }

  return {
    ok: true,
    data: {
      walletAddress,
      messages,
      contextTokenIds,
      agentTokenId,
      model: model || undefined,
      temperature,
      maxTokens,
      stream: body.stream !== false,
    },
  };
}

module.exports = {
  validateChatRequest,
};
