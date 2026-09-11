/**
 * StrategyInference — Aigent Me Phase 3.b
 *
 * Reads a persona's ExperienceQube (meta + blak) and PersonalGuide and
 * synthesises a textured, correlated strategy narrative used by:
 *   - Strategy tab UI (prose surface, right column)
 *   - briefBuilder → NBE selection (richer signal than raw experienceGoals)
 *
 * Two layers:
 *   1. Deterministic baseline — rule-based scaffolding always present.
 *   2. LLM enrichment — Claude pass producing prose + correlation reasoning.
 *      Falls back to deterministic-only when no ANTHROPIC_API_KEY.
 *
 * Persisted to experience_qubes.inferred_strategy with inferred_at; reused
 * when fresh (within 24h AND not older than the qube's updated_at).
 *
 * Privacy: input includes BlakQube payload (T0). Output is T1-safe — prose
 * summary + structured correlations + keyword hints. Never echo raw BlakQube
 * fields in the persisted result.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getExperienceQube,
  getPersonalGuide,
  type ActiveCartridgeSlug,
  type ExperienceQubeRecord,
} from '@/services/iqube/experienceQube';
import {
  ALIGNMENT_LABEL,
  SPHERE_LABEL,
  type PersonalGuideData,
  type SphereAxis,
} from '@/types/experienceGuide';
import {
  GROUNDING_MANDATE,
  collectGroundedNumbers,
  groundProse,
} from '@/services/orchestration/groundingContract';

// ─────────────────────────────────────────────────────────────────────────
// Public types — T1-safe.
// ─────────────────────────────────────────────────────────────────────────

export type CorrelationRelation =
  | 'reinforces'
  | 'depends-on'
  | 'tradeoff'
  | 'shared-artifact';

export interface StrategyCorrelation {
  from: string;
  to: string;
  relation: CorrelationRelation;
  explanation: string;
}

export interface InferredStrategy {
  /** One-line framing surfaced as the prose-card headline. */
  headline: string;
  /** Venture-layer narrative (drawn from ExperienceModel + cartridges + KPIs). */
  venturePosture: {
    paragraph: string;
    primaryAxis: string;
    blockers: string[];
    unlocks: string[];
  };
  /** Personal-layer narrative (drawn from ExperienceGuide). */
  personalPosture: {
    paragraph: string;
    driveLine: string;
    alignmentNote: string;
  };
  /** How the venture and personal posture interact. */
  coherenceNote: string;
  /** Correlations between goals / partners / KPIs. */
  correlations: StrategyCorrelation[];
  /** Cues consumed by the NBE selector. */
  nbeHints: {
    keywords: string[];
    cartridgeBias: ActiveCartridgeSlug[];
    preferArtifacts: string[];
    avoidIds: string[];
  };
  confidence: 'low' | 'medium' | 'high';
  /** ISO timestamp the inference was generated. */
  generatedAt: string;
  /** Whether the LLM pass succeeded; false → deterministic-only. */
  llmEnriched: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Cache freshness.
// ─────────────────────────────────────────────────────────────────────────

const TTL_MS = 24 * 60 * 60 * 1000;

function isFresh(inferredAt: string | null, qubeUpdatedAt: string | null): boolean {
  if (!inferredAt) return false;
  const inferredMs = Date.parse(inferredAt);
  if (!Number.isFinite(inferredMs)) return false;
  if (Date.now() - inferredMs > TTL_MS) return false;
  if (qubeUpdatedAt) {
    const updatedMs = Date.parse(qubeUpdatedAt);
    if (Number.isFinite(updatedMs) && updatedMs > inferredMs) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic baseline.
// ─────────────────────────────────────────────────────────────────────────

function pickBlockers(qube: ExperienceQubeRecord): string[] {
  const blockers: string[] = [];
  const blak = qube.blak;
  if ((blak.experienceGoals?.length ?? 0) === 0) blockers.push('No active ExperienceGoals set');
  if ((blak.priorityPartners?.length ?? 0) === 0 && qube.meta.activeCartridges.includes('marketa')) {
    blockers.push('Marketa cartridge active but no priority partners declared');
  }
  if (!blak.activeKpis || Object.keys(blak.activeKpis).length === 0) {
    blockers.push('No active KPIs — progress is unmeasurable');
  }
  return blockers;
}

function pickUnlocks(qube: ExperienceQubeRecord): string[] {
  const unlocks: string[] = [];
  const blak = qube.blak;
  if ((blak.priorityPartners?.length ?? 0) > 0) {
    unlocks.push(`Active partner pipeline (${blak.priorityPartners!.length})`);
  }
  if ((blak.activeCampaigns?.length ?? 0) > 0) {
    unlocks.push(`Campaigns in motion (${blak.activeCampaigns!.length})`);
  }
  if ((blak.experienceGoals?.length ?? 0) > 0) {
    unlocks.push('ExperienceGoals declared');
  }
  return unlocks;
}

function deterministicBaseline(
  qube: ExperienceQubeRecord,
  guide: PersonalGuideData | null,
): InferredStrategy {
  const cartridges = qube.meta.activeCartridges;
  const primaryAxis =
    qube.meta.experienceName ||
    qube.meta.primaryGoal ||
    `${qube.meta.experienceType.replace(/_/g, ' ')} build`;

  const blockers = pickBlockers(qube);
  const unlocks = pickUnlocks(qube);

  const venturePara = [
    `${primaryAxis} — currently in ${qube.meta.currentStage.replace(/_/g, ' ')}.`,
    cartridges.length > 0
      ? `Operating through ${cartridges.join(', ')}.`
      : 'No active cartridges yet.',
    unlocks.length > 0 ? `Unlocks: ${unlocks.join('; ')}.` : '',
    blockers.length > 0 ? `Blockers: ${blockers.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const driveLine = guide?.focusIntent ?? 'No focus intent declared';
  const alignmentNote = guide
    ? `${ALIGNMENT_LABEL[guide.alignmentState]} alignment, ${
        guide.precedenceMode === 'auto'
          ? 'auto precedence'
          : `${SPHERE_LABEL[guide.precedenceMode as SphereAxis]}-first precedence`
      }`
    : 'No personal guide configured';

  const personalPara = guide
    ? `${driveLine}. ${alignmentNote}. ${(guide.repairRisks ?? []).length} repair risk${(guide.repairRisks ?? []).length === 1 ? '' : 's'} active.`
    : 'Personal posture is not yet declared — set up the ExperienceGuide for a coherent personal layer.';

  const coherenceNote =
    guide && qube.meta.primaryGoal
      ? `Venture posture (${primaryAxis}) and personal focus (${driveLine}) form the coherence loop — the strongest moves sit at their intersection.`
      : 'Coherence cannot be assessed until both layers are set up.';

  const correlations: StrategyCorrelation[] = [];
  if ((qube.blak.priorityPartners?.length ?? 0) > 0 && cartridges.includes('marketa')) {
    correlations.push({
      from: 'priorityPartners',
      to: 'marketa cartridge',
      relation: 'reinforces',
      explanation: 'Priority partners feed marketa motion — campaign briefs land on real targets.',
    });
  }
  if (cartridges.includes('knyt') && (qube.blak.activeCampaigns?.length ?? 0) > 0) {
    correlations.push({
      from: 'KNYT cartridge',
      to: 'activeCampaigns',
      relation: 'shared-artifact',
      explanation: 'KNYT activation and active campaigns share investor-update artifacts.',
    });
  }
  if (qube.blak.experienceGoals?.length && qube.meta.activeCartridges.includes('mvl')) {
    correlations.push({
      from: 'experienceGoals',
      to: 'MVL progress',
      relation: 'depends-on',
      explanation: 'Venture progress reporting only resonates when tied to declared goals.',
    });
  }

  // Keyword pool for NBE rerank.
  const keywords = new Set<string>();
  (qube.blak.experienceGoals ?? []).forEach((g) =>
    g
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter((w) => w.length > 3)
      .forEach((w) => keywords.add(w)),
  );
  if (qube.meta.primaryGoal) {
    qube.meta.primaryGoal
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter((w) => w.length > 3)
      .forEach((w) => keywords.add(w));
  }

  const confidence: InferredStrategy['confidence'] =
    blockers.length === 0 && unlocks.length >= 2
      ? 'high'
      : blockers.length <= 1 && unlocks.length >= 1
        ? 'medium'
        : 'low';

  return {
    headline: `${primaryAxis} — ${qube.meta.currentStage.replace(/_/g, ' ')}`,
    venturePosture: {
      paragraph: venturePara,
      primaryAxis,
      blockers,
      unlocks,
    },
    personalPosture: {
      paragraph: personalPara,
      driveLine,
      alignmentNote,
    },
    coherenceNote,
    correlations,
    nbeHints: {
      keywords: Array.from(keywords),
      cartridgeBias: cartridges,
      preferArtifacts: [],
      avoidIds: [],
    },
    confidence,
    generatedAt: new Date().toISOString(),
    llmEnriched: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// LLM enrichment.
// ─────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL =
  process.env.STRATEGY_LLM_MODEL_ANTHROPIC || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are a strategist synthesising a persona's venture and personal posture into a short, correlated narrative.

Return ONE JSON object with this exact shape:
{
  "headline": string,
  "venturePosture": { "paragraph": string, "primaryAxis": string, "blockers": string[], "unlocks": string[] },
  "personalPosture": { "paragraph": string, "driveLine": string, "alignmentNote": string },
  "coherenceNote": string,
  "correlations": [{ "from": string, "to": string, "relation": "reinforces"|"depends-on"|"tradeoff"|"shared-artifact", "explanation": string }],
  "nbeHints": { "keywords": string[], "cartridgeBias": string[], "preferArtifacts": string[], "avoidIds": string[] },
  "confidence": "low"|"medium"|"high"
}

Rules:
- Paragraphs: 2-3 sentences, concrete, non-generic. Reference the actual goals/partners/cartridges in the input.
- correlations: 2-5 entries showing how venture goals, partners, KPIs, and personal focus interact.
- nbeHints.keywords: lowercase, 5-12 short terms drawn from goals and partners.
- nbeHints.cartridgeBias: subset of ["metame","knyt","qriptopian","marketa","mvl"].
- nbeHints.preferArtifacts: from ["google-doc","gmail-draft","calendar-block","brief","venture-report"].
- No markdown, no prose outside JSON.

${GROUNDING_MANDATE}

This input is a DECLARED BASELINE — goals, partners, cartridges, and stage the operator set up. It contains NO achievement, traction, or metric data. Therefore your paragraphs MUST stay qualitative: describe posture, intent, and how declared goals/partners relate. Do NOT state numbers, percentages, customer/holder counts, revenue, or progress over time. If you cannot say something concrete without inventing a figure, describe the intent instead or say the data is not yet available.`;

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

async function callAnthropic(userPrompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1400,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[strategyInference] Anthropic returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const block = data?.content?.find((b) => b?.type === 'text');
    return block?.text ? stripJsonFences(block.text) : null;
  } catch (err) {
    console.warn(`[strategyInference] Anthropic call failed: ${err instanceof Error ? err.message : err}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function summariseForPrompt(
  qube: ExperienceQubeRecord,
  guide: PersonalGuideData | null,
): string {
  const m = qube.meta;
  const b = qube.blak;
  return JSON.stringify(
    {
      meta: {
        experienceName: m.experienceName,
        experienceType: m.experienceType,
        primaryGoal: m.primaryGoal,
        currentStage: m.currentStage,
        activeCartridges: m.activeCartridges,
        confidentialityDefault: m.confidentialityDefault,
      },
      blak: {
        experienceGoals: b.experienceGoals ?? [],
        strategicGoals: b.strategicGoals ?? [],
        priorityPartners: b.priorityPartners ?? [],
        activeCampaigns: b.activeCampaigns ?? [],
        activeKpisKeys: b.activeKpis ? Object.keys(b.activeKpis) : [],
        commercialGoalsKeys: b.commercialGoals ? Object.keys(b.commercialGoals) : [],
        operationalGoalsKeys: b.operationalGoals ? Object.keys(b.operationalGoals) : [],
      },
      personalGuide: guide
        ? {
            focusIntent: guide.focusIntent,
            alignmentState: guide.alignmentState,
            precedenceMode: guide.precedenceMode,
            repairRisksCount: (guide.repairRisks ?? []).length,
          }
        : null,
    },
    null,
    2,
  );
}

function safeParseAndValidate(
  raw: string,
  baseline: InferredStrategy,
  groundingSource: string,
): InferredStrategy {
  try {
    const parsed = JSON.parse(raw) as Partial<InferredStrategy>;
    // VALIDATION LAYER — reject any generated prose that introduces a number,
    // percentage, or temporal-trend claim not present in the grounding data.
    // The grounded set is drawn from the prompt input AND the deterministic
    // baseline (which is computed from real qube data, so its numbers are
    // legitimate). Scrubbed fields fall back to the grounded baseline prose.
    const grounded = collectGroundedNumbers(groundingSource, JSON.stringify(baseline));
    let scrubbed = false;
    const scrub = (text: unknown, fallback: string): string => {
      const r = groundProse(text, grounded, fallback);
      if (r.scrubbed) scrubbed = true;
      return r.text;
    };
    const headline = scrub(parsed.headline, baseline.headline);
    const venturePara = scrub(parsed.venturePosture?.paragraph, baseline.venturePosture.paragraph);
    const personalPara = scrub(parsed.personalPosture?.paragraph, baseline.personalPosture.paragraph);
    const coherence = scrub(parsed.coherenceNote, baseline.coherenceNote);
    // Drop any correlation whose explanation smuggles an ungrounded figure —
    // fabricated "depends-on" claims with invented metrics are the riskiest.
    const correlations = (Array.isArray(parsed.correlations)
      ? (parsed.correlations as StrategyCorrelation[]).filter(
          (c) => c && typeof c.from === 'string' && typeof c.to === 'string',
        )
      : baseline.correlations
    ).filter((c) => {
      const ok = groundProse(c.explanation, grounded, '').text !== '' || !c.explanation;
      if (!ok) scrubbed = true;
      return ok;
    });
    return {
      headline,
      venturePosture: {
        paragraph: venturePara,
        primaryAxis:
          typeof parsed.venturePosture?.primaryAxis === 'string'
            ? parsed.venturePosture.primaryAxis
            : baseline.venturePosture.primaryAxis,
        blockers: Array.isArray(parsed.venturePosture?.blockers)
          ? (parsed.venturePosture!.blockers as string[]).filter((s) => typeof s === 'string')
          : baseline.venturePosture.blockers,
        unlocks: Array.isArray(parsed.venturePosture?.unlocks)
          ? (parsed.venturePosture!.unlocks as string[]).filter((s) => typeof s === 'string')
          : baseline.venturePosture.unlocks,
      },
      personalPosture: {
        paragraph: personalPara,
        driveLine:
          typeof parsed.personalPosture?.driveLine === 'string'
            ? parsed.personalPosture.driveLine
            : baseline.personalPosture.driveLine,
        alignmentNote:
          typeof parsed.personalPosture?.alignmentNote === 'string'
            ? parsed.personalPosture.alignmentNote
            : baseline.personalPosture.alignmentNote,
      },
      coherenceNote: coherence,
      correlations,
      nbeHints: {
        keywords: Array.isArray(parsed.nbeHints?.keywords)
          ? (parsed.nbeHints!.keywords as string[]).filter((s) => typeof s === 'string')
          : baseline.nbeHints.keywords,
        cartridgeBias: Array.isArray(parsed.nbeHints?.cartridgeBias)
          ? (parsed.nbeHints!.cartridgeBias as ActiveCartridgeSlug[]).filter((s) =>
              ['metame', 'knyt', 'qriptopian', 'marketa', 'mvl'].includes(s as string),
            )
          : baseline.nbeHints.cartridgeBias,
        preferArtifacts: Array.isArray(parsed.nbeHints?.preferArtifacts)
          ? (parsed.nbeHints!.preferArtifacts as string[]).filter((s) => typeof s === 'string')
          : baseline.nbeHints.preferArtifacts,
        avoidIds: Array.isArray(parsed.nbeHints?.avoidIds)
          ? (parsed.nbeHints!.avoidIds as string[]).filter((s) => typeof s === 'string')
          : baseline.nbeHints.avoidIds,
      },
      // When the guard scrubbed ungrounded prose, the enrichment is partly
      // rejected — never report high confidence on a scrubbed result.
      confidence: scrubbed
        ? 'low'
        : parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
          ? parsed.confidence
          : baseline.confidence,
      generatedAt: new Date().toISOString(),
      llmEnriched: true,
    };
  } catch (err) {
    console.warn(`[strategyInference] LLM JSON parse failed: ${err instanceof Error ? err.message : err}`);
    return baseline;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public API.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get the inferred strategy for this persona. Reads cache; recomputes when
 * stale; persists the result back to experience_qubes.inferred_strategy.
 *
 * Returns `null` only when the persona has no ExperienceQube row at all —
 * in that case there's nothing to infer from.
 */
export async function inferStrategy(personaId: string): Promise<InferredStrategy | null> {
  const qube = await getExperienceQube(personaId);
  if (!qube) return null;
  const admin = getSupabaseServer();
  if (!admin) {
    const guide = await getPersonalGuide(personaId);
    return deterministicBaseline(qube, guide);
  }

  // Pull cache + updated_at.
  let cached: InferredStrategy | null = null;
  let inferredAt: string | null = null;
  let qubeUpdatedAt: string | null = null;
  try {
    const { data } = await admin
      .from('experience_qubes')
      .select('inferred_strategy, inferred_at, updated_at')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (data) {
      const row = data as {
        inferred_strategy: InferredStrategy | null;
        inferred_at: string | null;
        updated_at: string | null;
      };
      cached = row.inferred_strategy;
      inferredAt = row.inferred_at;
      qubeUpdatedAt = row.updated_at;
    }
  } catch (err) {
    console.warn(`[strategyInference] cache read failed: ${err instanceof Error ? err.message : err}`);
  }

  if (cached && isFresh(inferredAt, qubeUpdatedAt)) {
    return cached;
  }

  // Recompute.
  const guide = await getPersonalGuide(personaId);
  const baseline = deterministicBaseline(qube, guide);

  let result = baseline;
  const groundingSource = summariseForPrompt(qube, guide);
  const llmRaw = await callAnthropic(groundingSource);
  if (llmRaw) {
    result = safeParseAndValidate(llmRaw, baseline, groundingSource);
  }

  // Persist (best-effort; failure does not block the read).
  try {
    await admin
      .from('experience_qubes')
      .update({ inferred_strategy: result, inferred_at: result.generatedAt })
      .eq('persona_id', personaId);
  } catch (err) {
    console.warn(
      `[strategyInference] cache write failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  return result;
}

/**
 * Force-refresh — used by the "Refresh strategy" button in the UI.
 */
export async function refreshInferredStrategy(
  personaId: string,
): Promise<InferredStrategy | null> {
  const admin = getSupabaseServer();
  if (admin) {
    try {
      await admin
        .from('experience_qubes')
        .update({ inferred_at: null })
        .eq('persona_id', personaId);
    } catch {
      /* ignore — inferStrategy will still recompute when isFresh is false */
    }
  }
  return inferStrategy(personaId);
}
