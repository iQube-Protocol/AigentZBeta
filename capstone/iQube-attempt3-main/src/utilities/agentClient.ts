export type AgentChatRole = "system" | "user" | "assistant";

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
}

export interface StreamAgentChatRequest {
  walletAddress: string;
  messages: AgentChatMessage[];
  contextTokenIds?: number[];
  agentTokenId?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface StreamAgentChatHandlers {
  onToken?: (token: string) => void;
  onDone?: (meta: { requestId?: string; model?: string; latencyMs?: number }) => void;
}

const AGENT_API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || "http://localhost:4000";

function parseSseEvents(chunk: string): Array<{ event: string; data: string }> {
  const blocks = chunk.split("\n\n").filter((block) => block.trim().length > 0);
  const events: Array<{ event: string; data: string }> = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "message";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    events.push({ event, data });
  }

  return events;
}

export async function streamAgentChat(
  input: StreamAgentChatRequest,
  handlers: StreamAgentChatHandlers = {}
): Promise<void> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      messages: input.messages,
      contextTokenIds: input.contextTokenIds,
      agentTokenId: input.agentTokenId,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      stream: true,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    let errorMessage = `Agent request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      if (payload?.error) errorMessage = String(payload.error);
    } catch {
      // no-op: use fallback message
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("Agent stream did not include a response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let isReading = true;
  while (isReading) {
    const { done, value } = await reader.read();
    if (done) {
      isReading = false;
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    const lastSplit = buffer.lastIndexOf("\n\n");
    if (lastSplit === -1) continue;

    const complete = buffer.slice(0, lastSplit);
    buffer = buffer.slice(lastSplit + 2);

    const events = parseSseEvents(complete);
    for (const event of events) {
      const payload = event.data ? JSON.parse(event.data) : {};
      if (event.event === "token" && typeof payload.token === "string") {
        handlers.onToken?.(payload.token);
      }
      if (event.event === "error") {
        throw new Error(payload.error || "Streaming agent error.");
      }
      if (event.event === "done") {
        handlers.onDone?.(payload);
      }
    }
  }
}
