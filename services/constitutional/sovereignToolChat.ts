/**
 * Sovereign tool-calling chat — the tool-aware sovereign inference path
 * (CFS-015 Phase 2, Strand One). Server-only.
 *
 * `callSovereign` (modelRouter.ts) is text-only; agentic surfaces need
 * TOOL-CALLING. Tool-calling formats are provider-specific, but OpenAI and the
 * open-weight sovereign floor (venice) both speak the SAME OpenAI-compatible
 * `/chat/completions` API — including `tools` / `tool_calls`. So this is the
 * tool-aware sovereign path: one OpenAI-compatible tool-calling round-trip run
 * against the frontier provider first, then the open-weight floor — a
 * tool-calling agent SURVIVES a frontier outage instead of 500ing.
 *
 * Division of labour (inv.engineering.031 — separate reasoning from inference):
 * the CALLER owns tool EXECUTION (running the tool functions + the loop); this
 * module owns only the provider round-trip, the sovereign fallback, and the
 * invariant citation. Providers contribute inference only.
 *
 * Honest limit: open-weight tool-calling FIDELITY (venice/llama) is weaker than
 * frontier — the floor keeps the agent RESPONDING under a frontier outage, not
 * necessarily at frontier tool-selection quality (the same posture llmDraftHelper
 * records for venice's weaker strict-JSON).
 */

import { MODEL_ROUTING_INVARIANTS } from '@/services/constitutional/modelQube';

/** An OpenAI-compatible chat message (permissive — carries assistant tool_calls
 *  and tool-result messages alike). */
export interface SovereignToolMessage {
  role: string;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type?: string; function: { name: string; arguments: string } }>;
}

export interface SovereignToolChatResult {
  /** The OpenAI-compatible assistant message — `content` and/or `tool_calls`. */
  message: SovereignToolMessage;
  provider: 'openai' | 'venice';
  model: string;
  /** True when the routed frontier target failed and a fallback answered. */
  degraded: boolean;
  /** True when the open-weight sovereign floor answered. */
  sovereignFloor: boolean;
  /** The invariants that govern the route (invariant-intelligent inference). */
  governingInvariants: string[];
}

// gpt-4o is the tool-calling reference model; venice/llama-3.3-70b is the
// open-weight sovereign floor. Both env-overridable, both OpenAI-compatible.
const OPENAI_TOOL_MODEL = process.env.CONSTITUTIONAL_TOOL_MODEL || 'gpt-4o';
const VENICE_TOOL_MODEL = process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b';
const TOOL_CHAT_TIMEOUT_MS = 30_000;

interface ToolAttempt {
  provider: 'openai' | 'venice';
  model: string;
  base: string;
  keyEnv: string;
  sovereignFloor: boolean;
}

/** The tool-calling provider ladder — frontier first, open-weight floor last.
 *  Pure (env-derived config only), so the ladder is drillable. */
export function toolChatLadder(): ToolAttempt[] {
  return [
    { provider: 'openai', model: OPENAI_TOOL_MODEL, base: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', sovereignFloor: false },
    { provider: 'venice', model: VENICE_TOOL_MODEL, base: process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1', keyEnv: 'VENICE_API_KEY', sovereignFloor: true },
  ];
}

export interface SovereignToolChatInput {
  messages: SovereignToolMessage[];
  /** OpenAI-format tool definitions (`[{ type:'function', function:{…} }]`). */
  tools?: unknown[];
  /** OpenAI `tool_choice` (e.g. 'auto'). */
  toolChoice?: unknown;
  maxTokens?: number;
  /** Conversational temperature (default 0 — benchmark discipline). */
  temperature?: number;
}

/**
 * Run one OpenAI-compatible tool-calling completion against the sovereign
 * ladder. Returns the assistant message (with `tool_calls` when the model calls
 * a tool) + provenance. Throws only when NO provider is reachable — the sovereign
 * floor means a configured venice keeps the agent responding through a frontier
 * outage.
 */
export async function callSovereignToolChat(
  input: SovereignToolChatInput,
): Promise<SovereignToolChatResult> {
  const { messages, tools, toolChoice, maxTokens = 1000, temperature = 0 } = input;
  const ladder = toolChatLadder();
  const errors: string[] = [];

  for (let i = 0; i < ladder.length; i += 1) {
    const a = ladder[i];
    const key = process.env[a.keyEnv];
    if (!key) {
      errors.push(`${a.provider}: not configured`);
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOOL_CHAT_TIMEOUT_MS);
    try {
      const body: Record<string, unknown> = {
        model: a.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (tools) {
        body.tools = tools;
        if (toolChoice !== undefined) body.tool_choice = toolChoice;
      }
      const res = await fetch(`${a.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        errors.push(`${a.provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: SovereignToolMessage }> };
      const message = data?.choices?.[0]?.message;
      if (!message) {
        errors.push(`${a.provider}: empty completion`);
        continue;
      }
      if (i > 0) {
        console.warn(
          `[sovereignToolChat] degraded to ${a.provider}/${a.model} (frontier failed: ${errors[errors.length - 1] ?? 'error'})`,
        );
      }
      return {
        message,
        provider: a.provider,
        model: a.model,
        degraded: i > 0,
        sovereignFloor: a.sovereignFloor,
        governingInvariants: [...MODEL_ROUTING_INVARIANTS],
      };
    } catch (err) {
      errors.push(`${a.provider}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }
  // Constitutional failure — only when NO provider is reachable.
  throw new Error(`[sovereignToolChat] all providers failed — ${errors.join(' | ')}`);
}
