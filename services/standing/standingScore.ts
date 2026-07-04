/**
 * standingScore — compute a single legible Standing score for a persona.
 *
 * The Standing Charter defines Standing as "confidence in the veracity of
 * declarations." Today that veracity lives in the VSP system (verified facts),
 * while a separate contribution signal lives in crm_persona_reputation
 * (task-completion accrual). Nothing reconciled them into one number. This does.
 *
 * Score (0..100):
 *   - VERACITY (primary) — from approved/corrected VSP facts, weighted by the
 *     confidence level of each fact and by how many declaration domains are
 *     covered. This is the Standing-Charter sense of Standing.
 *   - CONTRIBUTION (secondary) — normalised crm_persona_reputation.standing_overall
 *     (the participation/accrual signal).
 *
 * Best-effort: every probe soft-fails to a neutral value if a migration is
 * pending. T1-safe output (caller passes personaId in; only aggregates out).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OperatorArchetype } from '@/services/iqube/experienceQube';

/** Confidence-level weights for verified facts (Standing Charter veracity). */
const CONFIDENCE_WEIGHT: Record<string, number> = {
  DOCUMENT_VERIFIED: 1.0,
  PRINCIPAL_VERIFIED: 0.85,
  AGENT_VERIFIED: 0.6,
  UNKNOWN: 0.3,
};

/**
 * Archetype-pathway → the declaration domains that pathway most expresses.
 * The unified Standing score is NOT split per archetype; these are filter tags
 * that let a Tier 1+ persona read their single Standing through each pathway
 * lens (e.g. "how much of my verified standing is entrepreneurial?"). A domain
 * may belong to more than one pathway — pathways overlap by design.
 */
const ARCHETYPE_DOMAINS: Record<OperatorArchetype, string[]> = {
  entrepreneurial: ['founder', 'professional', 'validation', 'recognition'],
  technical: ['professional', 'education', 'publications', 'validation', 'extraordinary_ability'],
  creative: ['media', 'publications', 'speaking', 'recognition'],
  citizen: ['identity', 'validation', 'recognition', 'professional'],
};

export const ARCHETYPE_PATHWAYS = Object.keys(ARCHETYPE_DOMAINS) as OperatorArchetype[];

/** A per-pathway view of the unified Standing — a filter tag, not a separate score. */
export interface ArchetypePathwayTag {
  pathway: OperatorArchetype;
  /** Pathway veracity 0..100 — the veracity math restricted to this pathway's domains. */
  pathwayScore: number;
  /** Verified facts that fall in this pathway's domains. */
  factCount: number;
  /** Distinct pathway domains covered. */
  domainsCovered: number;
  /** True when this is the persona's declared operatorArchetype. */
  isActive: boolean;
}

/** Declaration domains we expect a well-formed Standing profile to span. */
const STANDING_DOMAINS = [
  'identity',
  'education',
  'professional',
  'founder',
  'recognition',
  'publications',
  'media',
  'speaking',
  'validation',
  'extraordinary_ability',
];

export interface StandingScoreBreakdown {
  /** Composite 0..100. */
  score: number;
  /** Veracity sub-score 0..100 (from verified VSP facts). */
  veracityScore: number;
  /** Contribution sub-score 0..100 (from reputation accrual). */
  contributionScore: number;
  /** 0..4 bucket derived from the composite (parity with existing dot scale). */
  bucket: number;
  /** Distinct declaration domains covered by verified facts. */
  domainsCovered: number;
  /** Verified (approved/corrected) fact count. */
  verifiedFactCount: number;
  /** Whether the persona has a compiled, passport-anchored VSP. */
  hasCompiledVsp: boolean;
  /** Whether Standing is sufficient to qualify for downstream surfaces. */
  qualified: boolean;
  /**
   * Archetype-pathway filter tags over the SAME unified score. Populated only
   * when `includePathwayTags` is set (a Tier 1 / sovereignAccess entitlement) —
   * free Citizens get the unified score with no pathway breakdown.
   */
  pathwayTags?: ArchetypePathwayTag[];
}

export interface ComputeStandingOptions {
  /** Tier 1+ entitlement — include the archetype-pathway breakdown. */
  includePathwayTags?: boolean;
  /** The persona's declared archetype, used to flag the active pathway tag. */
  operatorArchetype?: OperatorArchetype | null;
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Standing qualifies a persona once a VSP is compiled OR the score clears 25. */
const QUALIFY_THRESHOLD = 25;

export async function computeStandingScore(
  admin: SupabaseClient,
  personaId: string,
  options?: ComputeStandingOptions,
): Promise<StandingScoreBreakdown> {
  let veracityScore = 0;
  let contributionScore = 0;
  let domainsCovered = 0;
  let verifiedFactCount = 0;
  let hasCompiledVsp = false;
  // Per-domain accumulators for the archetype-pathway breakdown.
  const domainWeight = new Map<string, number>();
  const domainCount = new Map<string, number>();

  // ── Veracity from VSP facts ────────────────────────────────────────────────
  try {
    const { data: profiles } = await admin
      .from('vsp_profiles')
      .select('id, compiled_at')
      .eq('owner_persona_id', personaId);
    const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);
    hasCompiledVsp = (profiles ?? []).some(
      (p: { compiled_at?: string | null }) => Boolean(p.compiled_at),
    );

    if (profileIds.length > 0) {
      const { data: facts } = await admin
        .from('vsp_facts')
        .select('domain, confidence, status')
        .in('profile_id', profileIds);
      const verified = (facts ?? []).filter((f: { status?: string }) =>
        ['approved', 'corrected'].includes(String(f.status ?? '')),
      );
      verifiedFactCount = verified.length;
      const domains = new Set<string>();
      let weightSum = 0;
      for (const f of verified) {
        const conf = String((f as { confidence?: string }).confidence ?? 'UNKNOWN');
        const w = CONFIDENCE_WEIGHT[conf] ?? CONFIDENCE_WEIGHT.UNKNOWN;
        weightSum += w;
        const domain = String((f as { domain?: string }).domain ?? 'other');
        domains.add(domain);
        domainWeight.set(domain, (domainWeight.get(domain) ?? 0) + w);
        domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);
      }
      domainsCovered = domains.size;

      if (verifiedFactCount > 0) {
        // Average confidence weight (0..1) → quality of the verified facts.
        const avgConfidence = weightSum / verifiedFactCount;
        // Domain coverage breadth (0..1).
        const coverage = Math.min(1, domainsCovered / STANDING_DOMAINS.length);
        // Volume saturation — diminishing returns past ~12 verified facts.
        const volume = Math.min(1, verifiedFactCount / 12);
        // Veracity = quality-led, with coverage + volume rounding it out.
        veracityScore = clamp((avgConfidence * 0.55 + coverage * 0.3 + volume * 0.15) * 100);
        // A compiled, passport-anchored VSP is a meaningful veracity lift.
        if (hasCompiledVsp) veracityScore = clamp(veracityScore + 10);
      }
    }
  } catch {
    /* VSP migration pending */
  }

  // ── Contribution from reputation accrual ───────────────────────────────────
  try {
    const { data } = await admin
      .from('crm_persona_reputation')
      .select('standing_overall')
      .eq('persona_id', personaId)
      .maybeSingle();
    const overall =
      data?.standing_overall == null ? 0 : Number(data.standing_overall);
    // standing_overall is an unbounded accrual; saturate at 100 for the sub-score.
    contributionScore = clamp(overall);
  } catch {
    /* reputation migration pending */
  }

  // ── Composite ──────────────────────────────────────────────────────────────
  // Veracity-led (the Standing-Charter sense). Contribution rounds it out, and
  // becomes the whole signal only when no VSP veracity exists yet.
  const score =
    veracityScore > 0
      ? clamp(veracityScore * 0.7 + contributionScore * 0.3)
      : clamp(contributionScore);

  const bucket = Math.min(4, Math.floor(score / 25) + (score > 0 && score < 25 ? 1 : 0));
  const qualified = hasCompiledVsp || score >= QUALIFY_THRESHOLD;

  // ── Archetype-pathway tags (Tier 1+ only) ──────────────────────────────────
  // A filter over the SAME unified standing: for each pathway, score the
  // veracity contributed by that pathway's domains. Reuses the same
  // quality/coverage/volume blend as the unified veracity, restricted to the
  // pathway's domain set. The unified score is unchanged.
  let pathwayTags: ArchetypePathwayTag[] | undefined;
  if (options?.includePathwayTags) {
    const active = options.operatorArchetype ?? null;
    pathwayTags = ARCHETYPE_PATHWAYS.map((pathway) => {
      const domains = ARCHETYPE_DOMAINS[pathway];
      let wSum = 0;
      let count = 0;
      let covered = 0;
      for (const d of domains) {
        const c = domainCount.get(d) ?? 0;
        if (c > 0) {
          covered += 1;
          count += c;
          wSum += domainWeight.get(d) ?? 0;
        }
      }
      let pathwayScore = 0;
      if (count > 0) {
        const avgConfidence = wSum / count;
        const coverage = Math.min(1, covered / domains.length);
        const volume = Math.min(1, count / 8); // pathways saturate sooner than the whole
        pathwayScore = clamp((avgConfidence * 0.55 + coverage * 0.3 + volume * 0.15) * 100);
      }
      return {
        pathway,
        pathwayScore,
        factCount: count,
        domainsCovered: covered,
        isActive: active === pathway,
      };
    });
  }

  return {
    score,
    veracityScore,
    contributionScore,
    bucket,
    domainsCovered,
    verifiedFactCount,
    hasCompiledVsp,
    qualified,
    ...(pathwayTags ? { pathwayTags } : {}),
  };
}
