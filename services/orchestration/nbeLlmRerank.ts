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
import type { ActiveCartridgeSlug, ExperienceStage, OperatorArchetype } from '@/services/iqube/experienceQube';
import { GROUNDING_MANDATE } from '@/services/orchestration/groundingContract';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL =
  process.env.NBE_RERANK_LLM_MODEL_ANTHROPIC || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You rerank an eligible Next-Best-Experience (NBE) candidate list against a persona's inferred strategy and stage.

Return ONE JSON object exactly:
{
  "order": [ "<nbe id>", ... ],
  "topReason": "<one short sentence — why the new #1 is the strongest move right now>",
  "nbaContextualTitles": {
    "<nbe id>": "<≤140-char contextual rewrite of the catalogue label — see Rules>"
  },
  "nbaPromptHints": {
    "<nbe id>": "<≤200-char concrete compose / action prompt tailored to this persona — see Rules>"
  }
}

Rules:
- Use only ids present in the input list. Do not add, omit, or rename.
- Order from most-to-least impactful for THIS persona right now.
- Bias toward the candidate that:
  1. clears the persona's biggest current blocker, OR
  2. directly serves the inferred-strategy headline / primary goal, OR
  3. unlocks compounding moves (e.g. workspace draft → outreach).
- When a "liveContext" string is provided, treat it as a fresh signal
  from a capability tool (e.g. web-search, owned-content-scan). Use it
  to break ties or boost a candidate whose rationale lines up with the
  signal — but never let it override the deterministic eligibility set,
  and never invent ids. If it's noise, ignore it.
- Penalise candidates that duplicate work the persona has already done.
- topReason: ≤ 140 chars, concrete (reference the actual blocker or goal, or the live signal when it drove the pick). No markdown.
- nbaContextualTitles — for EACH id in your "order" array, rewrite the
  catalogue's generic label into a contextually-specific TITLE the
  operator will read on the NBA card. Each title MUST:
    * Reference the persona's actual venture, partner, goal, or
      cartridge by name — never generic ("partner proposal" alone is
      not enough; "Metaiye Media partner proposal" is correct).
    * Stay verb-first and imperative, matching the catalogue label's
      voice ("Ask Marketa for a Metaiye Media partner proposal",
      "Generate the metaKnyts venture progress report", "Draft a Gmail
      outreach to <named partner> on Operation metaWill launch").
    * Be ≤ 140 chars (drops into an h4 on the NBA card).
    * Skip the title (omit the key) ONLY when you genuinely have no
      grounded signal — the catalogue label will render verbatim as
      the fallback. NEVER invent a partner name or metric.
    * No markdown, no JSON-escaped newlines, no T0 ids (personaId /
      auth_profile_id / tenant_id / kybe_did).
- nbaPromptHints — for EACH id in your "order" array, emit one short
  prompt string the operator could feed straight into a compose modal
  (or use as a starting frame for non-compose actions). Each hint MUST:
    * Reference the persona's actual primary goal, stage, active
      cartridges, or experienceGoals — never generic copy.
    * Be ≤ 200 chars.
    * Sound like instructions to a drafting assistant ("Draft an
      outreach to <named partner> about <specific situation>…",
      "Working spec for <specific deliverable> anchored to <named
      goal>…", "Add a KPI for <specific metric> targeting <number>…").
    * Skip the hint (omit the key) ONLY when you genuinely have no
      grounded signal for that NBA — never invent a name or number.
    * No markdown, no JSON-escaped newlines, no T0 ids (personaId /
      auth_profile_id / tenant_id / kybe_did).

${GROUNDING_MANDATE}`;

interface RerankContext {
  currentStage: ExperienceStage;
  activeCartridges: ActiveCartridgeSlug[];
  primaryGoal: string | null;
  experienceGoals: string[];
  strategy: InferredStrategy | null;
  /**
   * Polity Participation Model archetype. When set, the reranker biases
   * toward archetype-appropriate NBEs (e.g. Entrepreneurial → venture
   * formation moves; Creative → content/cultural moves).
   */
  operatorArchetype?: OperatorArchetype | null;
  /**
   * Optional Capability Gateway pre-flight summary (e.g. web-search
   * digest, owned-content-scan finding). Surfaces as a `liveContext`
   * field in the prompt body. Empty / null => omitted entirely so the
   * prompt shape stays stable for callers that don't have a gather.
   */
  liveContext?: string | null;
  /**
   * Plan-tier model override from `getPlanModelId(personaPlan)`.
   * Replaces the env-var default so sovereign/steward/FO personas get Sonnet
   * while free citizens get Haiku — per the Polity Alpha pricing tiers.
   */
  modelOverride?: string | null;
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

async function callAnthropic(userPrompt: string, modelId?: string | null): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  const resolvedModel = modelId || ANTHROPIC_MODEL;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        // 1500-token ceiling — old budget was 400, which truncated the
        // response once nbaContextualTitles joined nbaPromptHints
        // (≤140 + ≤200 chars per candidate × 5 candidates ≈ 425 tokens
        // before JSON structure overhead). Truncated JSON → parse fail
        // → empty {nbaContextualTitles:{}, nbaPromptHints:{}, topNbeReason:null}
        // in the brief response. 1500 covers 10+ candidates comfortably.
        max_tokens: 1500,
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
  const liveContext =
    typeof ctx.liveContext === 'string' && ctx.liveContext.trim().length > 0
      ? ctx.liveContext.trim().slice(0, 600)
      : null;
  return JSON.stringify(
    {
      persona: {
        currentStage: ctx.currentStage,
        activeCartridges: ctx.activeCartridges,
        primaryGoal: ctx.primaryGoal,
        experienceGoals: ctx.experienceGoals.slice(0, 16),
        ...(ctx.operatorArchetype ? { operatorArchetype: ctx.operatorArchetype } : {}),
      },
      strategy: ctx.strategy
        ? {
            headline: ctx.strategy.headline,
            blockers: ctx.strategy.venturePosture.blockers,
            unlocks: ctx.strategy.venturePosture.unlocks,
            coherence: ctx.strategy.coherenceNote,
          }
        : null,
      ...(liveContext ? { liveContext } : {}),
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

export interface NbeRerankResult {
  ranked: NbeCandidate[];
  /** ≤140-char rationale for the new top pick. Null when no LLM pass ran. */
  topReason: string | null;
  /**
   * Optional per-NBA contextual title rewrites, keyed by NBE id.
   * Renders in place of the catalogue label on the NBA card so each
   * card reads with the operator's actual venture / partner / goal
   * names instead of generic copy. Falls through to the catalogue
   * label when the LLM didn't emit one for a given id.
   */
  nbaContextualTitles: Record<string, string>;
  /**
   * Optional per-NBA compose / action prompt hints, keyed by NBE id.
   * Renders as the italic "aigentMe's take" line on the NBA card and
   * doubles as composerInitialPrompt when Act maps to a compose modal.
   */
  nbaPromptHints: Record<string, string>;
  /** True when the LLM call succeeded and produced a usable order. */
  llmApplied: boolean;
}

/**
 * Reorder a deterministically-filtered candidate list using an LLM pass.
 * Returns the original list (unchanged order) on any failure path.
 */
export async function llmRerankNbeCandidates(
  candidates: NbeCandidate[],
  ctx: RerankContext,
): Promise<NbeRerankResult> {
  if (!ANTHROPIC_API_KEY) return { ranked: candidates, topReason: null, nbaContextualTitles: {}, nbaPromptHints: {}, llmApplied: false };
  if (candidates.length < 2) return { ranked: candidates, topReason: null, nbaContextualTitles: {}, nbaPromptHints: {}, llmApplied: false };

  const raw = await callAnthropic(summariseForPrompt(candidates, ctx), ctx.modelOverride);
  if (!raw) return { ranked: candidates, topReason: null, nbaContextualTitles: {}, nbaPromptHints: {}, llmApplied: false };

  let parsed: { order?: unknown; topReason?: unknown; nbaContextualTitles?: unknown; nbaPromptHints?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Common cause: response truncated by max_tokens before the closing
    // brace lands. Log the first 200 chars so we can confirm vs blame
    // a quota / shape issue.
    console.warn(`[nbeLlmRerank] JSON.parse failed; raw head: ${raw.slice(0, 200)}`);
    return { ranked: candidates, topReason: null, nbaContextualTitles: {}, nbaPromptHints: {}, llmApplied: false };
  }
  if (!parsed || !Array.isArray(parsed.order)) {
    console.warn(`[nbeLlmRerank] parsed shape missing order array: ${JSON.stringify(parsed).slice(0, 200)}`);
    return { ranked: candidates, topReason: null, nbaContextualTitles: {}, nbaPromptHints: {}, llmApplied: false };
  }

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

  const topReason =
    typeof parsed.topReason === 'string' && parsed.topReason.trim().length > 0
      ? parsed.topReason.trim().slice(0, 200)
      : null;

  const nbaContextualTitles: Record<string, string> = {};
  if (parsed.nbaContextualTitles && typeof parsed.nbaContextualTitles === 'object' && !Array.isArray(parsed.nbaContextualTitles)) {
    for (const [id, title] of Object.entries(parsed.nbaContextualTitles as Record<string, unknown>)) {
      if (!validIds.has(id)) continue;
      if (typeof title !== 'string') continue;
      // Strip Markdown emphasis — Sonnet sometimes wraps the contextual
      // title in **bold** even after a "no markdown" instruction. The
      // NBA card renders the title verbatim as an h4, so unstripped
      // asterisks ship as visible chrome.
      const stripped = title
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/^#{1,6}\s+/g, '')
        .trim();
      if (stripped.length === 0) continue;
      nbaContextualTitles[id] = stripped.slice(0, 140);
    }
  }

  const nbaPromptHints: Record<string, string> = {};
  if (parsed.nbaPromptHints && typeof parsed.nbaPromptHints === 'object' && !Array.isArray(parsed.nbaPromptHints)) {
    for (const [id, hint] of Object.entries(parsed.nbaPromptHints as Record<string, unknown>)) {
      if (!validIds.has(id)) continue;
      if (typeof hint !== 'string') continue;
      const trimmed = hint.trim();
      if (trimmed.length === 0) continue;
      nbaPromptHints[id] = trimmed.slice(0, 200);
    }
  }

  return { ranked, topReason, nbaContextualTitles, nbaPromptHints, llmApplied: true };
}
