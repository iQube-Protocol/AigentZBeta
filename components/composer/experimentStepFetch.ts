/**
 * Experiment Lab step fetch — resilient client transport for the step APIs.
 *
 * Why this exists: a slow provider call can outlive the hosting gateway's
 * timeout, which then answers with an EMPTY / non-JSON body. Safari's
 * `res.json()` surfaces that as the cryptic "The string did not match the
 * expected pattern." — observed in production on the first cartridge-mounted
 * EXP-003 run (2026-07-05). This helper:
 *
 *   1. reads text first and parses defensively, so a non-JSON response
 *      becomes a DESCRIPTIVE error (status + body head, or a gateway-timeout
 *      hint for empty bodies) instead of a WebKit riddle;
 *   2. retries each step once automatically — step calls are stateless and
 *      idempotent at temperature 0, and timeouts are transient.
 */

import { personaFetch } from "@/utils/personaSpine";

async function once(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await personaFetch(url, init);
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        `HTTP ${res.status} — non-JSON response (${text.slice(0, 120).replace(/\s+/g, " ")}…)`,
      );
    }
  }
  if (!res.ok || !data || data.ok !== true) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      (text.trim().length === 0
        ? `HTTP ${res.status} with empty body — likely a gateway timeout on a slow provider call`
        : `HTTP ${res.status}`);
    throw new Error(message);
  }
  return data;
}

/** GET config / lists. */
export async function experimentGet(url: string): Promise<Record<string, unknown>> {
  return once(url, { cache: "no-store" });
}

/** POST one experiment step, with one automatic retry on failure. */
export async function experimentStep(
  url: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  try {
    return await once(url, init);
  } catch (firstErr) {
    // One retry — transient gateway/provider timeouts dominate this failure
    // class. A second consecutive failure is real and surfaces to the UI.
    try {
      return await once(url, init);
    } catch {
      throw firstErr instanceof Error ? firstErr : new Error("step failed");
    }
  }
}
