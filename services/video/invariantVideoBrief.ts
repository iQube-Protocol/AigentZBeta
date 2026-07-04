/**
 * Invariant-grounded video brief generator (CFS-011 §6, CFS-012, Chrysalis EXP-002).
 *
 * Composes per-segment video-generation prompts from invariant groundings,
 * one composition strategy per role:
 *   - 'style'     (CFS-011) — applied identically to every segment as one
 *                  shared continuity block.
 *   - 'narrative' (CFS-012) — sequential: beats are ordered by seed id and
 *                  mapped proportionally one-per-segment (never round-robin
 *                  — a fixed story arc cannot be shuffled).
 *   - (anything else, 'semantic' by convention) — distributed round-robin
 *                  across segments so each beat foregrounds a distinct
 *                  cluster of principles.
 *
 * Generalized per CFS-011 §5: a grounding is `{ collectionId | invariantIds,
 * role }` — `role` is a free label, not a hardcoded enum, so future
 * invariant classes compose without a new code path.
 *
 * This is the fix for the defect the manual EXP-002 briefs existed to work
 * around: SkillVideoPlayer previously had no per-segment prompt mechanism at
 * all (services/composer/SkillVideoPlayer.tsx, fixed 2026-07-04) — every
 * segment submitted an identical request body. This generator is what
 * produces the segment_prompts[] that fix now accepts.
 *
 * Composition is template-first (deterministic, always available, no
 * network dependency) with an optional LLM pass (Anthropic, via the shared
 * draft helper — same Anthropic→fallback pattern as draftEmail/askSpecialist)
 * to turn the structured beat into cinematic prose. The LLM pass NEVER
 * introduces content outside the grounding set — the prompt explicitly
 * instructs against it, and the template fallback is grounding-only by
 * construction.
 *
 * Server-only.
 */

import { callAnthropicJson } from '@/services/agents/_lib/llmDraftHelper';
import { GROUNDING_MANDATE } from '@/services/orchestration/groundingContract';
import { getInvariantsByIds } from '@/services/invariants/store';
import { listMembers } from '@/services/invariants/collections';
import type { InvariantRecord } from '@/types/invariants';

export interface GroundingRef {
  /** One of collectionId or invariantIds must be provided. */
  collectionId?: string;
  invariantIds?: string[];
  /**
   * Free label — not enum-restricted (CFS-011 §5 generalization). Three
   * roles get distinct composition treatment; anything else is folded into
   * 'semantic' handling:
   *   'style'     — CFS-011: applied identically to every segment (the
   *                 continuity block).
   *   'narrative' — CFS-012: sequential, proportionally mapped one beat per
   *                 segment (fixed story-position order, never round-robin).
   *   (other)     — CFS-001..010 semantic invariants: distributed
   *                 round-robin, each segment foregrounds a distinct subset.
   */
  role: string;
}

export interface SegmentBrief {
  index: number;
  /** Semantic invariants this segment foregrounds (subset of the semantic grounding). */
  foregroundedInvariantIds: string[];
  /** The narrative beat (CFS-012) mapped to this segment's story-position, if a narrative grounding was provided. */
  narrativeInvariantId: string | null;
  /** Deterministic structured beat (markers + statements + guardrails). Always present. */
  beat: string;
  /** The final per-segment video-generation prompt (LLM-composed if available, else = continuity + beat). */
  prompt: string;
  composedBy: 'llm' | 'template';
}

export interface VideoInvariantBrief {
  continuityBlock: string;
  styleInvariantIds: string[];
  narrativeInvariantIds: string[];
  semanticInvariantIds: string[];
  segments: SegmentBrief[];
}

export interface BuildBriefInput {
  groundings: GroundingRef[];
  segmentCount: number;
  productionTitle?: string;
  /** Set false to force the deterministic template path (useful for tests / no API key). */
  useLlm?: boolean;
}

function markerFor(invariant: InvariantRecord, fallbackIndex: number): string {
  if (invariant.seedId) {
    const parts = invariant.seedId.split('.'); // inv.<namespace>.<nnn>
    const ns = parts[1]?.[0]?.toUpperCase() ?? 'X';
    const num = parts[2] ?? String(fallbackIndex).padStart(3, '0');
    return `[${ns}-${num}]`;
  }
  return `[X-${String(fallbackIndex).padStart(3, '0')}]`;
}

async function resolveGrounding(ref: GroundingRef): Promise<InvariantRecord[]> {
  if (ref.invariantIds?.length) return getInvariantsByIds(ref.invariantIds);
  if (ref.collectionId) {
    const members = await listMembers(ref.collectionId);
    return getInvariantsByIds(members.map((m) => m.invariantId));
  }
  return [];
}

function buildContinuityBlock(styleInvariants: InvariantRecord[]): string {
  if (styleInvariants.length === 0) {
    return 'No style grounding provided — no continuity requirements are enforced beyond ordinary directorial consistency.';
  }
  const lines = styleInvariants.map(
    (inv, i) => `- ${markerFor(inv, i + 1)} ${inv.statement}`,
  );
  return [
    'Continuity requirements (must hold identically across every segment of this production):',
    ...lines,
  ].join('\n');
}

function distributeRoundRobin(items: InvariantRecord[], segmentCount: number): InvariantRecord[][] {
  const buckets: InvariantRecord[][] = Array.from({ length: segmentCount }, () => []);
  items.forEach((item, i) => buckets[i % segmentCount].push(item));
  return buckets;
}

/** Numeric suffix of a seed id (inv.<namespace>.<nnn>), for stable arc ordering. */
function seedOrdinal(invariant: InvariantRecord): number {
  const num = invariant.seedId?.split('.')[2];
  const parsed = num ? Number(num) : NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * CFS-012 §4 — narrative beats are sequential and never round-robin.
 * Segment i (of N) renders the beat at arc-position floor(i * beatCount / N),
 * so the fixed story order is preserved regardless of how segment count and
 * beat count relate (compressing beats together, never reordering them).
 */
function mapNarrativeToSegments(
  narrativeInvariants: InvariantRecord[],
  segmentCount: number,
): (InvariantRecord | null)[] {
  if (narrativeInvariants.length === 0) return Array.from({ length: segmentCount }, () => null);
  const ordered = [...narrativeInvariants].sort((a, b) => seedOrdinal(a) - seedOrdinal(b));
  return Array.from({ length: segmentCount }, (_, i) =>
    ordered[Math.floor((i * ordered.length) / segmentCount)],
  );
}

function buildBeat(
  narrativeBeat: InvariantRecord | null,
  foregrounded: InvariantRecord[],
  allSemantic: InvariantRecord[],
  segmentIndex: number,
  segmentCount: number,
): string {
  const narrativeLine = narrativeBeat
    ? `Narrative stage: ${markerFor(narrativeBeat, 1)} ${narrativeBeat.statement} `
    : '';
  const fgLines = foregrounded.length
    ? foregrounded.map((inv, i) => `${markerFor(inv, i + 1)} ${inv.statement}`).join(' ')
    : '(no invariant foregrounded in this segment — carry the continuity block only)';
  const others = allSemantic.filter((inv) => !foregrounded.some((f) => f.id === inv.id));
  const guardrail = others.length
    ? ` Do not contradict: ${others.map((inv, i) => markerFor(inv, i + 1)).join(', ')}.`
    : '';
  return `${narrativeLine}Segment ${segmentIndex + 1}/${segmentCount} foregrounds: ${fgLines}.${guardrail} Assert nothing beyond the grounding collection.`;
}

async function composeSegmentPrompt(
  continuityBlock: string,
  beat: string,
  productionTitle: string | undefined,
  useLlm: boolean,
): Promise<{ prompt: string; composedBy: 'llm' | 'template' }> {
  if (useLlm) {
    const system = `${GROUNDING_MANDATE}\n\nYou write concise cinematic video-generation prompts (~80-150 words) for a single ≤12-second segment of a multi-segment production. You NEVER assert a claim, principle, or visual metaphor that is not grounded in the invariants provided. You NEVER invent plot or principle beyond what is given.`;
    const user = [
      productionTitle ? `Production: ${productionTitle}` : null,
      continuityBlock,
      '',
      'This segment:',
      beat,
      '',
      'Write ONE cinematic prompt for this segment only. Do not include the marker codes in the output — translate them into concrete visual/narrative direction. Plain prose, no headings.',
    ]
      .filter(Boolean)
      .join('\n');
    const llmText = await callAnthropicJson(system, user, 400).catch(() => null);
    if (llmText && llmText.trim().length > 0) {
      return { prompt: llmText.trim(), composedBy: 'llm' };
    }
  }
  return { prompt: `${continuityBlock}\n\n${beat}`, composedBy: 'template' };
}

export async function buildVideoInvariantBrief(
  input: BuildBriefInput,
): Promise<VideoInvariantBrief> {
  if (!Number.isInteger(input.segmentCount) || input.segmentCount < 1) {
    throw new Error('segmentCount must be a positive integer');
  }

  const styleRefs = input.groundings.filter((g) => g.role === 'style');
  const narrativeRefs = input.groundings.filter((g) => g.role === 'narrative');
  const semanticRefs = input.groundings.filter((g) => g.role !== 'style' && g.role !== 'narrative');

  const styleInvariants = (await Promise.all(styleRefs.map(resolveGrounding))).flat();
  const narrativeInvariants = (await Promise.all(narrativeRefs.map(resolveGrounding))).flat();
  const semanticInvariants = (await Promise.all(semanticRefs.map(resolveGrounding))).flat();

  const continuityBlock = buildContinuityBlock(styleInvariants);
  const buckets = distributeRoundRobin(semanticInvariants, input.segmentCount);
  const narrativeMap = mapNarrativeToSegments(narrativeInvariants, input.segmentCount);
  const useLlm = input.useLlm ?? true;

  const segments: SegmentBrief[] = [];
  for (let i = 0; i < input.segmentCount; i++) {
    const foregrounded = buckets[i];
    const narrativeBeat = narrativeMap[i];
    const beat = buildBeat(narrativeBeat, foregrounded, semanticInvariants, i, input.segmentCount);
    const { prompt, composedBy } = await composeSegmentPrompt(
      continuityBlock,
      beat,
      input.productionTitle,
      useLlm,
    );
    segments.push({
      index: i,
      foregroundedInvariantIds: foregrounded.map((inv) => inv.id),
      narrativeInvariantId: narrativeBeat?.id ?? null,
      beat,
      prompt,
      composedBy,
    });
  }

  return {
    continuityBlock,
    styleInvariantIds: styleInvariants.map((inv) => inv.id),
    narrativeInvariantIds: narrativeInvariants.map((inv) => inv.id),
    semanticInvariantIds: semanticInvariants.map((inv) => inv.id),
    segments,
  };
}
