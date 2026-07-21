/**
 * Perception (CFS-035 §6 cognitive layer 1 / §9 the "Field Extractor") — v0.
 *
 * The one genuinely new component in the engine: estimate which parts of the
 * constitutional field an ARBITRARY input activates, so a Field Snapshot can be
 * built from raw text rather than a hand-specified GroundingContext. Today every
 * grounded surface passes its domains explicitly (`groundReasoning({domains})`);
 * perception derives them.
 *
 * SCOPE DISCIPLINE (the plan's guard against over-investing here first): this v0
 * is DELIBERATELY a cheap, deterministic, no-LLM heuristic — term/keyword overlap
 * against a curated domain vocabulary. It is honest as an estimator, not a
 * semantic perceiver. The inference-heavy version (embeddings / an LLM classifier
 * over the live invariant corpus) is the Gen-3 follow-on; this seam exists so that
 * upgrade is a drop-in replacement of `extractField`, not a new integration.
 *
 * Pure + deterministic (the extractor); `groundFromInput` composes it with the
 * DB-backed snapshot. Observe-only — nothing here replaces an explicit context.
 */

import type { GroundingContext, InvariantSlice } from './grounding';
import { computeFieldSnapshot, type FieldSnapshot } from './engine';

/**
 * Curated domain vocabulary (v0). Maps a field domain (an invariant `context`)
 * to the terms whose presence estimates that domain is active. Lowercased,
 * whole-word matched. Deliberately small + auditable — the Gen-3 extractor
 * replaces this with a learned/semantic mapping over the live corpus.
 */
const DOMAIN_VOCABULARY: Record<string, string[]> = {
  discovery: ['discover', 'surface', 'recommend', 'ranking', 'rank', 'feed', 'browse', 'explore'],
  ranking: ['rank', 'ranking', 'order', 'priority', 'sort', 'top'],
  nbe: ['next best', 'next-best', 'nbe', 'recommendation', 'move forward', 'suggest'],
  standing: ['standing', 'reputation', 'veracity', 'contribution', 'reliability', 'confidence'],
  progression: ['journey', 'progression', 'stage', 'depth', 'advance', 'onboard', 'ladder'],
  governance: ['govern', 'governance', 'ratify', 'policy', 'authority', 'gate', 'approval', 'sovereign'],
  composition: ['compose', 'composition', 'field', 'merge', 'coherence', 'assemble'],
  ontology: ['ontology', 'concept', 'definition', 'resolve', 'canonical', 'term'],
  representation: ['representation', 'render', 'modality', 'encode', 'manifest', 'image', 'text'],
  epistemology: ['knowledge', 'truth', 'reasoning', 'evidence', 'validated', 'invariant', 'operational'],
  'reasoning-compression': ['compress', 'compression', 'reuse', 'reasoning', 'substrate'],
  'invariant-intelligence': ['invariant', 'constitutional', 'projection', 'field', 'substrate'],
};

export interface FieldExtraction {
  /** Estimated active field domains (invariant contexts), strongest first. */
  domains: string[];
  /** Per-domain hit counts (transparency — the "why"). */
  signals: Record<string, number>;
  /** Crude confidence in [0,1] — share of vocabulary domains that fired. */
  confidence: number;
  /** True when nothing matched (caller should fall back to an unscoped slice). */
  empty: boolean;
}

/**
 * Estimate the field context of an arbitrary input (v0 heuristic). Pure +
 * deterministic. `limit` caps the returned domains (strongest by hit count).
 */
export function extractField(input: string, limit = 4): FieldExtraction {
  const text = ` ${(input || '').toLowerCase()} `;
  const signals: Record<string, number> = {};
  for (const [domain, terms] of Object.entries(DOMAIN_VOCABULARY)) {
    let hits = 0;
    for (const term of terms) {
      // whole-word-ish: term surrounded by non-alphanumerics (handles phrases too).
      if (text.includes(` ${term} `) || text.includes(` ${term}`) || text.includes(`${term} `)) hits += 1;
    }
    if (hits > 0) signals[domain] = hits;
  }
  const domains = Object.entries(signals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([d]) => d);
  const totalDomains = Object.keys(DOMAIN_VOCABULARY).length;
  const confidence = Math.min(1, Object.keys(signals).length / totalDomains);
  return { domains, signals, confidence, empty: domains.length === 0 };
}

/**
 * The perception→projection path: extract the field context from raw input, then
 * build the Field Snapshot for it. Returns the snapshot plus the extraction that
 * produced it (transparency). When perception finds nothing, grounds unscoped
 * (the whole highest-standing slice) so the caller is never left empty.
 * Guarded — a DB failure yields a null snapshot with the extraction intact.
 */
export async function groundFromInput(
  input: string,
  extra?: Partial<GroundingContext>,
): Promise<{ extraction: FieldExtraction; snapshot: FieldSnapshot | null }> {
  const extraction = extractField(input);
  const context: GroundingContext = {
    ...extra,
    domains: extraction.empty ? extra?.domains : extraction.domains,
    limit: extra?.limit ?? 8,
  };
  try {
    const snapshot = await computeFieldSnapshot(context);
    return { extraction, snapshot };
  } catch {
    return { extraction, snapshot: null };
  }
}

/** Convenience: the perceived slice items (or empty) for a raw input. */
export async function perceiveSlice(input: string): Promise<InvariantSlice['items']> {
  const { snapshot } = await groundFromInput(input);
  return snapshot?.slice.items ?? [];
}
