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
 * Required properties the tool DECLARES that our arguments do not supply.
 *
 * ── Why (pilot, 2026-08-03) ───────────────────────────────────────────────
 *
 * Horizen rejected a Pulse call with:
 *   `action` — expected 'enable' | 'disable', received undefined, Required
 *   `chain`  — expected 'base-mainnet' | 'base-sepolia', received number
 *
 * Both were knowable BEFORE the call: the tool declares its own input schema
 * and we already fetch it via `listTools`. We were offering candidates and
 * hoping, when the schema was in hand the whole time. `matchSchemaFields`
 * correctly never invents a property — but silently omitting a REQUIRED one
 * turns a local, precise failure into a remote, generic one.
 *
 * This reports; it does not fill anything in. A missing required argument is
 * a refusal for the caller to make, with the field named.
 */
export function missingRequiredFields(
  schema: McpToolSchema | undefined | null,
  args: Record<string, unknown>,
): string[] {
  const required = (schema as { required?: unknown } | null | undefined)?.required;
  if (!Array.isArray(required)) return [];
  return required.filter((r): r is string => typeof r === 'string' && args[r] === undefined);
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

/**
 * The first balanced JSON object embedded anywhere in `text`, or null.
 *
 * Horizen does not always return bare JSON. Some tools return human prose, a
 * `--- structured ---` marker, and then the object — so `JSON.parse(text)`
 * throws on a response that DOES contain what's needed. Brace-balanced
 * rather than a regex, and string-aware, so a `{` or `}` inside a
 * description field cannot truncate the object early.
 *
 * Moved here from `registrationClient.ts` (2026-08-05) — `authorizationClient.ts`
 * needs the identical extraction for `extractStructuredMessageField` below,
 * and `mcpSchemaMatch.ts` is this codebase's one authoritative location for
 * shared MCP-result mechanics (inv.engineering.036/037: never a second copy).
 */
export function firstEmbeddedJsonObject(text: string): unknown | null {
  // Horizen marks the machine-readable part; prefer it when present so a brace
  // in the prose above can never be mistaken for the start of the object.
  const marker = text.indexOf('--- structured ---');
  const from = marker === -1 ? 0 : marker;

  // Otherwise try EVERY `{` in turn. Taking only the first one is fragile:
  // free text can contain a stray brace that would consume the whole
  // extraction and report "nothing found" about a response that has it.
  for (let start = text.indexOf('{', from); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break; // not the object — try the next candidate `{`
          }
        }
      }
    }
  }
  return null;
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
 *
 * ── The one exception, and why it is not a hole (pilot, 2026-08-03) ───────
 *
 * When `isError` is set, the content IS the error message, and withholding it
 * repeats the very defect this function was written to fix. It happened
 * immediately: the shape-only refusal read `the tool reported isError …
 * Actually returned: [0] type=text, NOT JSON (265 chars)` — correct, and
 * still a dead end, because the 265 characters saying WHY were the one thing
 * suppressed.
 *
 * The no-values rule protects a SUCCESS payload, which may carry material we
 * should not log. An error body is diagnostic output: it exists to be read,
 * it is what a human would be shown by any other client, and it cannot be the
 * secret the rule guards. So error text is included verbatim (bounded), and
 * success payloads stay shape-only.
 */
const ERROR_TEXT_BUDGET = 2000;

export function describeToolResultShape(toolResult: McpToolResult | null | undefined): string {
  if (!toolResult) return 'no result object at all';

  if (toolResult.isError === true && Array.isArray(toolResult.content)) {
    const text = toolResult.content
      .filter((i) => i?.type === 'text' && typeof i.text === 'string')
      .map((i) => i.text as string)
      .join(' | ')
      .trim();
    if (text) {
      const shown = text.length > ERROR_TEXT_BUDGET ? `${text.slice(0, ERROR_TEXT_BUDGET)}… (${text.length} chars total)` : text;
      return `tool-reported error: ${shown}`;
    }
  }

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

/**
 * ── SUBMISSION-RESULT NORMALIZATION (Al's brief, 2026-08-06) ────────────────
 *
 * A partner mutation is confirmed by AUTHORITATIVE PARTNER STATE, never by
 * the shape of its transport acknowledgement.
 *
 * `enable_pulse_monitoring` returned 1109 characters of NON-JSON text, with
 * `isError` unset — i.e. the signature gate passed and the tool answered
 * successfully — and the client discarded the whole thing because it found no
 * `submissionRef`/`transactionHash`/`hash`/`id` in a JSON object. That may
 * well have been Horizen's success response, thrown away and then persisted
 * locally as REFUSED. Requiring a transaction-like reference to recognise
 * completion is the defect: Pulse enablement is a registry API call, not
 * necessarily a chain transaction, so there may be no hash to return at all.
 *
 * This normalizer PRESERVES everything and interprets without discarding:
 * the raw result, every text block, whatever JSON any block happens to
 * contain, a reference if one exists anywhere, and a semantic reading of the
 * prose. It decides nothing on its own — `semanticStatus` is one input to a
 * resolution that an authoritative reread always outranks.
 */
export interface NormalizedMcpSubmissionResult {
  /** The complete MCP result, never summarised away — see Al's change 5. */
  rawResult: unknown;
  /** Every `content[].text` block, verbatim and untruncated. */
  textBlocks: string[];
  /** JSON parsed out of any text block that happened to contain it — prose blocks are not failures. */
  parsedJsonValues: unknown[];
  /** A transaction-like reference if one exists anywhere. USEFUL METADATA, never a prerequisite for success. */
  submissionRef?: string;
  semanticStatus: 'confirmed' | 'pending' | 'rejected' | 'unknown';
  /** The joined partner prose, for display and diagnostics. */
  partnerMessage?: string;
}

/** Reference field names searched in both parsed JSON and raw text (Al's change 1, rule 4). */
export const SUBMISSION_REFERENCE_FIELDS = [
  'submissionRef',
  'transactionHash',
  'txHash',
  'hash',
  'id',
  'authorizationId',
  'requestId',
] as const;

/*
 * Partner language, matched case-insensitively. Ordering of the CHECKS (not
 * these lists) is what matters: rejection is tested first so a response that
 * names a failure is never read as a success. A false 'rejected' is still
 * correctable — the authoritative reread outranks it — whereas a false
 * 'confirmed' would assert a mutation that never happened.
 */
const REJECTION_PATTERNS = [
  /invalid signature/i,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /\brejected\b/i,
  /\bdenied\b/i,
  /\bnot authori[sz]ed\b/i,
  /\b(?:4\d{2}|5\d{2})\b\s+(?:error|status)/i,
];
/**
 * `already enabled` is CONFIRMED, not an error (Al's acceptance test 2): a
 * repeat authorization for an agent Horizen already monitors has reached the
 * intended state, and treating idempotent success as failure is what would
 * push an operator into yet another needless ceremony.
 */
const CONFIRMATION_PATTERNS = [
  /pulse\s+(?:monitoring\s+)?(?:is\s+)?(?:now\s+)?enabled/i,
  /monitoring\s+(?:is\s+)?(?:now\s+)?enabled/i,
  /already\s+enabled/i,
  /successfully\s+enabled/i,
  /enabled\s+successfully/i,
  /authorization\s+accepted/i,
  /\bagent\s+updated\b/i,
  /pulse\s+monitoring\s+active/i,
];
const PENDING_PATTERNS = [
  // "being processed" and "processing" are both ordinary partner phrasings.
  /\bprocess(?:ing|ed)\b/i,
  /\bqueued\b/i,
  /\bpending\b/i,
  /\bin\s+progress\b/i,
  /\bsubmitted\b/i,
];

/**
 * A negation immediately before a confirmation phrase inverts it — "pulse
 * monitoring is NOT enabled" must never read as confirmation. Deliberately
 * narrow: only the words that actually appear in partner refusals, checked
 * within a short window before the match, rather than a general-purpose
 * natural-language negation attempt this has no business claiming to do.
 */
const NEGATION_BEFORE = /\b(?:not|never|cannot|can't|couldn't|could not|failed to|unable to|isn't|is not|wasn't|was not)\s*$/i;

function matchesUnnegated(text: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (!m) continue;
    const preceding = text.slice(Math.max(0, m.index - 24), m.index);
    if (NEGATION_BEFORE.test(preceding.trimEnd() + ' ')) continue;
    return true;
  }
  return false;
}

/** Depth-bounded search for any of `fields` in an already-parsed JSON value. */
function findReferenceInJson(value: unknown, fields: readonly string[], depth = 0): string | null {
  if (depth > 6 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReferenceInJson(item, fields, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const field of fields) {
    const v = record[field];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  for (const nested of Object.values(record)) {
    const found = findReferenceInJson(nested, fields, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * `"submissionRef": "0x…"` / `submissionRef=0x…` / `submissionRef: 0x…`
 * spelled inside PROSE, for a partner that names its reference in a sentence
 * rather than a JSON body. Never invents a value: only a labelled occurrence
 * of a field name this integration already searches for counts.
 */
function findReferenceInText(text: string, fields: readonly string[]): string | null {
  for (const field of fields) {
    const labelled = new RegExp(`${field}\\s*[=:]\\s*"?([A-Za-z0-9_\\-.]{4,})"?`, 'i').exec(text);
    if (labelled) return labelled[1];
  }
  return null;
}

export function normalizeMcpSubmissionResult(
  toolResult: McpToolResult | null | undefined,
  referenceFields: readonly string[] = SUBMISSION_REFERENCE_FIELDS,
): NormalizedMcpSubmissionResult {
  const textBlocks: string[] = [];
  const parsedJsonValues: unknown[] = [];

  if (Array.isArray(toolResult?.content)) {
    for (const item of toolResult!.content) {
      if (item?.type === 'text' && typeof item.text === 'string' && item.text.length > 0) {
        textBlocks.push(item.text);
        // Whole-block JSON first, then a brace-balanced embedded object — a
        // prose block carrying a `--- structured ---` section is common on
        // this partner and must not be written off as "NOT JSON".
        try {
          parsedJsonValues.push(JSON.parse(item.text));
        } catch {
          const embedded = firstEmbeddedJsonObject(item.text);
          if (embedded !== null) parsedJsonValues.push(embedded);
        }
      }
    }
  }

  const partnerMessage = textBlocks.length > 0 ? textBlocks.join('\n') : undefined;

  let submissionRef: string | undefined;
  for (const parsed of parsedJsonValues) {
    const found = findReferenceInJson(parsed, referenceFields);
    if (found) {
      submissionRef = found;
      break;
    }
  }
  if (!submissionRef && partnerMessage) {
    submissionRef = findReferenceInText(partnerMessage, referenceFields) ?? undefined;
  }

  /*
   * `isError` is the protocol's own failure flag and outranks any prose —
   * a tool that reports failure has failed, whatever its body reads like.
   */
  let semanticStatus: NormalizedMcpSubmissionResult['semanticStatus'] = 'unknown';
  if (toolResult?.isError === true) {
    semanticStatus = 'rejected';
  } else if (partnerMessage) {
    if (matchesUnnegated(partnerMessage, REJECTION_PATTERNS)) semanticStatus = 'rejected';
    else if (matchesUnnegated(partnerMessage, CONFIRMATION_PATTERNS)) semanticStatus = 'confirmed';
    else if (matchesUnnegated(partnerMessage, PENDING_PATTERNS)) semanticStatus = 'pending';
  }

  return { rawResult: toolResult ?? null, textBlocks, parsedJsonValues, submissionRef, semanticStatus, partnerMessage };
}

/**
 * ── AUTHORITATIVE ENROLLMENT-STATE CLASSIFICATION (Al's follow-up brief,
 * 2026-08-06) ────────────────────────────────────────────────────────────
 *
 * A live `get_onboarding_status` reread answered:
 *
 *   ✗ Not enrolled in Pulse monitoring.
 *   Next step: Enroll: build_pulse_auth_message (action: enable) → sign
 *   with the owner wallet → enable_pulse_monitoring.
 *
 * The PRIOR classification (`verifyHorizenTransparencyActivation`'s bare
 * `.includes('enabled')` check) found no positive keyword and reported this
 * as unresolved/pending — technically defensible for genuine ambiguity, but
 * this response is not ambiguous. It is an EXPLICIT NEGATIVE: Horizen states,
 * in words, that Pulse is not enrolled, and names the exact next step. A
 * classifier that cannot distinguish "no answer yet" from "explicit no"
 * traps the operator behind a status-check button that can never change the
 * outcome, because nothing re-attempts the enrollment.
 *
 * Three states, checked in this order — NEGATION OUTRANKS POSITIVE MATCHING:
 *   1. NOT_ENROLLED    — an explicit negative ("not enrolled", "not enabled",
 *      "Next step: Enroll", a structured `false`, …). Checked FIRST so "not
 *      enabled" can never fall through to the CONFIRMED check below merely
 *      because it contains the substring "enabled".
 *   2. CONFIRMED       — an explicit positive, once step 1 has ruled out a
 *      negation of the same words.
 *   3. PENDING_CONVERGENCE — explicit in-flight language, OR — the default —
 *      no conclusive statement either way. Ambiguous NEVER resolves to
 *      CONFIRMED or NOT_ENROLLED; only an explicit statement does.
 */
export type PulseEnrollmentState = 'CONFIRMED' | 'PENDING_CONVERGENCE' | 'NOT_ENROLLED';

const NOT_ENROLLED_PATTERNS = [
  /not\s+enroll(?:ed)?/i,
  /not\s+enabled/i,
  /not\s+configured/i,
  /not\s+active/i,
  /\bdisabled\b/i,
  /\bunenrolled\b/i,
  /no\s+pulse\s+monitoring/i,
  /pulse\s+monitoring\s*[:\-]\s*no\b/i,
  /next\s+step\s*:\s*enroll/i,
  // A structured `false` sitting next to the field it answers — e.g.
  // `"pulseEnabled":false` or `"enrolled": false` from a JSON-shaped reread.
  /"?(?:pulse[_-]?)?(?:enabled|enrolled|monitoring|active)"?\s*[:=]\s*false\b/i,
];
const CONFIRMED_ENROLLMENT_PATTERNS = [
  /\benrolled\b/i,
  /\benabled\b/i,
  /\bactive\b/i,
  /\bmonitored\b/i,
  /\bconfigured\b/i,
  /\bcomplete\b/i,
];
/**
 * Not branched on separately — explicit in-flight language and total silence
 * both resolve to `PENDING_CONVERGENCE` via the fallback below, and neither
 * is a conclusion either way. Kept as a named, tested pattern set so
 * "genuine processing language remains pending" is a real assertion against
 * partner wording, not merely proof that the fallback fires on nonsense text.
 */
const PENDING_ENROLLMENT_PATTERNS = [/\bprocessing\b/i, /\bpending\b/i, /\bqueued\b/i, /\bpropagat(?:ing|ion)\b/i, /\bin\s+progress\b/i];

export function classifyPulseEnrollmentState(statusText: string): PulseEnrollmentState {
  if (matchesUnnegated(statusText, NOT_ENROLLED_PATTERNS)) return 'NOT_ENROLLED';
  if (matchesUnnegated(statusText, CONFIRMED_ENROLLMENT_PATTERNS)) return 'CONFIRMED';
  if (matchesUnnegated(statusText, PENDING_ENROLLMENT_PATTERNS)) return 'PENDING_CONVERGENCE';
  // No conclusive statement at all — still PENDING_CONVERGENCE, never a
  // guess at CONFIRMED or NOT_ENROLLED.
  return 'PENDING_CONVERGENCE';
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

/**
 * The EXACT `issuedAt` baked into `build_pulse_auth_message`'s plaintext
 * response — never independently regenerated (al / Horizen brief, 2026-08-04:
 * "Do not regenerate issuedAt... after signing"). Horizen's own live schema
 * for `enable_pulse_monitoring` names this requirement explicitly: `issuedAt`
 * is documented as *"the issuedAt returned by build_pulse_auth_message"* — and
 * the signature is computed over a message this value is embedded in, so
 * submitting any other value fails signature verification even with an
 * otherwise-correct call.
 *
 * The live response observed (2026-08-04 diagnostic) states it twice, in two
 * shapes — a quoted assignment in the preamble sentence, and a labelled line
 * inside the ASR message body itself:
 *
 *   Sign this message... then call enable_pulse_monitoring with the
 *   signature and issuedAt="2026-08-04T03:35:05.609Z".
 *   ...
 *   Issued At: 2026-08-04T03:35:05.609Z
 *
 * The quoted form is tried first (unambiguous, delimited); the labelled line
 * is the fallback for a response that omits the preamble sentence. Returns
 * `null` — never a guess or a freshly-generated timestamp — if neither shape
 * is found, so the caller can refuse rather than sign/submit with a fabricated
 * value.
 */
export function extractIssuedAt(message: string): string | null {
  const quoted = message.match(/issuedAt\s*=\s*"([^"]+)"/i);
  if (quoted) return quoted[1];
  const labelled = message.match(/Issued At:\s*(\S+)/i);
  if (labelled) return labelled[1];
  return null;
}

export type StructuredMessageExtraction =
  | { found: true; message: string; markerPresent: boolean; field: string }
  | {
      found: false;
      markerPresent: boolean;
      reason: string;
      /**
       * Set when the embedded JSON declared TWO OR MORE candidate message
       * fields carrying DISTINCT strings — the one shape where "which string
       * is canonical" genuinely cannot be decided locally and the caller must
       * fail closed rather than pick. One field, or several fields agreeing
       * byte-for-byte, is never a conflict.
       */
      conflict?: { fields: string[] };
    };

/**
 * The canonical MESSAGE named inside an embedded JSON object (a
 * `--- structured ---` block, or any other brace-balanced object found in
 * the text) — DISTINCT from `extractPartnerMessage`, whose `sole-text-block`
 * fallback accepts the ENTIRE text block, preamble and all, when no
 * top-level `JSON.parse` succeeds.
 *
 * ── Promoted from instrumentation to the SELECTOR (Al's brief, 2026-08-06) ──
 *
 * Born on 2026-08-05 as a comparison-only probe (refuse when this disagrees
 * with `extractPartnerMessage`). The comparison then produced the decisive
 * evidence: `build_pulse_auth_message`'s live response carries an 826-byte
 * instructional envelope AND, inside its `--- structured ---` JSON, a
 * 198-byte `message` field ("ASR Pulse enable\nAgent: 8798\n..."). The old
 * extractor signed the envelope; Horizen's `enable_pulse_monitoring` accepts
 * no message argument at all, so its server reconstructs the canonical
 * message itself — and verifies the signature against THAT. A signature
 * over the envelope recovers perfectly locally and fails Horizen's
 * verification: exactly the repeated `401 Invalid signature`.
 *
 * So the structured `message` field, when the response declares one, IS the
 * canonical signable payload — the partner's own machine-readable statement
 * of what to sign, stronger than any text heuristic. The string is returned
 * exactly as JSON decoding produced it: never trimmed, normalized, or
 * reconstructed from fields.
 */
export function extractStructuredMessageField(
  toolResult: McpToolResult | null | undefined,
  fieldNames: string[],
): StructuredMessageExtraction {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return { found: false, markerPresent: false, reason: 'result has no content array' };
  for (const item of content) {
    if (item?.type !== 'text' || typeof item.text !== 'string') continue;
    const markerPresent = item.text.includes('--- structured ---');
    const embedded = firstEmbeddedJsonObject(item.text);
    if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) {
      // Collect EVERY declared candidate before answering — a response that
      // names two different strings as its message is a contract ambiguity
      // to refuse on, not a first-match-wins race.
      const candidates: { field: string; value: string }[] = [];
      for (const f of fieldNames) {
        const v = (embedded as Record<string, unknown>)[f];
        if (typeof v === 'string' && v.length > 0) candidates.push({ field: f, value: v });
      }
      const distinctValues = new Set(candidates.map((c) => c.value));
      if (distinctValues.size > 1) {
        return {
          found: false,
          markerPresent,
          conflict: { fields: candidates.map((c) => c.field) },
          reason:
            `the embedded JSON object declares ${candidates.length} candidate message fields ` +
            `(${candidates.map((c) => c.field).join(', ')}) carrying ${distinctValues.size} DISTINCT strings — `
            + 'no local rule can decide which is canonical',
        };
      }
      if (candidates.length > 0) {
        return { found: true, message: candidates[0].value, markerPresent, field: candidates[0].field };
      }
      return {
        found: false,
        markerPresent,
        reason: `an embedded JSON object was found but declares none of: ${fieldNames.join(', ')}`,
      };
    }
    if (markerPresent) {
      return {
        found: false,
        markerPresent,
        reason: 'a "--- structured ---" marker was present but no valid JSON object could be extracted after it',
      };
    }
  }
  return { found: false, markerPresent: false, reason: 'no text block contained an embedded JSON object' };
}
