/**
 * constitutionalVideoSkill — the Constitutional Video experience (Studio).
 *
 * Operationalizes the EXP-002-proven segment pipeline into a first-class
 * Studio skill: N complete 12-second micro-films (24/36/48s = 2/3/4 segments)
 * that stitch seamlessly AND stand alone, each bound by the constitutional
 * grammar (G1–G6, ratified 2026-07-19):
 *
 *   G1 cadence   — fade in from black (~0.5s) → body (~10s) → threshold (ONE
 *                  constitutional statement as an on-screen card) → breath
 *                  (hold ~1s, fade to black, audio tail).
 *   G2 threshold — exactly one constitutional invariant per segment; the
 *                  audience leaves with N memorable constitutional ideas.
 *   G3 fidelity  — identity is NEVER a headline (identity is a representation
 *                  of personhood, not the thing that persists); the
 *                  humans/agents distinction is implied, never explained;
 *                  robots/agents appear as environment participants, never
 *                  crossing as citizens.
 *   G4 CTA       — the final segment is always the threshold-crossing
 *                  ceremony: slower visuals, a person crossing a subtle
 *                  illuminated threshold (no sci-fi portal), credential
 *                  visible only AFTER crossing, beat-separated closing
 *                  triplet, then "Cross the Threshold." + the claim line +
 *                  a closing invariant.
 *   G5 duration  — CTA segment always last; pillar segments drop from the
 *                  front as duration shrinks; every segment keeps G1+G2.
 *   G6 segments  — independently generatable/regeneratable; assembled by the
 *                  existing stitch pipeline.
 *
 * GRAMMAR / CONTENT SEPARATION (operator directive — load-bearing): this
 * skill is a BLANK CANVAS bound by the grammar. What the video is about, the
 * constitutional concepts it explores, the claim line, and the closing
 * triplet are OPERATOR-SUPPLIED PER RUN (contentDirection + cta inputs).
 * Nothing of any specific production's copy is baked in — the only constant
 * phrase is the structural "Cross the Threshold." (G4 grammar). A canary in
 * tests/constitutional-video-skill.test.ts enforces this.
 *
 * COMPOSES, never re-implements (Extend-Don't-Duplicate):
 *   - buildVideoInvariantBrief (services/video/invariantVideoBrief.ts) — the
 *     invariant-grounded per-segment substrate (CFS-011/012). The grammar is
 *     a TRANSFORMATION LAYER over the returned segments.
 *   - getInvariantsByIds — threshold statements distill the run's grounded
 *     invariants, never free-floating copy.
 *   - callAnthropicJson (shared draft helper) for the optional LLM pass;
 *     deterministic template fallback always available.
 *   - SkillVideoPlayer consumes plan.segments[].prompt via segment_prompts[]
 *     UNCHANGED — the cadence scaffold is folded into plain prompt strings.
 *
 * Receipts are emitted at the ROUTE layer (app/api/skills/constitutional-video).
 * This module stays receipt-free and drillable. Server-only.
 */

import {
  buildVideoInvariantBrief,
  type GroundingRef,
  type VideoInvariantBrief,
} from '@/services/video/invariantVideoBrief';
import { validateVideoBriefCoherence } from '@/services/coherence';
import { callAnthropicJson } from '@/services/agents/_lib/llmDraftHelper';
import { getInvariantsByIds } from '@/services/invariants/store';
import type { InvariantRecord } from '@/types/invariants';

export const CONSTITUTIONAL_SEGMENT_SECONDS = 12;
export const CONSTITUTIONAL_DURATIONS = [24, 36, 48] as const;
export type ConstitutionalDuration = (typeof CONSTITUTIONAL_DURATIONS)[number];

/** G4's one structural constant. Everything else is operator content. */
export const THRESHOLD_PHRASE = 'Cross the Threshold.';

/** G1 — the fixed four-beat cadence every segment carries. */
export interface SegmentCadence {
  fadeInSeconds: number;   // opening: fade in from black
  bodySeconds: number;     // main visual progression
  thresholdSeconds: number; // on-screen constitutional statement card
  breathSeconds: number;   // hold, resolve, fade to black
}
export const CADENCE: SegmentCadence = {
  fadeInSeconds: 0.5,
  bodySeconds: 9.5,
  thresholdSeconds: 1,
  breathSeconds: 1,
};

/** The operator's blank-canvas input — what THIS video is about. */
export interface ContentDirection {
  /** Required — the subject of the video (free text). */
  subject: string;
  /** Constitutional ideas/concepts to explore (free text items). */
  concepts?: string[];
  audience?: string;
  tone?: string;
}

/** The operator-configured CTA (G4 structure; operator content). */
export interface ConstitutionalCta {
  /** Progression target label (passport | delegation | founder-office | research-lab | custom …). */
  target: string;
  /** The claim line shown after "Cross the Threshold." (operator-supplied). */
  claimLine: string;
  /** Beat-separated closing triplet; composed from contentDirection + grounding when omitted. */
  closingTriplet?: [string, string, string];
  /** Invariant whose statement closes the film (defaults to the CTA segment's threshold invariant). */
  closingInvariantId?: string;
}

export interface ConstitutionalSegment {
  index: number;
  cadence: SegmentCadence;
  /** G2 — the ONE constitutional statement this segment ends on (on-screen card). */
  thresholdStatement: string;
  /** The invariant(s) the threshold distills (provenance). */
  sourceInvariantIds: string[];
  /** Voiceover script for this segment (paced to ~bodySeconds; rendered via TTS + mux). */
  voiceoverLines: string[];
  /** Final video-generation prompt — cadence scaffold folded in; SkillVideoPlayer-compatible. */
  prompt: string;
  /** True for the final (G4 ceremony) segment. */
  isCta: boolean;
  composedBy: 'llm' | 'template';
}

export interface GrammarCheck {
  pass: boolean;
  violations: string[];
}

export interface ConstitutionalVideoPlan {
  brief: VideoInvariantBrief;
  segments: ConstitutionalSegment[];
  cta: {
    target: string;
    claimLine: string;
    closingTriplet: [string, string, string];
    closingStatement: string;
  };
  grammar: GrammarCheck;
  coherence: Awaited<ReturnType<typeof validateVideoBriefCoherence>> | null;
  contentDirection: ContentDirection;
  totalSeconds: number;
  segmentCount: number;
  segmentSeconds: number;
}

export interface ConstitutionalVideoInput {
  groundings: GroundingRef[];
  contentDirection: ContentDirection;
  durationSeconds: ConstitutionalDuration;
  cta: ConstitutionalCta;
  productionTitle?: string;
  /** false forces the deterministic template path (tests / no provider key). */
  useLlm?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure builders (canary-pinned in tests/constitutional-video-skill.test.ts)
// ─────────────────────────────────────────────────────────────────────────

/** G3 — the doctrine constraints injected into every LLM composition call. */
export const CONSTITUTIONAL_GRAMMAR_MANDATE =
  'CONSTITUTIONAL GRAMMAR (non-negotiable): ' +
  'The canonical sequence is Personhood -> Continuity -> Action -> Standing. ' +
  'The word "identity" must NEVER appear in a threshold statement, title card, or headline — identity is one social representation of personhood, not the thing that persists. ' +
  'The humans/agents distinction is IMPLIED, never explained: agents act; humans possess personhood; state neither explicitly. ' +
  'Robots and AI agents may appear as participants in the environment; they never cross a threshold as citizens. ' +
  'Pacing is a sequence of thresholds separated by deliberate stillness — never rapid commercial-style editing. ' +
  'Each segment ends on exactly ONE memorable constitutional statement (3–10 words), distilled from the grounded invariants provided — never invented.';

/**
 * G1 — the deterministic cadence scaffold. The body direction (LLM or
 * template) is wrapped in the fixed micro-film structure so every prompt
 * carries the grammar regardless of composition path. Pure.
 */
export function scaffoldSegmentPrompt(bodyDirection: string, thresholdStatement: string): string {
  return (
    `The segment opens on black and fades in over ${CADENCE.fadeInSeconds} seconds. ` +
    `${bodyDirection.trim()} ` +
    `In the final ${CADENCE.thresholdSeconds + CADENCE.breathSeconds} seconds all motion settles into deliberate stillness and an on-screen title card appears with the exact text: "${thresholdStatement}". ` +
    `Hold on the card for ${CADENCE.breathSeconds} second, then fade to black.`
  );
}

/** G4 — the ceremony scaffold for the final segment. Pure. */
export function scaffoldCtaPrompt(
  bodyDirection: string,
  closingTriplet: [string, string, string],
  claimLine: string,
  closingStatement: string,
): string {
  return (
    `The final segment opens on black and fades in over ${CADENCE.fadeInSeconds} seconds. Visuals are slower and more intentional than earlier segments. ` +
    `${bodyDirection.trim()} ` +
    `A person walks toward a subtle illuminated threshold — a doorway, bridge, or transition into light; never a portal or sci-fi effect. Other people of different ages, cultures, and professions are walking too; some are accompanied by AI agents; robots are visible in the wider environment but do not cross. ` +
    `The person crosses the threshold; only then does the credential become clearly visible. Fade to black. ` +
    `Then a closing text sequence appears, one line at a time with a beat of stillness between each: "${closingTriplet[0]}" — "${closingTriplet[1]}" — "${closingTriplet[2]}". ` +
    `Hold. Then the invitation: "${THRESHOLD_PHRASE}" followed by "${claimLine}". ` +
    `At the very bottom, smaller: "${closingStatement}". Fade to black.`
  );
}

/** Distill an invariant statement into a template threshold line. Pure. */
export function templateThreshold(invariant: InvariantRecord | null, direction: ContentDirection, index: number): string {
  if (invariant) {
    const words = invariant.statement.split(/\s+/).slice(0, 8).join(' ');
    return words.replace(/[.,;:]+$/, '');
  }
  const concept = direction.concepts?.[index];
  return concept ? concept.slice(0, 60) : direction.subject.slice(0, 60);
}

/** Deterministic fallback triplet — generic structural filler, no baked production copy. Pure. */
export function templateTriplet(direction: ContentDirection): [string, string, string] {
  const c = direction.concepts ?? [];
  return [
    c[0] ? `${c[0].slice(0, 50)}.` : `${direction.subject.slice(0, 50)}.`,
    c[1] ? `${c[1].slice(0, 50)}.` : 'The threshold is open.',
    c[2] ? `${c[2].slice(0, 50)}.` : 'The choice is yours.',
  ];
}

/**
 * G2/G3 grammar validation — pure, deterministic. Violations are surfaced,
 * never silently dropped; the builder attempts ONE bounded recomposition of
 * offending pieces before returning pass:false honestly.
 */
export function validateConstitutionalGrammar(
  segments: Pick<ConstitutionalSegment, 'index' | 'thresholdStatement' | 'isCta'>[],
  cta: { claimLine: string; closingTriplet: [string, string, string] },
): GrammarCheck {
  const violations: string[] = [];
  const identityHeadline = (text: string) => /\bidentit(y|ies)\b/i.test(text);
  for (const s of segments) {
    if (!s.thresholdStatement || s.thresholdStatement.trim().length < 3) {
      violations.push(`segment ${s.index + 1}: missing threshold statement (G2 — one invariant per segment)`);
    } else if (s.thresholdStatement.length > 90) {
      violations.push(`segment ${s.index + 1}: threshold statement too long to be memorable (G2)`);
    }
    if (s.thresholdStatement && identityHeadline(s.thresholdStatement)) {
      violations.push(`segment ${s.index + 1}: "identity" used as a headline (G3 — identity is a representation of personhood, never the headline)`);
    }
  }
  if (segments.length > 0 && !segments[segments.length - 1].isCta) {
    violations.push('final segment is not the CTA ceremony (G4/G5 — the CTA segment is always last)');
  }
  if (identityHeadline(cta.claimLine)) violations.push('CTA claim line uses "identity" as a headline (G3)');
  for (const line of cta.closingTriplet) {
    if (identityHeadline(line)) violations.push(`closing triplet line "${line.slice(0, 40)}" uses "identity" as a headline (G3)`);
  }
  return { pass: violations.length === 0, violations };
}

// ─────────────────────────────────────────────────────────────────────────
// LLM composition (per-segment; honest template fallback)
// ─────────────────────────────────────────────────────────────────────────

interface ComposedSegment {
  bodyDirection: string;
  thresholdStatement: string;
  voiceoverLines: string[];
  closingTriplet?: [string, string, string];
  composedBy: 'llm' | 'template';
}

function parseLenient(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function composeSegment(args: {
  brief: VideoInvariantBrief;
  segmentIndex: number;
  segmentCount: number;
  direction: ContentDirection;
  thresholdInvariant: InvariantRecord | null;
  cta: ConstitutionalCta | null; // non-null on the final segment
  useLlm: boolean;
  violationFeedback?: string[];
}): Promise<ComposedSegment> {
  const { brief, segmentIndex, segmentCount, direction, thresholdInvariant, cta, useLlm, violationFeedback } = args;
  const briefSegment = brief.segments[segmentIndex];

  if (useLlm) {
    const system =
      `${CONSTITUTIONAL_GRAMMAR_MANDATE}\n\n` +
      'You compose ONE segment of a constitutional micro-film series. Respond with STRICT JSON only: ' +
      '{"bodyDirection":"<~60-110 words of cinematic visual direction for the ~10s body — concrete imagery, no marker codes, no on-screen text instructions (the scaffold adds those)>",' +
      '"thresholdStatement":"<the ONE memorable constitutional statement (3-10 words) this segment ends on, distilled from the grounded invariant>",' +
      '"voiceoverLines":["<1-3 short spoken lines totalling roughly 20-30 words, paced with pauses>"]' +
      (cta && !cta.closingTriplet ? ',"closingTriplet":["<line 1>","<line 2>","<line 3>"]' : '') +
      '}';
    const user = [
      `Video subject (operator direction): ${direction.subject}`,
      direction.concepts?.length ? `Constitutional concepts to explore: ${direction.concepts.join('; ')}` : null,
      direction.audience ? `Audience: ${direction.audience}` : null,
      direction.tone ? `Tone: ${direction.tone}` : null,
      `Segment ${segmentIndex + 1} of ${segmentCount}${cta ? ' — the FINAL segment: the threshold-crossing ceremony (slower, ceremonial; a person crosses a subtle illuminated threshold; the credential is visible only after crossing).' : '.'}`,
      brief.continuityBlock,
      `Invariant grounding for this segment:\n${briefSegment.beat}`,
      thresholdInvariant ? `The threshold statement must distill THIS invariant: "${thresholdInvariant.statement}"` : 'No single invariant assigned — distill the segment grounding above.',
      cta ? `The CTA target is "${cta.target}"; the claim line shown after "${THRESHOLD_PHRASE}" is "${cta.claimLine}".` : null,
      violationFeedback?.length ? `PREVIOUS ATTEMPT VIOLATED THE GRAMMAR — fix these and regenerate:\n- ${violationFeedback.join('\n- ')}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const parsed = parseLenient(await callAnthropicJson(system, user, 700).catch(() => null));
    const bodyDirection = typeof parsed?.bodyDirection === 'string' ? parsed.bodyDirection : null;
    const thresholdStatement = typeof parsed?.thresholdStatement === 'string' ? parsed.thresholdStatement.trim() : null;
    if (bodyDirection && thresholdStatement) {
      const voiceoverLines = Array.isArray(parsed?.voiceoverLines)
        ? (parsed.voiceoverLines as unknown[]).map(String).filter((l) => l.trim().length > 0).slice(0, 3)
        : [];
      const triplet = Array.isArray(parsed?.closingTriplet) && (parsed.closingTriplet as unknown[]).length === 3
        ? ((parsed.closingTriplet as unknown[]).map(String) as [string, string, string])
        : undefined;
      return { bodyDirection, thresholdStatement, voiceoverLines, closingTriplet: triplet, composedBy: 'llm' };
    }
  }

  // Deterministic template path — grounding-only by construction.
  const thresholdStatement = templateThreshold(thresholdInvariant, direction, segmentIndex);
  return {
    bodyDirection: `${briefSegment.beat} Render as slow, intentional imagery in service of: ${direction.subject}.`,
    thresholdStatement,
    voiceoverLines: [thresholdStatement],
    closingTriplet: cta && !cta.closingTriplet ? templateTriplet(direction) : undefined,
    composedBy: 'template',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The skill
// ─────────────────────────────────────────────────────────────────────────

export async function buildConstitutionalVideoPlan(
  input: ConstitutionalVideoInput,
): Promise<ConstitutionalVideoPlan> {
  if (!CONSTITUTIONAL_DURATIONS.includes(input.durationSeconds)) {
    throw new Error(`durationSeconds must be one of ${CONSTITUTIONAL_DURATIONS.join('/')}`);
  }
  if (!input.contentDirection?.subject?.trim()) {
    throw new Error('contentDirection.subject is required — the skill is a blank canvas; the operator supplies the content');
  }
  if (!input.cta?.claimLine?.trim() || !input.cta?.target?.trim()) {
    throw new Error('cta.target and cta.claimLine are required (operator-supplied — no default claim exists)');
  }

  const segmentCount = input.durationSeconds / CONSTITUTIONAL_SEGMENT_SECONDS;
  const useLlm = input.useLlm ?? true;

  // The shared invariant substrate — the grammar transforms it, never replaces it.
  const brief = await buildVideoInvariantBrief({
    groundings: input.groundings,
    segmentCount,
    productionTitle: input.productionTitle ?? input.contentDirection.subject,
    useLlm,
  });

  // Resolve threshold-invariant candidates per segment (G2): first
  // foregrounded semantic invariant, else the narrative beat. G5 holds by
  // construction — the brief's arc mapping is endpoint-anchored, so shorter
  // durations compress interior beats while the last segment (CTA) closes.
  const wantedIds = new Set<string>();
  for (const s of brief.segments) {
    if (s.foregroundedInvariantIds[0]) wantedIds.add(s.foregroundedInvariantIds[0]);
    if (s.narrativeInvariantId) wantedIds.add(s.narrativeInvariantId);
  }
  if (input.cta.closingInvariantId) wantedIds.add(input.cta.closingInvariantId);
  const resolved = await getInvariantsByIds([...wantedIds]).catch(() => [] as InvariantRecord[]);
  const byId = new Map(resolved.map((r) => [r.id, r]));

  // The resolved closing triplet: operator-supplied wins; otherwise the CTA
  // segment's composition provides one; the deterministic template is the
  // last resort. Tracked here so the plan's cta block always matches the
  // prompt that was actually scaffolded.
  let resolvedTriplet: [string, string, string] =
    input.cta.closingTriplet ?? templateTriplet(input.contentDirection);

  const composeAll = async (feedback?: Map<number, string[]>): Promise<ConstitutionalSegment[]> => {
    const out: ConstitutionalSegment[] = [];
    for (let i = 0; i < segmentCount; i++) {
      const isCta = i === segmentCount - 1;
      const briefSeg = brief.segments[i];
      const thresholdInvariant =
        (isCta && input.cta.closingInvariantId ? byId.get(input.cta.closingInvariantId) : undefined) ??
        (briefSeg.foregroundedInvariantIds[0] ? byId.get(briefSeg.foregroundedInvariantIds[0]) : undefined) ??
        (briefSeg.narrativeInvariantId ? byId.get(briefSeg.narrativeInvariantId) : undefined) ??
        null;
      const composed = await composeSegment({
        brief,
        segmentIndex: i,
        segmentCount,
        direction: input.contentDirection,
        thresholdInvariant,
        cta: isCta ? input.cta : null,
        useLlm,
        violationFeedback: feedback?.get(i),
      });
      if (isCta && !input.cta.closingTriplet && composed.closingTriplet) {
        resolvedTriplet = composed.closingTriplet;
      }
      const prompt = isCta
        ? scaffoldCtaPrompt(composed.bodyDirection, resolvedTriplet, input.cta.claimLine, composed.thresholdStatement)
        : scaffoldSegmentPrompt(composed.bodyDirection, composed.thresholdStatement);
      out.push({
        index: i,
        cadence: CADENCE,
        thresholdStatement: composed.thresholdStatement,
        sourceInvariantIds: thresholdInvariant ? [thresholdInvariant.id] : briefSeg.foregroundedInvariantIds,
        voiceoverLines: composed.voiceoverLines,
        prompt,
        isCta,
        composedBy: composed.composedBy,
      });
    }
    return out;
  };

  let segments = await composeAll();
  let ctaSegment = segments[segments.length - 1];
  let grammar = validateConstitutionalGrammar(segments, { claimLine: input.cta.claimLine, closingTriplet: resolvedTriplet });

  // ONE bounded honest retry: recompose only the violating segments with the
  // violations as feedback. Still failing → return pass:false with the list.
  if (!grammar.pass && useLlm) {
    const feedback = new Map<number, string[]>();
    for (const v of grammar.violations) {
      const m = v.match(/^segment (\d+):/);
      if (m) {
        const idx = Number(m[1]) - 1;
        feedback.set(idx, [...(feedback.get(idx) ?? []), v]);
      }
    }
    if (feedback.size > 0) {
      const retried = await composeAll(feedback);
      segments = segments.map((s) => (feedback.has(s.index) ? retried[s.index] : s));
      ctaSegment = segments[segments.length - 1];
      grammar = validateConstitutionalGrammar(segments, { claimLine: input.cta.claimLine, closingTriplet: resolvedTriplet });
    }
  }

  // Quality gate — best-effort: evaluator failure degrades to null, never a fake pass.
  let coherence: ConstitutionalVideoPlan['coherence'] = null;
  try {
    coherence = await validateVideoBriefCoherence(brief);
  } catch {
    coherence = null;
  }

  return {
    brief,
    segments,
    cta: {
      target: input.cta.target,
      claimLine: input.cta.claimLine,
      closingTriplet: resolvedTriplet,
      closingStatement: ctaSegment.thresholdStatement,
    },
    grammar,
    coherence,
    contentDirection: input.contentDirection,
    totalSeconds: input.durationSeconds,
    segmentCount,
    segmentSeconds: CONSTITUTIONAL_SEGMENT_SECONDS,
  };
}
