/**
 * studioArtifactTiering — Studio Composer's productions wired into the
 * Artifact Runtime's consequence model (CVR-002, the AR/CPS + observer
 * awareness rule in CLAUDE.md).
 *
 * Studio Composer produces MEDIA + EDITORIAL artifacts through skill routes
 * (`/api/skills/image/generate`, `/api/skills/invoke`,
 * `/api/skills/video/stitch`) and the article endpoint
 * (`/api/composer/article-draft`). This module assigns each production a
 * consequence tier so those artifacts participate in the same
 * disposable | operational ladder as delegate and business productions —
 * WITHOUT changing how the artifacts are produced (mirror of
 * `services/artifact/businessArtifactTiering.ts`, the CFS-025 increment-3
 * precedent).
 *
 * Tiering rules (deliberate, pinned by tests/studio-artifact-tiering.test.ts):
 *
 *   - A COMPLETED image set (at least one live image persisted to storage) is
 *     OPERATIONAL 'multimedia' — real, durable, credit-costing work product.
 *   - A SIMULATED / FAILED image set is DISPOSABLE. Disposable is NEVER
 *     persisted — that is its definition (artifactRecordStore header).
 *   - A COMPLETED article draft (a real prompt or title was given, a draft
 *     came back) is OPERATIONAL 'documentation'. An UNPROMPTED draft (the
 *     deterministic fallback with no real input) and a FAILED draft are
 *     DISPOSABLE.
 *   - A SUBMITTED video generation is DISPOSABLE: at `/api/skills/invoke`
 *     response time the video does not exist yet (completion is client-polled
 *     through `/api/skills/video/[id]/status`). Only the rare
 *     immediate-completion branch — and the stitch route, which resolves a
 *     durable Supabase URL exactly once — classify OPERATIONAL 'multimedia'.
 *   - NOTHING here maps to constitutional. A Studio production is never BORN
 *     constitutional; the operator PROMOTES a persisted record later
 *     (canPromote → promoteArtifactRecord). The return type makes this
 *     structurally impossible.
 *   - An UNKNOWN production kind classifies disposable — fail-safe: we never
 *     persist what we cannot name.
 *
 * Failure isolation: the impure functions are best-effort and NEVER throw.
 * The existing production flows must keep working byte-for-byte when anything
 * in here fails.
 *
 * TIER DISCIPLINE: no T0 identifier crosses this module. The record body is a
 * whitelisted T2-safe projection built by `buildStudioRecordBody` — prompt,
 * provider/model, output refs — never a personaId, authProfileId, or rootDid
 * (structurally inexpressible: the builder copies named fields only).
 */

import type { ArtifactProfileId } from '@/types/artifactRuntime';
import { saveArtifactRecord } from '@/services/artifact/artifactRecordStore';
import type { StudioAlignmentFields } from '@/services/content/alignmentService';

/** The tier a Studio production runs under. Never constitutional. */
export interface StudioArtifactTier {
  profile: ArtifactProfileId;
  consequenceClass: 'disposable' | 'operational';
}

/** The named Studio production outcomes this module can classify. */
export type StudioProductionKind =
  | 'studio.image.set.completed'
  | 'studio.image.set.simulated'
  | 'studio.article.draft.completed'
  | 'studio.article.draft.unprompted'
  | 'studio.article.draft.failed'
  | 'studio.video.generation.submitted'
  | 'studio.video.generation.simulated'
  | 'studio.video.generation.completed'
  | 'studio.video.stitch.completed'
  // Constitutional Video experience (2026-07-19): the grammar-bound plan and
  // its completed (stitched, voiced) production.
  | 'studio.video.constitutional.plan.completed'
  | 'studio.video.constitutional.completed'
  // Voiceover mux — a durable voiced segment persisted to storage.
  | 'studio.video.voiceover.mux.completed'
  // Coherent Bundle Generation (operationalizes EXP-001's proven capability).
  | 'studio.bundle.coherent.completed'
  // The opt-in bundle judgement (separate skill; never part of generation).
  | 'studio.bundle.judgement.completed';

/**
 * The classification map — production kind → tier. PURE data; the single
 * authoritative home for Studio production tiering (extend here, never inline
 * in a route).
 */
const STUDIO_ARTIFACT_TIERS: Record<StudioProductionKind, StudioArtifactTier> = {
  // Durable media persisted to storage — operational.
  'studio.image.set.completed': { profile: 'multimedia', consequenceClass: 'operational' },
  'studio.video.generation.completed': { profile: 'multimedia', consequenceClass: 'operational' },
  'studio.video.stitch.completed': { profile: 'multimedia', consequenceClass: 'operational' },
  // A real, asked-for article draft — operational documentation.
  'studio.article.draft.completed': { profile: 'documentation', consequenceClass: 'operational' },
  // Scratch / failed / not-yet-existing productions — disposable, never persisted.
  'studio.image.set.simulated': { profile: 'multimedia', consequenceClass: 'disposable' },
  'studio.article.draft.unprompted': { profile: 'documentation', consequenceClass: 'disposable' },
  'studio.article.draft.failed': { profile: 'documentation', consequenceClass: 'disposable' },
  'studio.video.generation.submitted': { profile: 'multimedia', consequenceClass: 'disposable' },
  'studio.video.generation.simulated': { profile: 'multimedia', consequenceClass: 'disposable' },
  // Constitutional Video experience — the grammar-bound plan is durable
  // editorial work product; the completed voiced/stitched film is media.
  // "Constitutional" names the content genre, NOT the consequence class —
  // like every Studio production these are OPERATIONAL and promotable later
  // (operator decision 2026-07-19).
  'studio.video.constitutional.plan.completed': { profile: 'documentation', consequenceClass: 'operational' },
  'studio.video.constitutional.completed': { profile: 'multimedia', consequenceClass: 'operational' },
  'studio.video.voiceover.mux.completed': { profile: 'multimedia', consequenceClass: 'operational' },
  // Coherent Bundle Generation — the bundle (shared brief + assets) is
  // durable work product; the opt-in judgement is durable evidence.
  'studio.bundle.coherent.completed': { profile: 'documentation', consequenceClass: 'operational' },
  'studio.bundle.judgement.completed': { profile: 'documentation', consequenceClass: 'operational' },
};

/** Fail-safe default for kinds the map does not name: disposable. */
const UNKNOWN_TIER: StudioArtifactTier = {
  profile: 'multimedia',
  consequenceClass: 'disposable',
};

/**
 * Classify a Studio production by its outcome kind.
 * PURE + total: never throws, unknown kinds fall to the disposable default.
 */
export function classifyStudioArtifact(kind: string): StudioArtifactTier {
  return STUDIO_ARTIFACT_TIERS[kind as StudioProductionKind] ?? UNKNOWN_TIER;
}

/** One produced output ref — a storage/proxy URL pointer, never file bytes. */
export interface StudioOutputRef {
  url?: string | null;
  orientation?: string | null;
  label?: string | null;
}

export interface StudioRecordBodyInput {
  kind: string;
  /** The operator's prompt (their own content — T2-safe by construction). */
  prompt?: string | null;
  provider?: string | null;
  model?: string | null;
  title?: string | null;
  /** Output POINTERS (URLs / labels) — never contents, never identifiers. */
  outputs?: StudioOutputRef[];
  /** Provider job id for videos (a provider-scoped ref, not a persona ref). */
  generationId?: string | null;
  /** Deterministic stitch id (sha256 of source clip URLs). */
  stitchId?: string | null;
  /** Segment count for stitched videos. */
  segments?: number | null;
  /**
   * Automated Content Alignment verdict for video-article productions (pack
   * 2026-07-15 remedy #2). The T2-safe projection built by
   * `alignmentToStudioFields` in services/content/alignmentService — how well
   * the drafted article covers the shared video brief. Absent for productions
   * that carry no alignment (image sets, plain video stitches).
   */
  alignment?: StudioAlignmentFields | null;
  /**
   * Coherence/judgement evidence for coherent-bundle productions (2026-07-19).
   * `kind:'coherence'` + `method:'coherence-score/built-in'` — the cheap
   * deterministic score every bundle carries. `kind:'experiment'` +
   * `method:'judge/optional'` — the opt-in judgement (never mandatory).
   * Whitelist-copied like `alignment`; numeric summary only.
   */
  evaluation?: StudioEvidenceFields | null;
}

/** T2-safe evidence projection riding on bundle/video artifact records. */
export interface StudioEvidenceFields {
  kind: 'coherence' | 'experiment';
  method: 'coherence-score/built-in' | 'judge/optional';
  /** Receipt id / judgement record ref ({ref, note} evidence pattern). */
  ref: string | null;
  score: number | null;
  pass: boolean;
  detail: {
    briefCoherence?: number | null;
    grammarViolations?: number;
    articleAlignment?: number | null;
    verdictCounts?: { preserved: number; weakened: number; contradicted: number; absent: number };
    coherence?: number | null;
  };
  /** null for the built-in deterministic score. */
  judgedBy: { provider: string; model: string } | null;
}

/**
 * Build the T2-safe JSON record body. PURE. Whitelist-copy ONLY: every field
 * in the output is named here, so a T0 identifier (personaId, authProfileId,
 * rootDid, …) is structurally inexpressible — extra properties on the input
 * object are dropped, never spread. Pinned by the canary test with
 * findForbiddenObjectKey.
 */
export function buildStudioRecordBody(input: StudioRecordBodyInput): string {
  return JSON.stringify({
    kind: input.kind,
    prompt: typeof input.prompt === 'string' ? input.prompt.slice(0, 2000) : null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    title: typeof input.title === 'string' ? input.title.slice(0, 300) : null,
    outputs: (input.outputs ?? []).slice(0, 12).map((o) => ({
      url: o.url ?? null,
      orientation: o.orientation ?? null,
      label: o.label ?? null,
    })),
    generationId: input.generationId ?? null,
    stitchId: input.stitchId ?? null,
    segments: typeof input.segments === 'number' ? input.segments : null,
    // Alignment is whitelist-copied field-by-field — same T0-inexpressibility
    // guarantee as the rest of the body (no spread of the input object).
    alignment: input.alignment
      ? {
          score: input.alignment.score,
          pass: input.alignment.pass,
          basis: input.alignment.basis,
          segmentCoverage: (input.alignment.segmentCoverage ?? []).slice(0, 12),
        }
      : null,
    // Evidence is whitelist-copied field-by-field — same T0-inexpressibility
    // guarantee as alignment (no spread of the input object).
    evaluation: input.evaluation
      ? {
          kind: input.evaluation.kind,
          method: input.evaluation.method,
          ref: input.evaluation.ref ?? null,
          score: typeof input.evaluation.score === 'number' ? input.evaluation.score : null,
          pass: input.evaluation.pass === true,
          detail: {
            briefCoherence: input.evaluation.detail?.briefCoherence ?? null,
            grammarViolations: input.evaluation.detail?.grammarViolations ?? undefined,
            articleAlignment: input.evaluation.detail?.articleAlignment ?? null,
            verdictCounts: input.evaluation.detail?.verdictCounts ?? undefined,
            coherence: input.evaluation.detail?.coherence ?? null,
          },
          judgedBy: input.evaluation.judgedBy
            ? { provider: input.evaluation.judgedBy.provider, model: input.evaluation.judgedBy.model }
            : null,
        }
      : null,
  });
}

export interface RecordStudioArtifactInput extends StudioRecordBodyInput {
  /** Route-synthesised artifact id; synthesised here when absent. */
  artifactId?: string | null;
  /** The record's brief — defaults to the prompt, then the title. */
  brief?: string | null;
}

function synthesizeArtifactId(): string {
  return `art_studio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Persist an OPERATIONAL Studio production as a durable ArtifactRecord
 * (delegate 'operator' — Studio productions are operator-driven, not delegate
 * productions; receiptId null — operational tier writes NO receipts).
 * Disposable classifications return null without touching storage —
 * disposable is NEVER persisted. Best-effort + failure-isolated: returns the
 * record id or null, NEVER throws.
 */
export async function recordStudioArtifact(input: RecordStudioArtifactInput): Promise<string | null> {
  try {
    const { profile, consequenceClass } = classifyStudioArtifact(input.kind);
    if (consequenceClass !== 'operational') return null;
    const title = input.title || input.prompt?.slice(0, 120) || input.kind;
    return await saveArtifactRecord({
      artifactId: input.artifactId || synthesizeArtifactId(),
      profile,
      consequenceClass: 'operational',
      delegate: 'operator',
      title,
      brief: input.brief || input.prompt || title,
      body: buildStudioRecordBody(input),
      receiptId: null,
      sovereignty: null,
    });
  } catch (e) {
    console.warn(
      '[studio artifact tiering] record failed (non-fatal):',
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * The one-call seam for Studio production routes: classify, persist when
 * operational, and return the ADDITIVE surface fields to spread onto the
 * existing response (never replacing existing fields — the
 * create-artifact/businessArtifactTiering pattern). Never throws; on any
 * failure the tier still comes from the pure map and `artifactRecordId` is
 * simply absent.
 */
export async function tierStudioArtifact(
  input: RecordStudioArtifactInput,
): Promise<{ consequenceClass: 'disposable' | 'operational'; artifactRecordId?: string }> {
  const { consequenceClass } = classifyStudioArtifact(input.kind);
  if (consequenceClass !== 'operational') return { consequenceClass };
  const artifactRecordId = await recordStudioArtifact(input);
  return artifactRecordId ? { consequenceClass, artifactRecordId } : { consequenceClass };
}
