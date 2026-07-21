/**
 * Runtime grounding layer of the Invariant Service (CFS-006 Stage 5 / Phase 4).
 *
 * Where the *runtime* turns "the citizen's active context" into validated
 * invariant intelligence, and where it records that it used it. Runtime
 * surfaces that ground on the canon consume THIS module — they never re-query
 * or re-rank the substrate themselves (same discipline as the Identity Spine).
 *
 * T1-safety: everything returned here is a projection of InvariantRecord,
 * which already excludes T0 (creator_persona_id is never mapped onto the
 * record). Slices carry statement-level meta only — never blakQube payloads
 * (CFS-006 §2). Safe for specialist packets and browser-bound JSON.
 *
 * Grounding authority: only *validated* and *canonical* invariants are
 * knowledge (CFS-008 §1 — an invariant is the compression product that
 * survives validation). Draft/proposed statements are candidates, not canon,
 * and are excluded from grounding by default.
 *
 * Server-only.
 */

import { getCanonVersionStamp, listInvariants } from './store';
import { dependencyClosure } from './graph';
import { recordUsage } from './lifecycle';
import type {
  InvariantNamespace,
  InvariantRecord,
  InvariantSemanticType,
  InvariantStatus,
} from '@/types/invariants';

/** Statuses that carry grounding authority — knowledge, not candidates. */
const GROUNDING_STATUSES: InvariantStatus[] = ['canonical', 'validated'];

/**
 * A context descriptor derivable at any runtime call site. Every field is
 * optional — a caller grounds on whatever signals it has (the active intent's
 * domain, its ontology classes, a namespace focus). With no signals the slice
 * falls back to the highest-standing knowledge across the canon.
 */
export interface GroundingContext {
  /** Context domains of applicability (CFS-001 §3) — e.g. the active intent's domain(s). */
  domains?: string[];
  /** Ontology classes in scope (CFS-002). */
  ontologyClassIds?: string[];
  /** Namespace focus — omit for all namespaces. */
  namespaces?: InvariantNamespace[];
  /** Override the default {canonical, validated} authority set (rarely needed). */
  statuses?: InvariantStatus[];
  /** Max items in the slice (default 12). */
  limit?: number;
}

/** T1-safe projection of a single grounding invariant — statement meta only. */
export interface InvariantSliceItem {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: InvariantNamespace;
  semanticType: InvariantSemanticType | null;
  status: InvariantStatus;
  confidence: number;
  /** Validation-class confidence (Law XII). Ranking is standing-primary. */
  standing: number;
  /** Adoption (Law XII) — orthogonal to standing, carried for transparency. */
  reach: number;
}

export interface InvariantSlice {
  /** ISO timestamp, stamped by the caller (this module never reads the clock). */
  generatedAt: string | null;
  context: GroundingContext;
  items: InvariantSliceItem[];
  /** Convenience: the ids in the slice, for the citation return path. */
  citedIds: string[];
}

function projectItem(inv: InvariantRecord): InvariantSliceItem {
  return {
    id: inv.id,
    seedId: inv.seedId,
    statement: inv.statement,
    namespace: inv.namespace,
    semanticType: inv.semanticType,
    status: inv.status,
    confidence: inv.confidence,
    standing: inv.standing,
    reach: inv.reach,
  };
}

/**
 * Standing-primary ranking (Law XII): a grounding surface must foreground the
 * invariants with the most validated confidence, NOT the most-adopted ones —
 * reach is a tiebreak only, never the lead signal, so adoption can never
 * masquerade as authority.
 */
function rankByStanding(a: InvariantRecord, b: InvariantRecord): number {
  if (b.standing !== a.standing) return b.standing - a.standing;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return b.reach - a.reach;
}

function dedupeById(records: InvariantRecord[]): InvariantRecord[] {
  const seen = new Set<string>();
  const out: InvariantRecord[] = [];
  for (const r of records) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * Build the context-filtered, standing-ranked, T1-safe invariant slice for a
 * runtime context (CFS-006 §2). The union of every context signal provided is
 * gathered, de-duplicated, ranked standing-first, and capped.
 *
 * `listInvariants` filters by a single domain / single ontology class, so a
 * multi-domain or multi-class context is resolved as a union of per-signal
 * queries. When no context signal is given, the broadest grounding query runs
 * (all namespaces, knowledge statuses, standing-ordered server-side).
 */
export async function buildInvariantSlice(context: GroundingContext = {}): Promise<InvariantSlice> {
  const statuses = context.statuses ?? GROUNDING_STATUSES;
  const limit = context.limit ?? 12;
  const namespaces = context.namespaces ?? [undefined as unknown as InvariantNamespace];

  const queries: Promise<InvariantRecord[]>[] = [];
  const perQueryLimit = Math.max(limit * 2, 40); // over-fetch so ranking has headroom

  // Fan out over (namespace × domain × ontologyClass) signal combinations, each
  // a supported single-value filter on listInvariants. Absent signals collapse
  // to a single undefined pass so we never lose the "no-filter" case.
  const domains = context.domains?.length ? context.domains : [undefined];
  const classes = context.ontologyClassIds?.length ? context.ontologyClassIds : [undefined];

  for (const namespace of namespaces) {
    for (const domain of domains) {
      for (const ontologyClassId of classes) {
        queries.push(
          listInvariants({
            namespace: namespace ?? undefined,
            status: statuses,
            domain: domain ?? undefined,
            ontologyClassId: ontologyClassId ?? undefined,
            limit: perQueryLimit,
          }),
        );
      }
    }
  }

  const gathered = dedupeById((await Promise.all(queries)).flat());
  gathered.sort(rankByStanding);
  const items = gathered.slice(0, limit).map(projectItem);

  return {
    generatedAt: null,
    context,
    items,
    citedIds: items.map((i) => i.id),
  };
}

/**
 * The consequence return path (CFS-006 §4, CFS-008 §2 — reuse count). Records
 * that these invariants were used in a grounded runtime act that executed,
 * bumping their usage → Reach (Law XII: adoption, never standing). Best-effort:
 * a citation failure must never break the runtime act it describes.
 */
export async function citeInvariants(invariantIds: string[]): Promise<void> {
  const unique = [...new Set(invariantIds.filter(Boolean))];
  await Promise.allSettled(unique.map((id) => recordUsage(id)));
}

// ─────────────────────────────────────────────────────────────────────────
// Knowledge initialization (CFS-006 §3 / CFS-008 §5)
// "Compressed expertise in, rediscovery out": at session/intent start the
// runtime loads the dependency closure of the context-relevant canonical
// invariants, so the working context begins already knowing what the
// platform has validated.
// ─────────────────────────────────────────────────────────────────────────

/** A node of a knowledge-initialization manifest (T1-safe projection). */
export interface KnowledgeNode {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: InvariantNamespace;
  semanticType: InvariantSemanticType | null;
  standing: number;
  /** Traversal depth from a root (0 = surfaced directly by the context slice). */
  depth: number;
}

export interface KnowledgeManifest {
  /** Cache signature — (context, class-set, canon version), CFS-008 §5. */
  signature: string;
  canonVersion: string;
  /** Ids the context slice surfaced directly (the closure roots). */
  rootIds: string[];
  /** Roots + their depends_on/composes closure, depth-annotated. */
  nodes: KnowledgeNode[];
  truncated: boolean;
}

// House-style in-process cache (mirrors services/identity/fioCache.ts):
// module-level Map with per-entry expiry + in-flight de-dup. The canon
// version in the key is the real invalidation signal (canonical objects
// change only by supersession); the version stamp itself is probed at most
// once per VERSION_TTL_MS, and manifests are re-derived only when the stamp
// moves. Lambda instances are ephemeral — this is a warm-path saver, not a
// correctness dependency.
const MANIFEST_TTL_MS = 10 * 60 * 1000;
const VERSION_TTL_MS = 60 * 1000;
const manifestCache = new Map<string, { value: KnowledgeManifest; expiresAt: number }>();
const manifestInflight = new Map<string, Promise<KnowledgeManifest>>();
let versionCache: { value: string; expiresAt: number } | null = null;

async function currentCanonVersion(): Promise<string> {
  const now = Date.now();
  if (versionCache && versionCache.expiresAt > now) return versionCache.value;
  const value = await getCanonVersionStamp();
  versionCache = { value, expiresAt: now + VERSION_TTL_MS };
  return value;
}

function contextSignature(context: GroundingContext): string {
  return [
    (context.namespaces ?? []).slice().sort().join(','),
    (context.domains ?? []).slice().sort().join(','),
    (context.ontologyClassIds ?? []).slice().sort().join(','),
    String(context.limit ?? 10),
  ].join('|');
}

async function buildManifest(
  context: GroundingContext,
  signature: string,
  canonVersion: string,
): Promise<KnowledgeManifest> {
  // Roots: canonical members of the context slice; a young canon may have
  // nothing ratified to 'canonical' yet, so fall back to validated knowledge
  // rather than initializing empty (CFS-008 §1 — validated IS knowledge).
  const limit = context.limit ?? 10;
  let slice = await buildInvariantSlice({ ...context, statuses: ['canonical'], limit });
  if (slice.items.length === 0) {
    slice = await buildInvariantSlice({ ...context, limit });
  }
  const rootIds = slice.citedIds;

  const nodes: KnowledgeNode[] = [];
  let truncated = false;
  if (rootIds.length > 0) {
    const domain = context.domains?.length === 1 ? context.domains[0] : undefined;
    const closure = await dependencyClosure(rootIds, domain);
    truncated = closure.truncated;
    for (const node of closure.nodes) {
      nodes.push({
        id: node.invariant.id,
        seedId: node.invariant.seedId,
        statement: node.invariant.statement,
        namespace: node.invariant.namespace,
        semanticType: node.invariant.semanticType,
        standing: node.invariant.standing,
        depth: node.depth,
      });
    }
  }

  return { signature, canonVersion, rootIds, nodes, truncated };
}

/**
 * Load (or reuse) the knowledge-initialization manifest for a runtime
 * context. Cached per (context, canon version); a supersession anywhere in
 * the knowledge statuses moves the canon stamp and rebuilds on next probe.
 */
export async function initializeKnowledge(
  context: GroundingContext = {},
): Promise<KnowledgeManifest> {
  const canonVersion = await currentCanonVersion();
  const key = `${contextSignature(context)}|v:${canonVersion}`;

  const now = Date.now();
  const cached = manifestCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const inflight = manifestInflight.get(key);
  if (inflight) return inflight;

  const promise = buildManifest(context, key, canonVersion)
    .then((manifest) => {
      manifestCache.set(key, { value: manifest, expiresAt: Date.now() + MANIFEST_TTL_MS });
      return manifest;
    })
    .finally(() => {
      manifestInflight.delete(key);
    });
  manifestInflight.set(key, promise);
  return promise;
}
