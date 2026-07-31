/**
 * Constitutionalization — Knowledge Homecoming, Phase 1 slice 2 (CFS-023).
 *
 * Turns imported operator memory (ChatGPT transcripts landed in the `homecoming`
 * KB domain) into INVARIANT-AWARE knowledge: extract the candidate governing
 * principles a corpus embodies and PROPOSE them into the `invariants` substrate.
 *
 * Constitutional guarantee (Law XI — NON-NEGOTIABLE): everything proposed here is
 * `status: 'proposed'`, low-confidence, `agent_verified` — NEVER `validated` or
 * `canonical`. Only the operator ratifies. An agent extracting principles from a
 * chat log may NOT elevate them into the constitutional core; it may only put
 * them forward. This mirrors the extractFacts discipline (document-grounded, no
 * invention) and reuses the canonical store (`insertInvariant`) — no parallel
 * write path.
 *
 * Division of concern: the parse + validation + seed derivation are PURE and
 * canary-tested; only the LLM extraction and the substrate writes are impure.
 */

import { stripJsonFences } from '@/services/agents/_lib/llmDraftHelper';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { insertInvariant, getInvariantsBySeedIds } from '@/services/invariants/store';
import type { InvariantNamespace, InvariantSemanticType } from '@/types/invariants';
import { slugify } from '@/services/homecoming/chatgptImport';

/**
 * The safe CORE subsets an agent may propose into (the original substrate CHECK).
 * style/narrative (visual/story continuity) and epistemic are deliberately
 * excluded — operator memory constitutionalizes into these five, and constraining
 * the extractor keeps every proposal insertable without a CHECK failure.
 */
export const HOMECOMING_NAMESPACES: readonly InvariantNamespace[] = [
  'constitutional',
  'reasoning',
  'engineering',
  'experience',
  'capability',
];

export const HOMECOMING_SEMANTIC_TYPES: readonly InvariantSemanticType[] = [
  'principle',
  'constraint',
  'definition',
  'heuristic',
  'law',
];

export interface CandidateInvariant {
  statement: string;
  namespace: InvariantNamespace;
  semanticType: InvariantSemanticType;
  rationale?: string;
}

// ─── Pure core (canary-tested — no LLM, no DB) ───────────────────────────────

/** Deterministic, idempotent seed id for a proposed homecoming invariant. Pure. */
export function candidateSeedId(statement: string): string {
  return `hc:${slugify(statement)}`;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

/** Validate one raw extraction into a CandidateInvariant, or null. Pure. */
export function validateCandidate(raw: unknown): CandidateInvariant | null {
  const r = asRecord(raw);
  if (!r) return null;
  const statement = typeof r.statement === 'string' ? r.statement.trim() : '';
  if (statement.length < 8) return null; // reject empty / trivial fragments
  const namespace = r.namespace as InvariantNamespace;
  const semanticType = r.semanticType as InvariantSemanticType;
  if (!HOMECOMING_NAMESPACES.includes(namespace)) return null;
  if (!HOMECOMING_SEMANTIC_TYPES.includes(semanticType)) return null;
  const rationale = typeof r.rationale === 'string' && r.rationale.trim() ? r.rationale.trim() : undefined;
  return { statement, namespace, semanticType, rationale };
}

/**
 * Parse an LLM completion into validated candidate invariants (lenient on
 * fences, strict on shape). Deduplicates by seed id within the batch. Pure.
 */
export function parseCandidateInvariants(text: string): CandidateInvariant[] {
  const raw = stripJsonFences(text);
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: CandidateInvariant[] = [];
  for (const item of arr) {
    const c = validateCandidate(item);
    if (!c) continue;
    const seed = candidateSeedId(c.statement);
    if (seen.has(seed)) continue;
    seen.add(seed);
    out.push(c);
  }
  return out;
}

export const CONSTITUTIONALIZE_SYSTEM = `You are extracting the GOVERNING INVARIANTS a body of the operator's own writing embodies — the durable principles, constraints, definitions, heuristics, and laws that recur across their thinking. This is constitutionalization: turning memory into invariant-aware knowledge.

CRITICAL RULES — NON-NEGOTIABLE:
- Extract ONLY principles genuinely evidenced by the text. Never invent, infer beyond the text, or embellish.
- Prefer DURABLE, reusable principles over one-off facts or task details. A good invariant is stable across contexts.
- Each invariant is a single, self-contained statement (one sentence, declarative, context-free).
- Classify each into exactly one namespace and one semantic type from the vocabularies below.
- If the text embodies no durable principle, return an empty array. Fewer, stronger invariants beat many weak ones.

namespace (choose one):
  constitutional — governance, rights, sovereignty, identity, disclosure
  reasoning      — how to think, infer, decide, verify
  engineering    — how to build, structure, or operate systems
  experience     — how an interaction should feel or progress
  capability     — what an agent/person can or should be able to do

semanticType (choose one):
  principle  — a normative "should"
  constraint — a hard "must not" / boundary
  definition — fixes the meaning of a term
  heuristic  — a useful rule of thumb
  law        — an invariant that binds unconditionally

Output ONLY a valid JSON array — no preamble, no markdown:
[
  { "statement": "Authority may be delegated; sovereignty may not.", "namespace": "constitutional", "semanticType": "law", "rationale": "recurs across delegation discussions" }
]`;

// ─── Impure — LLM extraction + substrate proposal ────────────────────────────

/** Extract candidate invariants from one document's text (sovereign inference). */
export async function extractInvariantsFromText(text: string, maxTokens = 1500): Promise<CandidateInvariant[]> {
  if (!text?.trim()) return [];
  const user = `Extract the governing invariants embodied by the following text:\n\n${text}`;
  const result = await callSovereign('analysis', CONSTITUTIONALIZE_SYSTEM, user, maxTokens).catch(() => null);
  return result?.text ? parseCandidateInvariants(result.text) : [];
}

export interface ConstitutionalizeDocInput {
  sourceId: string;
  title: string;
  text: string;
}

export interface ConstitutionalizeDocResult {
  sourceId: string;
  title: string;
  extracted: number;
  proposed: number;
  skippedExisting: number;
  invariants: { seedId: string; statement: string; namespace: string; semanticType: string; status: 'proposed' | 'preview' }[];
}

/**
 * Constitutionalize a set of documents: extract candidate invariants and PROPOSE
 * the new ones (status 'proposed', Law XI) into the substrate, idempotent by
 * seed id. `dryRun` extracts + returns candidates WITHOUT writing. `limit` caps
 * how many documents are processed this run (honest: the caller reports the
 * remainder, never silently truncates). Impure.
 */
export async function constitutionalizeDocuments(
  docs: ConstitutionalizeDocInput[],
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<{ results: ConstitutionalizeDocResult[]; processed: number; remaining: number; totalProposed: number }> {
  const limit = Math.max(0, opts.limit ?? 25);
  const slice = docs.slice(0, limit);
  const results: ConstitutionalizeDocResult[] = [];
  let totalProposed = 0;

  for (const doc of slice) {
    const candidates = await extractInvariantsFromText(doc.text);
    const seedIds = candidates.map((c) => candidateSeedId(c.statement));

    // Idempotency: skip any candidate whose seed already exists in the substrate.
    let existing = new Set<string>();
    if (seedIds.length && !opts.dryRun) {
      try {
        const rows = await getInvariantsBySeedIds(seedIds);
        existing = new Set(rows.map((r) => r.seedId).filter((s): s is string => !!s));
      } catch {
        existing = new Set(); // read failed — proceed; a duplicate insert throws and is caught below
      }
    }

    const invariants: ConstitutionalizeDocResult['invariants'] = [];
    let proposed = 0;
    let skippedExisting = 0;

    for (const c of candidates) {
      const seedId = candidateSeedId(c.statement);
      if (existing.has(seedId)) {
        skippedExisting += 1;
        continue;
      }
      if (opts.dryRun) {
        invariants.push({ seedId, statement: c.statement, namespace: c.namespace, semanticType: c.semanticType, status: 'preview' });
        continue;
      }
      try {
        await insertInvariant({
          statement: c.statement,
          namespace: c.namespace,
          semanticType: c.semanticType,
          seedId,
          status: 'proposed', // Law XI — proposed only; the operator ratifies
          confidence: 0.3,
          confidenceBasis: 'agent_verified',
          provenance: { source: 'homecoming', sourceId: doc.sourceId, title: doc.title },
          reasoningProvenance: c.rationale ? { rationale: c.rationale } : {},
        });
        proposed += 1;
        invariants.push({ seedId, statement: c.statement, namespace: c.namespace, semanticType: c.semanticType, status: 'proposed' });
      } catch {
        // Unique-collision or write error — treat as already-present, never fake success.
        skippedExisting += 1;
      }
    }

    totalProposed += proposed;
    results.push({ sourceId: doc.sourceId, title: doc.title, extracted: candidates.length, proposed, skippedExisting, invariants });
  }

  return { results, processed: slice.length, remaining: Math.max(0, docs.length - slice.length), totalProposed };
}
