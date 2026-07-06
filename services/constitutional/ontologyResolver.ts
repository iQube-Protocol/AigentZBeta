/**
 * Canonical Ontology Service — the runtime resolver (CFS-015, Strand One).
 *
 * Constitutional principle: canonical ontology takes precedence over
 * conversational inference — names, entities, primitives, and protocols
 * resolve against the terminology canon (docs/platform-ontology.md) and the
 * invariant ontology BEFORE reasoning. Purpose: reduce context drift,
 * maintain canonical terminology, guarantee constitutional consistency.
 *
 * Two resolution sources:
 *   1. The terminology canon — parsed from docs/platform-ontology.md at first
 *      use (fs, cached per process; consuming routes must trace the file via
 *      outputFileTracingIncludes). A built-in mirror of the same terms is the
 *      graceful fallback when the file isn't bundled — the doc remains the
 *      source of truth and the canary test guards the mirror against drift.
 *   2. The invariant ontology — a curated concept→seed-id map for the core
 *      constitutional concepts (Standing, Reach, Truth, personhood, fields,
 *      sequencing, …). Every mapped id is asserted to exist in
 *      canonical-invariants.seed.json by tests/constitutional-contracts.test.ts.
 *
 * Server-only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OntologyResolution, ResolvedTerm } from '@/types/constitutional';
import { getCanonVersionStamp } from '@/services/invariants/store';

// ---------------------------------------------------------------------------
// Terminology canon
// ---------------------------------------------------------------------------

interface CanonTerm {
  /** Canonical display form, e.g. "BlakQube". */
  canonical: string;
  /** Forbidden variant spellings — the doc's own `never "…", "…"` lists.
   * Drift can differ by CHARACTERS ("Black Cube" → BlakQube), not just
   * separators, so aliases are first-class resolution inputs. */
  aliases: string[];
}

/**
 * Built-in mirror of docs/platform-ontology.md §terms — fallback only.
 * The doc is the source of truth; drift here is caught by the canary test
 * (which parses the doc and compares).
 */
const BUILTIN_CANON: CanonTerm[] = [
  { canonical: 'BlakQube', aliases: ['Black Cube', 'Black Qube', 'black_cube', 'blakqube'] },
  { canonical: 'aigentMe', aliases: ['Agent Me', 'AgentMe', 'agent-me', 'aigent me'] },
  { canonical: 'iQube', aliases: ['iqube', 'IQube', 'I-Qube'] },
  { canonical: 'iQube Protocol', aliases: [] },
  { canonical: 'AigentZ', aliases: [] },
  { canonical: 'PSC-001', aliases: [] },
  { canonical: 'DVN', aliases: [] },
  { canonical: 'MAF', aliases: [] },
];

/** §headings in the canon docs that are not terms. */
const NON_TERM_SECTIONS = new Set(['Enforcement']);

/**
 * The terminology-canon SOURCE DOCS, in load order. Both use the same
 * format contract: one term per `## heading`, forbidden variants on lines
 * containing `never "…"`. The Constitutional Glossary (CFS-015 amendment
 * 2026-07-06) carries the program vocabulary — Constitutional Computing,
 * Consequence Engineering, Sovereign Survivability, … — so every agent
 * resolves against ONE constitutional vocabulary.
 */
const CANON_SOURCES = [
  'docs/platform-ontology.md',
  'codexes/packs/agentiq/foundation/constitutional-glossary.md',
];

function parseCanonDoc(raw: string): CanonTerm[] {
  const terms: CanonTerm[] = [];
  // Split into sections at `## Term` headings; harvest each section's
  // forbidden variants from its `never "…", "…"` line(s).
  const sections = raw.split(/^## /m).slice(1);
  for (const section of sections) {
    const heading = section.slice(0, section.indexOf('\n')).trim();
    if (NON_TERM_SECTIONS.has(heading)) continue;
    const aliases: string[] = [];
    for (const neverLine of section.matchAll(/never ((?:"[^"]+"[^"\n]*)+)/g)) {
      for (const quoted of neverLine[1].matchAll(/"([^"]+)"/g)) {
        if (quoted[1].toLowerCase() !== heading.toLowerCase()) aliases.push(quoted[1]);
      }
    }
    terms.push({ canonical: heading, aliases });
  }
  return terms;
}

let canonCache: CanonTerm[] | null = null;

export function loadTerminologyCanon(): CanonTerm[] {
  if (canonCache) return canonCache;
  const terms: CanonTerm[] = [];
  const seen = new Set<string>();
  for (const source of CANON_SOURCES) {
    try {
      const raw = readFileSync(join(process.cwd(), source), 'utf-8');
      for (const term of parseCanonDoc(raw)) {
        const key = term.canonical.toLowerCase();
        if (seen.has(key)) continue; // first source wins on collision
        seen.add(key);
        terms.push(term);
      }
    } catch {
      // source unavailable (e.g. untraced bundle) — continue with the rest
    }
  }
  canonCache = terms.length > 0 ? terms : BUILTIN_CANON;
  return canonCache;
}

/**
 * Tolerant matcher for a canonical term: case-insensitive, separators
 * (space/hyphen/underscore) optional between its tokens — so "black qube",
 * "iqube", "psc 001", and "agent me"-class drift all resolve to canon.
 */
function termPattern(canonical: string): RegExp {
  const tokens = canonical.split(/[\s-]+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // BlakQube-style single tokens also match their common drift spellings by
  // allowing an optional separator before an interior capital-run boundary.
  const body =
    tokens.length > 1
      ? tokens.join('[\\s_-]*')
      : tokens[0].replace(/([a-z])(?=[A-Z])/g, '$1[\\s_-]*');
  return new RegExp(`\\b${body}\\b`, 'i');
}

// ---------------------------------------------------------------------------
// Invariant-ontology concept map
// ---------------------------------------------------------------------------

/**
 * Core constitutional concepts → governing seed invariants. Curated, small,
 * and canary-guarded: every id must exist in canonical-invariants.seed.json.
 */
export const CONCEPT_SEEDS: Record<string, string[]> = {
  standing: ['inv.constitutional.012', 'inv.constitutional.061'],
  reach: ['inv.constitutional.062'],
  truth: ['inv.constitutional.060'],
  personhood: ['inv.constitutional.011', 'inv.constitutional.063'],
  individualization: ['inv.constitutional.064', 'inv.constitutional.065'],
  'invariant field': ['inv.reasoning.081'],
  sequencing: ['inv.constitutional.078', 'inv.reasoning.095'],
  remix: ['inv.reasoning.096'],
  coherence: ['inv.experience.070', 'inv.constitutional.080'],
  composition: ['inv.experience.072'],
  'platform sovereignty': ['inv.sovereignty.100', 'inv.sovereignty.103'],
  'commercial independence': ['inv.sovereignty.103'],
  'provider choice': ['inv.sovereignty.102'],
  'constitutional cybernetics': ['inv.cybernetics.108', 'inv.cybernetics.110'],
  'constitutional feedback': ['inv.cybernetics.109'],
  'dynamic constitutional interaction runtime': ['inv.interaction.112', 'inv.interaction.118'],
  'behavioural invariant': ['inv.interaction.115'],
};

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/** Drift candidates: Qube-flavoured or aigent-flavoured tokens that SHOULD
 * resolve against canon; surfaced as unresolved when they don't. */
const DRIFT_CANDIDATE = /\b(?:[a-z]+[\s_-]?[qc]ube[a-z]*|a[i]?gent[\s_-]?\w+)\b/gi;

export async function resolveOntology(text: string): Promise<OntologyResolution> {
  const resolved = new Map<string, ResolvedTerm>();

  // 1. Terminology canon — canonical form first, then the doc's own
  // forbidden-variant list (drift can differ by characters, not just
  // separators: "Black Cube" → BlakQube).
  for (const term of loadTerminologyCanon()) {
    let match = text.match(termPattern(term.canonical));
    if (!match) {
      for (const alias of term.aliases) {
        match = text.match(termPattern(alias));
        if (match) break;
      }
    }
    if (!match) continue;
    resolved.set(term.canonical, {
      term: match[0],
      canonical: term.canonical,
      source: 'terminology-canon',
      invariantIds: [],
    });
  }

  // 2. Invariant-ontology concepts. The merge lookup is case-insensitive:
  // a concept that also exists as a glossary/ontology canon term (e.g.
  // "Platform Sovereignty" heading + 'platform sovereignty' concept) merges
  // into ONE entry with source 'both' and the governing invariants attached,
  // instead of duplicating.
  for (const [concept, seedIds] of Object.entries(CONCEPT_SEEDS)) {
    const pattern = new RegExp(`\\b${concept.replace(/\s+/g, '[\\s_-]*')}\\b`, 'i');
    const match = text.match(pattern);
    if (!match) continue;
    const existing =
      resolved.get(concept) ??
      Array.from(resolved.values()).find(
        (r) => r.canonical.toLowerCase() === concept.toLowerCase(),
      );
    if (existing) {
      existing.source = 'both';
      existing.invariantIds = seedIds;
    } else {
      resolved.set(concept, {
        term: match[0],
        canonical: concept,
        source: 'invariant-ontology',
        invariantIds: seedIds,
      });
    }
  }

  // 3. Drift candidates that failed to resolve — surfaced, never dropped.
  const unresolved: string[] = [];
  const resolvedSurfaces = new Set(
    Array.from(resolved.values()).map((r) => r.term.toLowerCase().replace(/[\s_-]/g, '')),
  );
  for (const match of text.matchAll(DRIFT_CANDIDATE)) {
    const normalized = match[0].toLowerCase().replace(/[\s_-]/g, '');
    const hits = Array.from(resolved.values()).some(
      (r) =>
        r.canonical.toLowerCase().replace(/[\s_-]/g, '') === normalized ||
        resolvedSurfaces.has(normalized),
    );
    if (!hits && !unresolved.includes(match[0])) unresolved.push(match[0]);
  }

  return {
    resolvedTerms: Array.from(resolved.values()),
    unresolved,
    canonVersion: await getCanonVersionStamp().catch(() => 'unknown'),
  };
}

// ---------------------------------------------------------------------------
// ContextPack assembly (Context Service, CFS-015)
// ---------------------------------------------------------------------------

import type { ContextPack } from '@/types/constitutional';
import { buildInvariantSlice, citeInvariants, type GroundingContext } from '@/services/invariants/grounding';
import { getInvariantsBySeedIds } from '@/services/invariants/store';

/**
 * Assemble the ontology-resolved, invariant-grounded ContextPack for one
 * reasoning call: resolution precedes reasoning (CFS-015 principle 5).
 */
export async function assembleContextPack(
  text: string,
  context: GroundingContext = {},
): Promise<ContextPack> {
  const [resolution, slice] = await Promise.all([
    resolveOntology(text),
    buildInvariantSlice(context),
  ]);
  return {
    resolvedTerms: resolution.resolvedTerms,
    slice,
    canonVersion: resolution.canonVersion,
    assembledAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// System-prompt block + Reach citation (the copilot adoption surface)
// ---------------------------------------------------------------------------

/**
 * Compact system-prompt guidance from a resolution — canonical spellings the
 * reply MUST use, plus the governing invariants for concepts in play. Empty
 * string when nothing resolved (zero prompt cost).
 */
export function ontologyPromptBlock(resolution: OntologyResolution): string {
  if (resolution.resolvedTerms.length === 0 && resolution.unresolved.length === 0) return '';
  const lines: string[] = ['', '=== CANONICAL ONTOLOGY (resolution precedes reasoning) ==='];
  const canonTerms = resolution.resolvedTerms.filter((t) => t.source !== 'invariant-ontology');
  if (canonTerms.length > 0) {
    lines.push(
      `Canonical spellings in play — use EXACTLY these forms: ${canonTerms.map((t) => t.canonical).join(', ')}.`,
    );
  }
  const concepts = resolution.resolvedTerms.filter((t) => t.invariantIds.length > 0);
  for (const c of concepts) {
    lines.push(`"${c.canonical}" is governed by ${c.invariantIds.join(', ')} — stay consistent with them.`);
  }
  if (resolution.unresolved.length > 0) {
    lines.push(
      `Non-canonical term(s) detected: ${resolution.unresolved.join(', ')} — do not propagate; prefer canon terms or ask.`,
    );
  }
  return lines.join('\n');
}

/**
 * Runtime citation (Reach, Law XII) for the governing invariants of resolved
 * concepts: one batched seed→row lookup, then the canonical citation hook.
 * Fire-and-forget by design — callers never await this on the hot path.
 */
export async function citeResolvedConcepts(resolution: OntologyResolution): Promise<void> {
  const seedIds = Array.from(new Set(resolution.resolvedTerms.flatMap((t) => t.invariantIds)));
  if (seedIds.length === 0) return;
  const rows = await getInvariantsBySeedIds(seedIds);
  if (rows.length > 0) await citeInvariants(rows.map((r) => r.id));
}
