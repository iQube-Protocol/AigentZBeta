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
  };
}
