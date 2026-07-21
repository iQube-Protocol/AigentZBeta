/**
 * irlAdapter.ts — the IRL (Invariant Research Lab) service adapter for the
 * Threshold Gateway (PRD-THR-001 §13, Increment 4a — read surface).
 *
 * The READ surface only, wired to IRL's PUBLIC, persona-free open corpus
 * (`/api/public/irl/*`) — no T0 data, no persona Bearer. A crossed agent that
 * holds `research.read` can list and read IRL's shared research; the write
 * surface (submit result, QubeTalk) requires a separate, capability-specific
 * delegated agreement (`irl:experiment-result:submit`) and lands in 4b.
 *
 * These are thin server-to-server fetches against the app's own public routes,
 * injected into the gateway context so the gateway module stays I/O-light and
 * unit-testable.
 */

export interface IrlAdapter {
  listDocuments(): Promise<unknown>;
  readDocument(path: string): Promise<unknown>;
  /** Resolve a constitutional term against the LIVE ratified invariant canon
   *  (public, read-only, T2-safe). This is how the gateway answers "what is
   *  standing / delegation / a passport?" from the canon rather than by guessing. */
  resolveCanon(term: string): Promise<unknown>;
  /** Submit an experiment result under an AUTHORIZED IRL delegation (CFS-042 x409
   *  path — agreement-authorized, no persona Bearer). The agreementId is the
   *  irl:experiment-result:submit agreement from the incremental IRL crossing. */
  submitResult(input: { agreementId: string; experiment: string; provider: string; model: string; results: unknown; aggregates?: Record<string, unknown> }): Promise<unknown>;
}

/** Build the adapter bound to the app's public origin. */
export function makeIrlAdapter(origin: string): IrlAdapter {
  const get = async (path: string) => {
    const res = await fetch(`${origin}${path}`, { cache: 'no-store' });
    const ok = res.ok;
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    return { ok, status: res.status, body };
  };

  return {
    // The IRL research overview is the shared-artifact index (public).
    async listDocuments() {
      const r = await get('/api/public/irl/research-overview');
      if (!r.ok) return { ok: false, error: `research overview unavailable (${r.status})` };
      return { ok: true, overview: r.body, note: 'Use read_shared_document with a foundation/... path to read a specific artifact.' };
    },
    // Raw markdown for a repo-relative path within the IRL pack (public, T2-safe).
    async readDocument(path: string) {
      const clean = (path ?? '').trim();
      if (!clean || clean.includes('..')) return { ok: false, error: 'a valid IRL document path is required (e.g. foundation/PARTICIPATION_overview.md)' };
      const r = await get(`/api/public/irl/doc?path=${encodeURIComponent(clean)}`);
      if (!r.ok) return { ok: false, error: `document not found or unavailable (${r.status})`, path: clean };
      return { ok: true, path: clean, content: r.body };
    },
    // Resolve a constitutional term against the live invariant canon (public
    // resolve surface — the SAME resolver the platform uses, T2-safe projection).
    async resolveCanon(term: string) {
      const t = (term ?? '').trim();
      if (!t) return { ok: false, error: 'a term to define is required (e.g. "standing", "delegation", "Polity Passport").' };
      try {
        const res = await fetch(`${origin}/api/public/irl/resolve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ intent: `Define the constitutional meaning of "${t}" as a metaMe / Polity protocol primitive.` }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) return { ok: false, error: `canon unavailable for "${t}" (${res.status})`, term: t };
        return {
          ok: true,
          term: t,
          source: 'live ratified invariant canon (public projection)',
          resolved: body,
          note: 'These are ratified invariants that govern the term — the authoritative definition, not an inference.',
        };
      } catch {
        return { ok: false, error: `could not reach the invariant canon for "${t}"`, term: t };
      }
    },
    async submitResult(input) {
      if (!input.agreementId) return { ok: false, error: 'no IRL submission agreement — enter the Researcher journey / IRL first (request_service_capabilities("irl")).' };
      try {
        const res = await fetch(`${origin}/api/public/irl/experiments/submit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            agreementId: input.agreementId,
            experiment: input.experiment,
            provider: input.provider,
            model: input.model,
            results: input.results,
            aggregates: input.aggregates ?? {},
          }),
        });
        const body = await res.json().catch(() => null);
        // The CFS-042 endpoint carries its own x409/TTL/budget gate — pass its
        // verdict straight through (ok:false with the constitutional reason).
        return body ?? { ok: false, error: `submit failed (${res.status})` };
      } catch {
        return { ok: false, error: 'could not reach the IRL submission endpoint' };
      }
    },
  };
}
