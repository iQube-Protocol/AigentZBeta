/**
 * knowledgeResolution — the Knowledge Resolution Engine, Phase 0 (CFS-040 /
 * PRD-KRE-001, RATIFIED 2026-07-17).
 *
 * The layer between resolution and reasoning: given the constitutional field an
 * intent requires (the IRE, CFS-037), decide whether that field is already
 * realised in knowledge. The governing principle, now a constitutional invariant
 * governing knowledge itself:
 *
 *     REUSE where possible. CREATE where needed.
 *
 * Phase 0 is the reuse-before-create DECISION NODE — the pure heart of the
 * six-stage loop (Discover → Evaluate → Compose → Realise → Register → Reuse):
 * from discovery candidates, recommend `reuse` (one iQube covers the field),
 * `compose` (a small set together covers it), or `create` (the field is not
 * realised — generation belongs here, gap-gated).
 *
 * RECOMMEND, NEVER AUTO (Law XI): the KRE returns a recommendation; the caller
 * acts. It never auto-generates — creating an iQube when one exists is the
 * CS-001 duplicate-capability defect at the knowledge level, which this node
 * exists to PREVENT.
 *
 * Pure + isomorphic. Discovery is INJECTED (the caller maps
 * `discoverCapabilities` / `recommendProducers` output to candidates); proximity
 * is the constitutional-proximity signal (CCR) — until that ships, callers pass
 * the existing trust score as the proxy (honest, named).
 */

export interface KnowledgeCandidate {
  id: string;
  label: string;
  /** Constitutional proximity to the field's region [0,1] (CCR; trust proxy today). */
  proximity: number;
  /** How much of the resolved field this candidate covers [0,1]. */
  completeness: number;
}

export type KnowledgeStrategy = 'reuse' | 'compose' | 'create';

export interface KnowledgeResolution {
  strategy: KnowledgeStrategy;
  rationale: string;
  /** The single iQube to reuse (strategy 'reuse'). */
  reuse: KnowledgeCandidate | null;
  /** The set to compose into one constitutional context (strategy 'compose'). */
  compose: KnowledgeCandidate[];
  /** The gap to realise (strategy 'create') — generation is gated by this. */
  createGap: string | null;
  /** ALWAYS a recommendation — the caller acts; the KRE never auto-generates (Law XI). */
  recommendationOnly: true;
}

// Declared v0 thresholds (candidates for CCR-governed calibration).
export const REUSE_PROXIMITY = 0.7;
export const REUSE_COMPLETENESS = 0.8;
export const COMPOSE_COMBINED_COMPLETENESS = 0.8;
export const COMPOSE_MIN_PROXIMITY = 0.3;

/** Probabilistic union of coverage (independence proxy) — how much a set
 *  together covers the field. Pure. */
function unionCoverage(prev: number, next: number): number {
  return Math.min(1, prev + next * (1 - prev));
}

/**
 * The reuse-before-create decision. PURE. `candidates` are discovery results
 * (constitutional-proximity ranked); `fieldLabel` names the resolved field for
 * the rationale. Never mutates, never generates — recommendation only.
 */
export function decideKnowledgeStrategy(
  candidates: KnowledgeCandidate[],
  fieldLabel = 'the resolved field',
): KnowledgeResolution {
  const ranked = candidates
    .filter((c) => c.proximity > 0)
    .sort((a, b) => b.proximity * b.completeness - a.proximity * a.completeness);
  const best = ranked[0];

  // Reuse — one candidate covers the field with high proximity + completeness.
  if (best && best.proximity >= REUSE_PROXIMITY && best.completeness >= REUSE_COMPLETENESS) {
    return {
      strategy: 'reuse',
      rationale: `"${best.label}" covers ${fieldLabel} (proximity ${best.proximity.toFixed(2)}, completeness ${best.completeness.toFixed(2)}) — reuse, do not rebuild`,
      reuse: best,
      compose: [],
      createGap: null,
      recommendationOnly: true,
    };
  }

  // Compose — a small set together covers the field (union of coverage).
  const composeSet: KnowledgeCandidate[] = [];
  let combined = 0;
  for (const c of ranked) {
    if (c.proximity < COMPOSE_MIN_PROXIMITY) break;
    composeSet.push(c);
    combined = unionCoverage(combined, c.completeness);
    if (combined >= COMPOSE_COMBINED_COMPLETENESS) break;
  }
  if (composeSet.length >= 2 && combined >= COMPOSE_COMBINED_COMPLETENESS) {
    return {
      strategy: 'compose',
      rationale: `${composeSet.length} iQubes together cover ${fieldLabel} (combined ${combined.toFixed(2)}) — compose, do not rebuild`,
      reuse: null,
      compose: composeSet,
      createGap: null,
      recommendationOnly: true,
    };
  }

  // Create — the field is not realised; specify the gap. Generation belongs
  // here (gap-gated), then the realisation is registered (Constitutional
  // Acceptance, CFS-032) → discoverable + reusable forever.
  const covered = best ? best.completeness : 0;
  return {
    strategy: 'create',
    rationale: `no existing iQube covers ${fieldLabel} (best completeness ${covered.toFixed(2)}) — create the missing constitutional knowledge, then register it for reuse`,
    reuse: null,
    compose: [],
    createGap: fieldLabel,
    recommendationOnly: true,
  };
}

/** Compact trace line for pipeline/observability surfaces. Pure. */
export function describeKnowledgeResolution(r: KnowledgeResolution): string {
  const detail =
    r.strategy === 'reuse'
      ? r.reuse?.label ?? ''
      : r.strategy === 'compose'
      ? `${r.compose.length} iQubes`
      : r.createGap ?? '';
  return `KRE: ${r.strategy}${detail ? ` (${detail})` : ''} — recommendation only`;
}
