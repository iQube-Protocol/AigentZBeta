/**
 * LLM-based NBE reranker — Aigent Me Phase 3.b.
 *
 * Sits *after* the deterministic catalogue filter (`selectNbeCandidates`)
 * and reorders the already-eligible candidates against the persona's
 * inferred strategy, primary goal, and recent activity profile.
 *
 * Design notes:
 *   - Deterministic baseline is the source of truth for *eligibility*.
 *     The LLM only reorders the survivors; it never adds or invents.
 *   - Output is validated against the input id set; any unknown id is
 *     dropped and the deterministic order is used as the tie-breaker.
 *   - Falls back silently to the input order when no key, on parse
 *     failure, or on timeout — so reliability of the brief is preserved.
 */

import type { NbeCandidate } from '@/services/orchestration/nbeCatalog';
import type { InferredStrategy } from '@/services/strategy/strategyInference';
import type { ActiveCartridgeSlug, ExperienceStage } from '@/services/iqube/experienceQube';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL =
  process.env.NBE_RERANK_LLM_MODEL_ANTHROPIC || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You rerank an eligible Next-Best-Experience (NBE) candidate list against a persona's inferred strategy and stage.

Return ONE JSON object exactly:
{ "order": [ "<nbe id>", ... ] }

Rules:
- Use only ids present in the input list. Do not add, omit, or rename.
- Order from most-to-least impactful for THIS persona right now.
- Bias toward the candidate that:
  1. clears the persona's biggest current blocker, OR
  2. directly serves the inferred-strategy headline / primary goal, OR
  3. unlocks compounding moves (e.g. workspace draft → outreach).
- Penalise candidates that duplicate work the persona has already done.
- No prose, no markdown.`;

interface RerankContext {
  currentStage: ExperienceStage;
  activeCartridges: ActiveCartridgeSlug[];
  primaryGoal: string | null;
  experienceGoals: string[];
  strategy: InferredStrategy | null;
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

async function callAnthropic(userPrompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
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
        max_tokens: 400,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const block = data?.content?.find((b) => b?.type === 'text');
    return block?.text ? stripJsonFences(block.text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function summariseForPrompt(
  candidates: NbeCandidate[],
  ctx: RerankContext,
): string {
  return JSON.stringify(
    {
      persona: {
        currentStage: ctx.currentStage,
        activeCartridges: ctx.activeCartridges,
        primaryGoal: ctx.primaryGoal,
        experienceGoals: ctx.experienceGoals.slice(0, 16),
      },
      strategy: ctx.strategy
        ? {
            headline: ctx.strategy.headline,
            blockers: ctx.strategy.venturePosture.blockers,
            unlocks: ctx.strategy.venturePosture.unlocks,
            coherence: ctx.strategy.coherenceNote,
          }
        : null,
      candidates: candidates.map((c) => ({
        id: c.id,
        label: c.label,
        rationale: c.rationale,
        cartridge: c.cartridge,
        weight: c.weight,
        effort: c.effort,
        impact: c.impact,
        approvalRequired: c.approvalRequired,
        suggestedArtifact: c.suggestedArtifact ?? null,
        specialist: c.specialist ?? null,
      })),
    },
    null,
    2,
  );
}

/**
 * Reorder a deterministically-filtered candidate list using an LLM pass.
 * Returns the original list (unchanged order) on any failure path.
 */
export async function llmRerankNbeCandidates(
  candidates: NbeCandidate[],
  ctx: RerankContext,
): Promise<NbeCandidate[]> {
  if (!ANTHROPIC_API_KEY) return candidates;
  if (candidates.length < 2) return candidates;

  const raw = await callAnthropic(summariseForPrompt(candidates, ctx));
  if (!raw) return candidates;

  let parsed: { order?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return candidates;
  }
  if (!parsed || !Array.isArray(parsed.order)) return candidates;

  const validIds = new Set(candidates.map((c) => c.id));
  const seen = new Set<string>();
  const ranked: NbeCandidate[] = [];
  for (const id of parsed.order) {
    if (typeof id !== 'string') continue;
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const hit = candidates.find((c) => c.id === id);
    if (hit) ranked.push(hit);
  }
  // Append any deterministic survivors the LLM dropped, in their original
  // weighted order — preserves catalogue intent as a tie-breaker.
  for (const c of candidates) {
    if (!seen.has(c.id)) ranked.push(c);
  }
  return ranked;
}
