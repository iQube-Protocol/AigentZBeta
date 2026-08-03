/**
 * Shared MCP tool-discovery and schema-matching mechanics.
 *
 * Extracted from `scripts/register-moneypenny-horizen.ts` — the only proven,
 * live MCP-discovery precedent in this repo — so
 * `services/horizen/authorizationClient.ts` reuses the exact same safe
 * mechanics rather than forking a second copy (inv.engineering.036/037: one
 * authoritative location per concern). The registration script now imports
 * `matchSchemaFields` from here instead of declaring its own.
 *
 * Nothing here assumes a specific partner tool NAME. Horizen's Pulse
 * authorization tool names (`build_pulse_auth_message`,
 * `enable_pulse_monitoring`, ...) are PROVISIONAL LABELS from the approved
 * spec, not verified against a live `tools/list` response — per CLAUDE.md's
 * "No Guessing" rule, a caller must discover the real tool set at runtime
 * (`findCompatibleTool`) rather than hardcode a call shape.
 */

export interface McpToolSchema {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  inputSchema?: McpToolSchema;
}

export interface McpToolResultContentItem {
  type: string;
  text?: string;
}

export interface McpToolResult {
  content?: McpToolResultContentItem[];
  /**
   * Protocol-level tool-execution error flag (MCP `CallToolResult.isError`).
   * A tool reporting failure still returns `content` — usually the error text —
   * so anything treating content as a RESULT must check this first or it will
   * happily consume an error message as an answer.
   */
  isError?: boolean;
}

/**
 * Best-effort schema-to-argument matcher. Prints nothing itself (callers log);
 * never invents a property the schema doesn't declare.
 */
export function matchSchemaFields(
  schema: McpToolSchema | undefined | null,
  candidates: Record<string, unknown>,
): Record<string, unknown> {
  const props: Record<string, unknown> = schema?.properties ?? {};
  const propNames = Object.keys(props);
  const matched: Record<string, unknown> = {};
  for (const propName of propNames) {
    const lower = propName.toLowerCase();
    for (const [candidateKey, candidateValue] of Object.entries(candidates)) {
      if (lower === candidateKey.toLowerCase() || lower.includes(candidateKey.toLowerCase())) {
        matched[propName] = candidateValue;
        break;
      }
    }
  }
  return matched;
}

/**
 * How strongly a tool's declared input schema overlaps a set of expected
 * field-name hints (substring, case-insensitive). Used to identify a
 * compatible tool by SHAPE when the partner's real tool name doesn't match
 * any provisional label.
 */
export function schemaFieldOverlapScore(schema: McpToolSchema | undefined | null, hints: string[]): number {
  const props = Object.keys(schema?.properties ?? {});
  let score = 0;
  for (const prop of props) {
    const lower = prop.toLowerCase();
    if (hints.some((h) => lower.includes(h.toLowerCase()))) score += 1;
  }
  return score;
}

export interface ToolCandidateSpec {
  /** A stable label for this role in the flow (e.g. 'build', 'submit', 'status'). Never sent to the partner. */
  role: string;
  /** Provisional tool-name labels, tried first via exact case-insensitive match. */
  nameCandidates: string[];
  /** Property-name substrings expected in a compatible tool's input schema, used as a shape-based fallback. */
  requiredFieldHints: string[];
}

export type FindCompatibleToolResult =
  | { ok: true; tool: McpTool }
  | { ok: false; role: string; declaredToolNames: string[] };

/**
 * Resolve ONE compatible tool for a role: exact provisional-name match first,
 * then a schema-shape fallback among tools not already claimed. Never
 * fabricates a tool the server didn't declare.
 */
export function findCompatibleTool(
  tools: McpTool[],
  spec: ToolCandidateSpec,
  claimed: Set<string>,
): FindCompatibleToolResult {
  const byNameLower = new Map(tools.map((t) => [t.name.toLowerCase(), t] as const));
  for (const candidate of spec.nameCandidates) {
    const found = byNameLower.get(candidate.toLowerCase());
    if (found && !claimed.has(found.name)) {
      return { ok: true, tool: found };
    }
  }
  let best: { tool: McpTool; score: number } | null = null;
  for (const tool of tools) {
    if (claimed.has(tool.name)) continue;
    const score = schemaFieldOverlapScore(tool.inputSchema, spec.requiredFieldHints);
    if (score > 0 && (!best || score > best.score)) best = { tool, score };
  }
  if (best) return { ok: true, tool: best.tool };
  return { ok: false, role: spec.role, declaredToolNames: tools.map((t) => t.name) };
}

/** Extract the first JSON object found in an MCP tool result's text content blocks. */
export function extractFirstJson(toolResult: McpToolResult | null | undefined): unknown | null {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === 'text' && typeof item.text === 'string') {
      try {
        return JSON.parse(item.text);
      } catch {
        // not JSON — keep looking
      }
    }
  }
  return null;
}

/**
 * What a tool result ACTUALLY looked like, for a refusal that a human can act on.
 *
 * ── Why this exists (pilot, 2026-08-03) ───────────────────────────────────
 *
 * Verify refused with: `"build_pulse_auth_message" did not return a
 * recognisable message field — refusing rather than inventing one`. The
 * refusal is CORRECT — signing a field we guessed at would be far worse —
 * but it named only what we failed to find, never what the partner actually
 * sent. There is no way to tell from it whether the tool returned plain text
 * rather than JSON, nested the message one level down, used a field name not
 * in our candidate list, or errored. So the honest refusal was also a dead
 * end, and the only way forward was to read partner source we don't have.
 *
 * This describes the OBSERVED shape — content item types, whether the text
 * parsed as JSON, and the top-level keys if it did. It reports; it never
 * widens what counts as an acceptable answer. Deliberately does NOT include
 * VALUES: a partner payload may carry material we should not log.
 */
export function describeToolResultShape(toolResult: McpToolResult | null | undefined): string {
  if (!toolResult) return 'no result object at all';
  const content = toolResult.content;
  if (!Array.isArray(content)) {
    return `result has no content array (keys: ${Object.keys(toolResult).join(', ') || 'none'})`;
  }
  if (content.length === 0) return 'result.content is an empty array';

  const parts = content.map((item, i) => {
    const type = item?.type ?? 'undefined';
    if (type !== 'text' || typeof item?.text !== 'string') return `[${i}] type=${type}, no text`;
    const text = item.text;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return `[${i}] type=text, JSON object with keys: ${Object.keys(parsed as Record<string, unknown>).join(', ') || 'none'}`;
      }
      return `[${i}] type=text, JSON ${Array.isArray(parsed) ? 'array' : typeof parsed}`;
    } catch {
      return `[${i}] type=text, NOT JSON (${text.length} chars)`;
    }
  });
  return parts.join('; ');
}

/**
 * The partner-supplied MESSAGE to be signed, from either shape a tool may use.
 *
 * ── Evidence, not inference (pilot, 2026-08-03) ───────────────────────────
 *
 * `describeToolResultShape` was added precisely so a refusal would say what
 * the partner actually sent. It did, immediately:
 *
 *     "build_pulse_auth_message" did not return a recognisable message field.
 *     Looked for: message, payload, authMessage, messageToSign,
 *     authorizationMessage. Actually returned: [0] type=text, NOT JSON (265 chars)
 *
 * One text block, not JSON, 265 characters — the message itself, returned
 * directly rather than wrapped in an object. `extractStringField` could never
 * see it because it JSON-parses first and gives up when that fails.
 *
 * ── Why accepting it is principled, not a guess ───────────────────────────
 *
 * MCP defines a tool result's `content` AS its return value, and carries a
 * separate `isError` flag for failures. So a NON-ERROR call whose entire
 * result is one text block is returning that text as its answer — reading it
 * that way follows the protocol rather than guessing a convention.
 *
 * The guards are what keep it safe, because the returned string is about to
 * be signed by the operator's key:
 *   - `isError === true`  → refuse. A failing tool still returns content, and
 *     it is usually the error text; consuming that as a message-to-sign is
 *     exactly the "guessed field puts an error string in front of your key"
 *     risk the original refusal existed to prevent.
 *   - more than one text block → refuse as AMBIGUOUS rather than guess which
 *     one is the message.
 *   - JSON that parses but lacks a named field → refuse. A structured answer
 *     that does not name its message is not offering plain text; falling
 *     through to "stringify the object" would be inventing.
 *
 * The named-field path is still tried FIRST and still preferred — this only
 * fires where the structured read found nothing.
 */
export function extractPartnerMessage(
  toolResult: McpToolResult | null | undefined,
  fieldNames: string[],
): { ok: true; message: string; via: 'named-field' | 'sole-text-block' } | { ok: false; reason: string } {
  if (!toolResult) return { ok: false, reason: 'no result object at all' };
  if (toolResult.isError === true) {
    return { ok: false, reason: 'the tool reported isError — its content is a failure message, never a message to sign' };
  }

  const named = extractStringField(toolResult, fieldNames);
  if (named) return { ok: true, message: named, via: 'named-field' };

  const content = toolResult.content;
  if (!Array.isArray(content)) return { ok: false, reason: 'result has no content array' };

  const textBlocks = content.filter((i) => i?.type === 'text' && typeof i.text === 'string' && i.text.length > 0);
  if (textBlocks.length === 0) return { ok: false, reason: 'result carries no non-empty text block' };
  if (textBlocks.length > 1) {
    return { ok: false, reason: `${textBlocks.length} text blocks returned — ambiguous which is the message; refusing rather than choosing` };
  }

  const sole = textBlocks[0].text as string;
  // Parses as JSON but had none of the named fields → a structured answer that
  // does not name its message. Signing its raw source would be inventing.
  try {
    JSON.parse(sole);
    return {
      ok: false,
      reason: 'the sole text block is JSON but declares none of the expected message fields — refusing rather than signing its raw source',
    };
  } catch {
    return { ok: true, message: sole, via: 'sole-text-block' };
  }
}

/** Extract a named hex-string field (tx hash, message, payload, ...) from an MCP tool result. */
export function extractStringField(toolResult: McpToolResult | null | undefined, fieldNames: string[]): string | null {
  const parsed = extractFirstJson(toolResult) as Record<string, unknown> | null;
  if (parsed) {
    for (const f of fieldNames) {
      const v = parsed[f];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return null;
}
