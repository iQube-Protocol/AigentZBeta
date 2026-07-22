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
  /** Define a constitutional primitive CONSTITUTIONAL-FIRST: lead with the
   *  verbatim ratified defining invariants (Layer 1 — the "what"), then the
   *  operational resolver projection (Layer 2 — the "how", clearly labelled as
   *  a p0-shadow ranking, not the definition). This is how the gateway answers
   *  "what is standing / delegation / a passport?" from the canon. */
  definePrimitive(term: string): Promise<unknown>;
  /** Resolve a term against the operational IRE/IPE resolver (public, T2-safe).
   *  This is the OPERATIONAL layer only — a discovery-ranking projection, not the
   *  constitutional definition. definePrimitive() wraps it as Layer 2. */
  resolveCanon(term: string): Promise<unknown>;
  /** Read the PUBLISHED, hash-committed experiment result records (public,
   *  T2-safe) so a reviewer can independently recompute sha256 and verify the
   *  anchored hash through the Threshold itself. Optional experiment id filter. */
  readResults(experiment?: string): Promise<unknown>;
  /** Submit an experiment result under an AUTHORIZED IRL delegation (CFS-042 x409
   *  path — agreement-authorized, no persona Bearer). The agreementId is the
   *  irl:experiment-result:submit agreement from the incremental IRL crossing. */
  submitResult(input: { agreementId: string; experiment: string; provider: string; model: string; results: unknown; aggregates?: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Curated CONSTITUTIONAL-DEFINITION lead sets for the core protocol primitives.
 * Each list points ONLY at real, ratified invariant ids (verified against
 * canonical-invariants.seed.json), ordered definition-first (canonical
 * statements lead). This is a curation/ordering layer over the live canon — it
 * invents no content; every statement is fetched verbatim from the substrate.
 * A term not listed here falls back to a canon text search. `distinctions` are
 * the load-bearing "X is not Y" guards, each sourced from a named invariant so
 * the gateway can never equate e.g. Standing with reputation.
 */
const PRIMITIVE_DEFINITIONS: Record<
  string,
  { leadIds: string[]; distinctions?: string[] }
> = {
  standing: {
    leadIds: [
      'inv.constitutional.145', // (canonical) operational confidence, not truth — separates Use from Truth
      'inv.polity.315', // (canonical) accrues to the person, not the persona
      'inv.polity.169', // (canonical) agents hold Standing but never citizenship
      'inv.polity.162', // (canonical) verification is the accrual gate
      'inv.constitutional.018', // confidence in veracity of declarations, not reputation
      'inv.constitutional.061', // constitutional confidence in an invariant, never a measure of truth
      'inv.constitutional.012', // Standing follows action
      'inv.constitutional.013', // Authority follows standing
    ],
    distinctions: [
      'Standing is personhood-bound: it accrues to the person, not the persona (inv.polity.315).',
      'Standing is NOT reputation. Standing is constitutional confidence in the veracity of declarations (inv.constitutional.018); identity yields reputation, not standing (inv.constitutional.066). Reputation reflects how identities are perceived; Standing reflects constitutionally verified participation.',
      'Agents may accrue Standing through delegated action but hold Standing without citizenship — Standing never confers citizenship (inv.polity.169).',
    ],
  },
  delegation: {
    leadIds: [
      'inv.polity.170', // (canonical) delegation envelope bounded on every dimension, immutable after creation
      'inv.constitutional.017', // exercise delegated authority, never create new authority
      'inv.constitutional.020', // permanent and unlimited delegation prohibited
      'inv.constitutional.014', // delegation never removes accountability
      'inv.polity.231', // (canonical) bounded delegation = personal sovereignty made operational
      'inv.polity.308', // (canonical) delegated intelligence needs standing, not just access
    ],
    distinctions: [
      'Authority may be delegated; sovereignty may not (inv.constitutional.015).',
      'Delegation establishes agent authority; it never removes accountability from the principal (inv.constitutional.014).',
    ],
  },
  personhood: {
    leadIds: [
      'inv.polity.175', // (canonical) personhood precedes permission
      'inv.polity.237', // (canonical) personhood precedes identity
      'inv.polity.178', // (canonical) proof of personhood makes foundational rights operational
      'inv.constitutional.063', // personhood precedes individualization precedes standing
      'inv.constitutional.130', // continuously individualizable without identity exposure
    ],
    distinctions: [
      'Personhood precedes identity; identity is an optional derivative of individualization, not a prerequisite for participation (inv.constitutional.063).',
      'Personhood establishes continuity; delegation establishes agent authority — the two are distinct constitutional acts.',
    ],
  },
  citizenship: {
    leadIds: [
      'inv.polity.180', // (canonical) citizenship is durable civic standing
      'inv.polity.169', // (canonical) participant agents hold Standing but never citizenship
      'inv.polity.176', // (canonical) citizenship precedes delegated power
      'inv.polity.312', // (canonical) citizen-level access sits at personhood, not persona
    ],
    distinctions: [
      'Citizenship is durable civic standing — not identity, authentication, access, or platform membership (inv.polity.180).',
    ],
  },
  authority: {
    leadIds: [
      'inv.constitutional.013', // Authority follows standing
      'inv.constitutional.015', // authority may be delegated; sovereignty may not
      'inv.constitutional.017', // an agent may exercise but never create authority
      'inv.polity.170', // (canonical) the bounded delegation envelope
    ],
  },
  reputation: {
    leadIds: [
      'inv.constitutional.018', // Standing is confidence in veracity, not reputation
      'inv.constitutional.066', // identity yields reputation, not standing
      'inv.polity.181', // (canonical) personas express reputation; never replace the person
    ],
    distinctions: [
      'Reputation is identity-bound; Standing is personhood-bound. They are distinct constitutional constructs and must never be equated (inv.constitutional.018, inv.constitutional.066).',
    ],
  },
  'polity passport': {
    leadIds: [
      'inv.polity.243', // (canonical) the constitutional credential of the Constitutional Internet
      'inv.polity.311', // (canonical) kybe-driven; attaches to proven personhood
      'inv.polity.306', // (canonical) structured declaration of standing anchored to root DID
      'inv.polity.316', // (canonical) observed at its own DidQube class
    ],
    distinctions: [
      'The Polity Passport is the constitutional credential that establishes citizenship within the Polity — a portable governance framework for bounded digital representation, not a login (inv.polity.243).',
    ],
  },
  // ── The four anchor primitives (outside-in: meaning before implementation) ──
  metame: {
    leadIds: [
      'inv.polity.250', // (canonical) metaMe is the constitutional experience layer — not a product or application
      'inv.polity.191', // (canonical) metaMe Runtime is a constitutional runtime (protected time-space)
      'inv.polity.228', // (canonical) the metaMe / AgentiQ stack is civic architecture
      'inv.polity.227', // (canonical) the polity must remain larger than the stack; the stack accountable to the polity
    ],
    distinctions: [
      'metaMe is the constitutional runtime of the Polity — the experiential environment through which a person, their agents, knowledge, authority and assets participate in the Constitutional Internet. It is not a product or application (inv.polity.250, inv.polity.191).',
      'The Polity is the community metaMe serves; metaMe is its runtime. The Polity is not a feature of metaMe (inv.polity.227).',
    ],
  },
  polity: {
    leadIds: [
      'inv.polity.249', // (canonical) core ontology — the Polity is the civic institution
      'inv.polity.172', // (canonical) governed by and for sovereign human citizens
      'inv.polity.309', // (canonical) built to protect human sovereignty in an agentic world
      'inv.polity.203', // (canonical) the self is the unit of agency; the polity is the field of consequence
    ],
    distinctions: [
      'The Polity is the constitutional community of persons and their delegated agents — the society established by the Constitutional Internet, governed by and for sovereign human citizens (inv.polity.172, inv.polity.249).',
      'Services such as the IRL, Founder Office, DevOn and Studio are institutions OF the Polity, not independent applications. The Polity is what metaMe exists to serve.',
    ],
  },
  threshold: {
    leadIds: [
      'inv.polity.236', // (canonical) the Constitutional Internet is the threshold into a new civic order
      'inv.polity.235', // (canonical) the Internet has crossed the threshold from infrastructure to society
      'inv.polity.248', // (canonical) the purpose of the Constitutional Internet
      'inv.polity.247', // (canonical) organized around agency — the capital-formation loop
    ],
    distinctions: [
      'The Threshold is the constitutional crossing into the Polity: the moment an existing person↔agent relationship becomes a constitutional relationship within metaMe. Before it, your agent operates only within its host platform; after it, it continues there while participating in the constitutional runtime under your explicit, bounded, revocable authority (grounded in inv.polity.236).',
      'Crossing establishes a Polity Passport (personhood continuity), a constitutional persona, the agent’s bounded authority, and the beginning of the sovereignty journey. Subsequent authorities are granted progressively — each institution is entered by an incremental, human-authorized delegation.',
    ],
  },
};

/** Normalize a term to a definition key: lowercase, collapse whitespace, strip a
 *  leading article, and map a few common aliases onto the canonical key. */
function definitionKey(term: string): string | null {
  const t = term.toLowerCase().replace(/\s+/g, ' ').replace(/^(the|a|an) /, '').trim();
  const alias: Record<string, string> = {
    passport: 'polity passport',
    'polity-passport': 'polity passport',
    'agent passport': 'polity passport',
    delegate: 'delegation',
    'bounded delegation': 'delegation',
    steward: 'citizenship',
    citizen: 'citizenship',
    person: 'personhood',
    // Anchor-primitive aliases
    'meta me': 'metame',
    'metame runtime': 'metame',
    'metame threshold': 'threshold',
    crossing: 'threshold',
    'metame primitive': 'metame',
  };
  const key = alias[t] ?? t;
  return key in PRIMITIVE_DEFINITIONS ? key : null;
}

/** Build the adapter bound to the app's public origin. */
export function makeIrlAdapter(origin: string): IrlAdapter {
  // Resilient JSON fetch — the canon reads are same-origin server-to-server calls
  // that intermittently blip on Lambda cold starts / Supabase latency. A single
  // transient failure must NOT surface to the agent as "could not reach the canon"
  // (the flaky-connector symptom, 2026-07-21), so: bounded timeout + a couple of
  // retries with small backoff on a network error, timeout, or 5xx.
  const resilientFetch = async (
    url: string,
    init?: RequestInit,
    opts: { retries?: number; timeoutMs?: number } = {},
  ) => {
    const retries = opts.retries ?? 2;
    const timeoutMs = opts.timeoutMs ?? 9000;
    let lastStatus = 0;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { cache: 'no-store', ...init, signal: controller.signal });
        clearTimeout(timer);
        lastStatus = res.status;
        // Retry only on transient server errors; 4xx is a real answer, don't retry.
        if (res.status >= 500 && attempt < retries) continue;
        // Read the body EXACTLY ONCE. The previous code called res.json() first and
        // fell back to res.text() in the catch — but res.json() consumes the stream,
        // so the subsequent res.text() throws "body already read" and the body is
        // lost. That silently NULLED every raw-markdown response: /api/public/irl/doc
        // returns text/markdown, so read_shared_document returned {ok:true,
        // content:null} on documents that resolved 200 (Austin QA ①a, 2026-07-22).
        // Read text once, then parse JSON only when the endpoint declares JSON.
        const rawText = await res.text().catch(() => null);
        const ct = res.headers.get('content-type') || '';
        let body: unknown = rawText;
        if (rawText != null && (ct.includes('application/json') || ct.includes('+json'))) {
          try {
            body = JSON.parse(rawText);
          } catch {
            body = rawText;
          }
        }
        return { ok: res.ok, status: res.status, body };
      } catch {
        clearTimeout(timer);
        // Network error / abort (timeout) — back off briefly and retry.
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
      }
    }
    return { ok: false, status: lastStatus || 0, body: null };
  };

  const get = (path: string) => resilientFetch(`${origin}${path}`);

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
    // Define a primitive CONSTITUTIONAL-FIRST. Layer 1 = the verbatim ratified
    // defining invariants (the "what"); Layer 2 = the operational resolver
    // projection (the "how"), clearly labelled as a p0-shadow ranking so it is
    // never mistaken for the definition. The fix for the surfacing defect where
    // explain_primitive returned only the discovery-ranking vector.
    async definePrimitive(term: string) {
      const t = (term ?? '').trim();
      if (!t) return { ok: false, error: 'a term to define is required (e.g. "standing", "delegation", "Polity Passport").' };

      const canonByIds = async (ids: string[]) => {
        if (!ids.length) return [] as Array<{ id: string; statement: string; status: string; namespace: string }>;
        const r = await get(`/api/public/irl/invariants?ids=${encodeURIComponent(ids.join(','))}`);
        const rows = (r.ok && (r.body as { invariants?: unknown })?.invariants) || [];
        const byId = new Map<string, { id: string; statement: string; status: string; namespace: string }>();
        for (const row of rows as Array<Record<string, unknown>>) {
          if (typeof row.id === 'string') {
            byId.set(row.id, {
              id: row.id,
              statement: String(row.statement ?? ''),
              status: String(row.status ?? ''),
              namespace: String(row.namespace ?? ''),
            });
          }
        }
        // Preserve the curated (definition-first) order.
        return ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
      };

      // Layer 2 — the operational resolver projection (confidence-tagged, honest
      // about being a p0-shadow ranking, not the definition).
      const operationalLayer = async () => {
        const op = (await this.resolveCanon(t)) as { ok?: boolean; resolved?: Record<string, unknown> };
        const resolved = op?.resolved ?? {};
        return {
          note: 'How the runtime operationalizes the term — a resolver ranking projection, NOT the constitutional definition. Read Layer 1 for meaning.',
          phase: resolved.phase ?? null,
          confidence: resolved.confidence ?? null,
          citedIds: resolved.citedIds ?? [],
          caveat:
            'The resolver runs in a shadow phase; its scores calibrate confidence and ranking, they do not define the term. Any "standing" vector here is the discovery-ranking weight landscape (inv.reasoning.134-137), not constitutional Standing.',
        };
      };

      // Layer-1 by canon TEXT SEARCH — the resilient path (the one that answered
      // "Founder Office" while the ids path blipped). Used un-curated, and as the
      // fallback for a curated term whose ids read transiently fails.
      const qSearch = async (query: string) => {
        const searched = await get(`/api/public/irl/invariants?q=${encodeURIComponent(query)}&limit=40`);
        const rows = ((searched.ok && (searched.body as { invariants?: unknown })?.invariants) || []) as Array<Record<string, unknown>>;
        const rank = (s: string) => (s === 'canonical' ? 0 : s === 'validated' ? 1 : s === 'proposed' ? 2 : 3);
        const lower = query.toLowerCase();
        return rows
          .map((r) => ({
            id: String(r.id ?? ''),
            statement: String(r.statement ?? ''),
            status: String(r.status ?? ''),
            namespace: String(r.namespace ?? ''),
          }))
          .sort((a, b) => {
            const aLead = a.statement.toLowerCase().startsWith(lower) ? 0 : 1;
            const bLead = b.statement.toLowerCase().startsWith(lower) ? 0 : 1;
            return aLead - bLead || rank(a.status) - rank(b.status);
          })
          .slice(0, 6);
      };

      const key = definitionKey(t);
      if (key) {
        const def = PRIMITIVE_DEFINITIONS[key];
        // Best-effort Layer 1: curated ids first; if that read blips, fall back to
        // the resilient text search. The `distinctions` below are held IN THE
        // GATEWAY (not fetched), so the load-bearing constitutional guards
        // (e.g. Standing is personhood-bound and is NOT reputation) ALWAYS answer
        // even if every canon read is momentarily unavailable — never a hard fail.
        let invariants = await canonByIds(def.leadIds);
        let retrievedVia = 'curated defining invariants (by id)';
        if (!invariants.length) {
          invariants = await qSearch(t);
          retrievedVia = 'canon text search (ids read temporarily unavailable — retry for the full curated set)';
        }
        return {
          ok: true,
          term: t,
          source: 'live ratified invariant canon (public projection)',
          constitutionalDefinition: {
            layer: 1,
            meaning: invariants.length
              ? 'The constitutional meaning of the term, stated by the ratified invariants that govern it (definition-first, canonical statements lead).'
              : 'The canon read is momentarily unavailable; the constitutional distinctions below are the authoritative guards for this term (held in the gateway, not fetched). Retry for the full ratified statements.',
            invariants,
            retrievedVia,
          },
          distinctions: def.distinctions ?? [],
          operationalModel: { layer: 2, ...(await operationalLayer()) },
          note: 'Answered constitutional-first: Layer 1 is the ratified definition (the "what") plus the load-bearing distinctions; Layer 2 is the operational model (the "how"). These are the canon, not an inference.',
        };
      }

      // Un-curated term: resilient text search, highest-authority first.
      const sorted = await qSearch(t);
      if (!sorted.length) {
        return {
          ok: true,
          term: t,
          source: 'live ratified invariant canon (public projection)',
          constitutionalDefinition: null,
          operationalModel: { layer: 2, ...(await operationalLayer()) },
          note: `No ratified invariant matched "${t}" (or the canon read is momentarily unavailable). The operational resolver projection is provided; retry, or treat as a canon gap if it persists.`,
        };
      }
      return {
        ok: true,
        term: t,
        source: 'live ratified invariant canon (public projection)',
        constitutionalDefinition: {
          layer: 1,
          meaning: `Ratified invariants matching "${t}" (canon text search, highest-authority first). Not a hand-curated definition set — read the statements directly.`,
          invariants: sorted,
        },
        distinctions: [],
        operationalModel: { layer: 2, ...(await operationalLayer()) },
        note: 'Answered constitutional-first from a canon search: Layer 1 is the ratified statements; Layer 2 is the operational model.',
      };
    },
    // Resolve a constitutional term against the live invariant canon (public
    // resolve surface — the SAME resolver the platform uses, T2-safe projection).
    async resolveCanon(term: string) {
      const t = (term ?? '').trim();
      if (!t) return { ok: false, error: 'a term to define is required (e.g. "standing", "delegation", "Polity Passport").' };
      const r = await resilientFetch(`${origin}/api/public/irl/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: `Define the constitutional meaning of "${t}" as a metaMe / Polity protocol primitive.` }),
      });
      const body = r.body as { ok?: boolean } | null;
      if (!r.ok || !body?.ok) return { ok: false, error: `canon unavailable for "${t}" (${r.status})`, term: t };
      return {
        ok: true,
        term: t,
        source: 'live ratified invariant canon (public projection)',
        resolved: body,
        note: 'These are ratified invariants that govern the term — the authoritative definition, not an inference.',
      };
    },
    // Published experiment results — the raw, hash-committed record so a reviewer
    // can verify hashes through the Threshold (review QA §3, Austin 2026-07-21).
    async readResults(experiment?: string) {
      const r = await get('/api/public/irl/experiments-results');
      if (!r.ok) return { ok: false, error: `published results unavailable (${r.status})` };
      const body = r.body as { results?: Array<Record<string, unknown>> } | null;
      let results = body?.results ?? [];
      const filt = (experiment ?? '').trim().toUpperCase();
      if (filt) results = results.filter((x) => String(x.experiment ?? '').toUpperCase() === filt);
      return {
        ok: true,
        count: results.length,
        results,
        note: 'Published, hash-committed, DVN-anchored results (T2-safe — no persona ids). To verify: recompute sha256 over the verbatim results JSON and compare to the anchored content hash.',
      };
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
