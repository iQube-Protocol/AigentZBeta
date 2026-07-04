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

import { listInvariants, recordUsage } from './index';
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
