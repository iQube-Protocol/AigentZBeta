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

// ─── Run-lifecycle (instruments ↔ institution, CFS-019 §4) ───────────────────

export interface RunLifecycleOutcome {
  ok: boolean;
  reason?: string;
  from?: string;
  to?: string | null;
  state?: string;
  created?: boolean;
}

/**
 * Fire a run-lifecycle event at /api/research/run-lifecycle — fire-and-forget:
 * NEVER throws (a lifecycle-recording failure must not disturb the run/publish
 * flow) and returns a small outcome for inline confirmation, or null when the
 * request itself failed. Uses personaFetch (spine-authed) like every other
 * call here — never raw fetch.
 */
export async function recordRunLifecycle(
  experimentId: string,
  event: "run-started" | "results-published",
  evidence: string,
): Promise<RunLifecycleOutcome | null> {
  try {
    const res = await personaFetch("/api/research/run-lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId, event, evidence }),
    });
    const text = await res.text();
    if (text.trim().length === 0) return null;
    return JSON.parse(text) as RunLifecycleOutcome;
  } catch {
    return null;
  }
}

/** One-line inline confirmation for a run-lifecycle outcome. */
export function lifecycleNote(outcome: RunLifecycleOutcome | null): string {
  if (!outcome) return "lifecycle: not recorded";
  if (outcome.ok) {
    const arrow =
      outcome.from && outcome.to ? `${outcome.from} → ${outcome.to}` : outcome.state ?? "advanced";
    return `lifecycle: ${arrow}${outcome.created ? " (object created)" : ""} ✓`;
  }
  return `lifecycle: no advance — ${outcome.reason ?? "refused"} (${outcome.state ?? outcome.from ?? "?"})`;
}

/**
 * Honest confirmation prefix for a publish response, keyed on the authoritative
 * `visibility` the server returns. Admins publish straight to the canon; a
 * participant either saves privately or submits for steward approval — the
 * message must not claim "published" for those.
 */
export function publishStatePrefix(visibility: unknown): string {
  if (visibility === "pending") return "submitted for publication — awaiting steward approval";
  if (visibility === "private") return "saved privately";
  return "published";
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
