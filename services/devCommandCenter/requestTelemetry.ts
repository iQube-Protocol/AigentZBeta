/**
 * Best-effort in-process request telemetry for the Dev Command Center DevTools
 * (CFS-020 CDE) — the server-side "Network" view a browser's F12 cannot reach.
 *
 * HONEST LIMIT (read this before trusting the numbers): this is a plain
 * module-level ring buffer. On AWS Lambda there is NO shared memory across
 * compute instances and the buffer resets on every cold start, so it reflects
 * ONLY the calls served by the CURRENT compute instance since it warmed. It is
 * a representative sample, never a complete request log. The UI and the `net`
 * terminal command both label it exactly that way. A complete request log is a
 * CloudWatch / durable-sink follow-on (gated on adding the AWS SDK + IAM — see
 * the CFS-020 CDE DevTools scope decision, 2026-07-07).
 *
 * TIER DISCIPLINE (Identity & Access Spine — non-negotiable): an entry stores
 * ONLY method + path TEMPLATE + status + latency + timestamp. NEVER query
 * strings, request/response bodies, headers, tokens, or ANY T0 identifier
 * (personaId / authProfileId / rootDid / fioHandle / kybeAttestation). The
 * entry type makes those inexpressible, and `recordServerCall` defensively
 * strips any query string / fragment the caller may have left on the path so a
 * stray `?token=…` can never enter the buffer.
 *
 * PURE MODULE: no fs, no DB, no React, no I/O — module state only. Unit-testable
 * in isolation (tests/dcc-tools.test.ts).
 */

/** Ring-buffer cap — the in-process buffer never holds more than this many entries. */
export const SERVER_CALL_BUFFER_CAP = 100;

/**
 * A single recorded server API call. Structurally T2-safe: there is no field
 * that can carry a body, header, token, or T0 identifier.
 */
export interface ServerCallEntry {
  /** HTTP method, e.g. GET / POST. */
  method: string;
  /** Path TEMPLATE only (query string + fragment stripped on record). */
  path: string;
  /** HTTP status code. */
  status: number;
  /** Handler latency in milliseconds. */
  ms: number;
  /** ISO timestamp the call completed. */
  at: string;
}

/** What a caller supplies — `at` is stamped by the recorder, not the caller. */
export interface RecordServerCallInput {
  method: string;
  path: string;
  status: number;
  ms: number;
}

const buffer: ServerCallEntry[] = [];

/** Strip a query string / fragment so only the path template is ever stored. */
function pathTemplateOnly(path: string): string {
  const raw = typeof path === 'string' ? path : '';
  const q = raw.indexOf('?');
  const h = raw.indexOf('#');
  let end = raw.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return raw.slice(0, end);
}

/**
 * Record one server API call into the ring buffer (best-effort — never throws,
 * so a telemetry failure can never break the handler that called it). Enforces
 * the cap (oldest entries fall off) and reduces the input to the T2-safe shape:
 * method + path template + status + latency + timestamp. Any query string on
 * the path is discarded here as a second line of defence.
 */
export function recordServerCall(input: RecordServerCallInput): void {
  try {
    buffer.push({
      method: String(input.method ?? '').slice(0, 12).toUpperCase(),
      path: pathTemplateOnly(String(input.path ?? '')).slice(0, 200),
      status: Number.isFinite(input.status) ? Math.trunc(input.status) : 0,
      ms: Number.isFinite(input.ms) && input.ms >= 0 ? Math.round(input.ms) : 0,
      at: new Date().toISOString(),
    });
    if (buffer.length > SERVER_CALL_BUFFER_CAP) {
      buffer.splice(0, buffer.length - SERVER_CALL_BUFFER_CAP);
    }
  } catch {
    // best-effort — telemetry must never surface an error to the caller
  }
}

/**
 * Return the most recent server calls, NEWEST FIRST, bounded by `n` (default
 * the full buffer, itself capped at {@link SERVER_CALL_BUFFER_CAP}). Returns a
 * copy — the internal buffer is never handed out by reference.
 */
export function recentServerCalls(n: number = SERVER_CALL_BUFFER_CAP): ServerCallEntry[] {
  const count = Number.isInteger(n) && n > 0 ? Math.min(n, SERVER_CALL_BUFFER_CAP) : SERVER_CALL_BUFFER_CAP;
  return buffer.slice(-count).reverse();
}

/** Test-only: clear the buffer between assertions. Not used by any route. */
export function __resetServerCalls(): void {
  buffer.length = 0;
}
