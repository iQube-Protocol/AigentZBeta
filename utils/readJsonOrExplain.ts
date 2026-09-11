/**
 * Read an HTTP response as JSON, or explain what actually came back.
 *
 * ── Why this is shared (operator, 2026-08-03) ─────────────────────────────
 *
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input` —
 * *"I'm pretty sure we've already encountered this today several times too."*
 * They had: the same class of defect produced `Unexpected token '<',
 * "<!DOCTYPE "... is not valid JSON` on the Register button earlier.
 *
 * A blind `res.json()` collapses every distinct failure — route missing,
 * gateway timeout, auth redirect, empty body, crashed handler — into one
 * misleading PARSER message that names the wrong problem entirely. Nothing is
 * wrong with the JSON; there is no JSON. The operator is handed a fact about
 * a parser when they needed a fact about the request.
 *
 * This lived as a private function inside `RegisterAgentPanel.tsx`, hardened
 * over several real incidents, while every other surface kept calling raw
 * `.json()` and kept reproducing the defect it had already solved. One
 * authoritative location per concern (`inv.engineering.036/037`) — a fix that
 * only one caller can reach is not a fix.
 *
 * It reads the body ONCE as text (a Response body cannot be read twice) and
 * parses only if it plausibly is JSON, so the thrown message says what
 * happened rather than what the parser found.
 */
export async function readJsonOrExplain(res: Response, label: string): Promise<Record<string, unknown>> {
  const raw = await res.text();
  const trimmed = raw.trimStart();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`${label} returned malformed JSON (HTTP ${res.status}).`);
    }
  }

  if (trimmed.startsWith('<')) {
    throw new Error(
      `${label} returned an HTML page instead of JSON (HTTP ${res.status}). ` +
        `This usually means the route does not exist at that path, or a proxy/auth layer intercepted the call.`,
    );
  }

  /*
   * A GATEWAY TIMEOUT IS NOT AN "UNEXPECTED RESPONSE" (operator, 2026-08-02:
   * `register/status returned an unexpected response (HTTP 504)`).
   *
   * 504/502/408 means nothing answered in time — the server may still be
   * working. Reported as what it is, and explicitly NOT as a statement about
   * the work the route was doing: on a ceremony that distinction is the
   * difference between "the check was slow" and "the act failed".
   *
   * ORDER MATTERS, AND I GOT IT WRONG FIRST (2026-08-03). A gateway timeout
   * usually arrives WITH AN EMPTY BODY, so when the empty-body branch was
   * checked first it swallowed every 504 and reported "the handler crashed" —
   * the precise misattribution this function exists to prevent, reintroduced
   * by the change adding the empty-body case. The status is the stronger
   * signal and is therefore read first. Caught by its own canary.
   */
  if (res.status === 504 || res.status === 502 || res.status === 408) {
    throw new Error(
      `${label} did not answer in time (HTTP ${res.status}). Nothing was reported back, so this says nothing ` +
        'about the work itself — no act has failed and nothing needs repeating beyond the check. Try again.',
    );
  }

  /*
   * AN EMPTY BODY IS ITS OWN FACT — it is what produces the operator-visible
   * "Unexpected end of JSON input", and it means something quite different
   * from malformed JSON: the handler returned nothing at all.
   *
   * 204 is a legitimate no-content answer and is reported as such rather than
   * as a failure. Any other status with an empty body (and no gateway status
   * above) is a handler that died before writing, or was killed — a
   * serverless timeout or memory limit looks exactly like this.
   */
  if (raw.length === 0) {
    if (res.status === 204) {
      throw new Error(`${label} returned no content (HTTP 204) where a JSON body was expected.`);
    }
    throw new Error(
      `${label} returned an EMPTY body (HTTP ${res.status}) — no JSON to parse. ` +
        'The handler returned nothing, which usually means it crashed or was terminated before writing a ' +
        'response (a serverless timeout or memory limit looks exactly like this). The work it was doing may ' +
        'or may not have completed — this says nothing either way.',
    );
  }

  // Non-empty, not JSON, not HTML — quote a bounded prefix so the next
  // unknown shape costs one line to diagnose rather than another round trip.
  const preview = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
  throw new Error(`${label} returned an unexpected response (HTTP ${res.status}): ${preview}`);
}
