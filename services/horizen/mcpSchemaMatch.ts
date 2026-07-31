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
