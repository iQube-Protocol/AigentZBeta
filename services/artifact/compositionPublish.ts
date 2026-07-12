/**
 * compositionPublish — the PURE helpers behind the Studio → Artifact-Runtime
 * publish seam (CFS-025/026, `POST /api/composition/publish`).
 *
 * The Composition engine (`services/composition/composeArtifact.ts`) is
 * observe-mode by design: its PUBLISH SEAM (~L449-456) leaves
 * `provenance.receiptId` null and says the receipt "would be written at the
 * ROUTE layer". This module is the route layer's drillable half of that seam —
 * it COMPOSES the engine's output, never modifies it:
 *
 *   - `buildStudioCompositionRequest` — coerce an operator goal (+ optional
 *     delta overrides) into the engine's real `CompositionRequest` input.
 *   - `projectPublishedProvenance` — fold the route-minted `artifact_published`
 *     receipt id into the returned provenance. A PROJECTION of the engine's
 *     result (mirrors ccrlResearchPilot.projectPublished) — composeArtifact is
 *     untouched. Re-guards T0 inexpressibility on the way out.
 *   - `compositionRecordBody` — the JSON projection persisted as the durable
 *     artifact-record body (`saveArtifactRecord`).
 *   - `publishSummaryFor` — the single receipt summary line.
 *
 * TIER DISCIPLINE: nothing here ever sees a personaId. The only subject handle
 * is the route-computed T2 `actorCommitment`; `findForbiddenObjectKey` makes a
 * T0 leak a thrown error, not a returned payload.
 *
 * Pure + node-drillable: node crypto only via the composed types; no DB, no
 * clock, no randomness, no React.
 */

import type {
  AssetRef,
  AtlasPlateDelta,
  CompositionRequest,
  CompositionResult,
} from '@/types/composition';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import {
  FIELD_SECTORS,
  STANDING_LEVELS,
  type FieldSector,
  type StandingLevel,
} from '@/types/representation';
import { DEFAULT_INTERPRETATION_ID } from '@/services/representation/interpretations';

/** The artifact-record profile for Studio compositions. */
export const STUDIO_COMPOSITION_PROFILE = 'studio-composition';

/** The Studio publish seam is operator-driven — the operator IS the delegate. */
export const STUDIO_COMPOSITION_DELEGATE = 'operator';

/** The Bearing Instrument v1 asset ref every Atlas Plate composes over
 *  (the ref the composition canary uses — `bearing-instrument@1`). */
export const BEARING_INSTRUMENT_ASSET_REF = 'bearing-instrument@1';

// ─────────────────────────────────────────────────────────────────────────
// Request building — goal → CompositionRequest (the engine's REAL input)
// ─────────────────────────────────────────────────────────────────────────

function isFieldSector(v: unknown): v is FieldSector {
  return typeof v === 'string' && (FIELD_SECTORS as readonly string[]).includes(v);
}

function isStandingLevel(v: unknown): v is StandingLevel {
  return typeof v === 'string' && (STANDING_LEVELS as readonly string[]).includes(v);
}

/**
 * Coerce an untrusted delta payload into a taxonomy-legal `AtlasPlateDelta`.
 * The goal becomes the plate title when the caller supplies none; sectors and
 * standings outside the canon taxonomy fall back to safe defaults (the engine's
 * `law.compose.delta-in-taxonomy` stays the fail-closed backstop). Pure.
 */
export function coerceAtlasDelta(goal: string, raw?: unknown): AtlasPlateDelta {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const relatedSectors = Array.isArray(r.relatedSectors)
    ? (r.relatedSectors.filter(isFieldSector) as FieldSector[])
    : undefined;
  const readoutsRaw = (r.readouts && typeof r.readouts === 'object' ? r.readouts : {}) as Record<string, unknown>;
  const gs = typeof readoutsRaw.gs === 'string' ? readoutsRaw.gs : undefined;
  const alt = typeof readoutsRaw.alt === 'string' ? readoutsRaw.alt : undefined;
  return {
    activeSector: isFieldSector(r.activeSector) ? r.activeSector : 'reasoning',
    standing: isStandingLevel(r.standing) ? r.standing : 'validated',
    ...(relatedSectors && relatedSectors.length ? { relatedSectors } : {}),
    title:
      typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 120) : goal.trim().slice(0, 120),
    ...(typeof r.caption === 'string' && r.caption.trim() ? { caption: r.caption.trim().slice(0, 240) } : {}),
    ...(gs !== undefined || alt !== undefined ? { readouts: { ...(gs !== undefined ? { gs } : {}), ...(alt !== undefined ? { alt } : {}) } } : {}),
  };
}

export interface StudioCompositionRequestInput {
  /** The operator's goal — becomes the plate title unless the delta names one. */
  goal: string;
  mode: 'propose' | 'publish';
  /** T2-safe one-way actor commitment (route-computed) — NEVER a personaId. */
  actorCommitment: string;
  /** Interpretation to render under; default = registry default (house style). */
  interpretationId?: string;
  /** Optional untrusted delta overrides (coerced by `coerceAtlasDelta`). */
  delta?: unknown;
  /** Optional grounding overrides. */
  grounding?: { domains?: string[]; ontologyClassIds?: string[]; invariantRefs?: string[] };
}

function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  return out.length ? out : undefined;
}

/**
 * Build the engine's real `CompositionRequest` from the route body. Mirrors the
 * composition canary's request shape (tests/composition.test.ts plateRequest):
 * the interpretation asset ref (which the InSituAssetResolver expands into its
 * palette/typography/material views) + Bearing Instrument v1. Pure.
 */
export function buildStudioCompositionRequest(input: StudioCompositionRequestInput): CompositionRequest {
  const interpretationId = input.interpretationId ?? DEFAULT_INTERPRETATION_ID;
  const assets: AssetRef[] = [
    { kind: 'interpretation', ref: interpretationId, minStanding: 'validated' },
    { kind: 'bearing-instrument', ref: BEARING_INSTRUMENT_ASSET_REF, minStanding: 'canonical' },
  ];
  return {
    target: 'atlas-plate',
    assets,
    grounding: {
      domains: stringArray(input.grounding?.domains) ?? ['representation', 'constitutional'],
      ...(stringArray(input.grounding?.ontologyClassIds)
        ? { ontologyClassIds: stringArray(input.grounding?.ontologyClassIds) }
        : {}),
      ...(stringArray(input.grounding?.invariantRefs)
        ? { invariantRefs: stringArray(input.grounding?.invariantRefs) }
        : {}),
    },
    delta: coerceAtlasDelta(input.goal, input.delta),
    interpretationId,
    mode: input.mode,
    actorCommitment: input.actorCommitment,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Publish projection — the route-layer half of the engine's PUBLISH SEAM
// ─────────────────────────────────────────────────────────────────────────

/** The single `artifact_published` receipt summary line (T2-safe: a content-hash
 *  prefix, never a subject identifier). Pure. */
export function publishSummaryFor(contentHash: string): string {
  return `studio composition published — ${contentHash.slice(0, 16)}`;
}

/**
 * Fold the route-minted publish receipt id into the engine's provenance — the
 * projection the composeArtifact PUBLISH SEAM anticipated ("written at the
 * ROUTE layer"). Does NOT mutate the input; composeArtifact itself stays
 * propose-only. Re-guards T0 inexpressibility on the way out (mirrors
 * ccrlResearchPilot.projectPublished). Pure.
 */
export function projectPublishedProvenance(result: CompositionResult, receiptId: string): CompositionResult {
  const projected: CompositionResult = {
    ...result,
    provenance: { ...result.provenance, receiptId },
  };
  const leak = findForbiddenObjectKey(projected);
  if (leak) {
    throw new Error(`published composition leaks a T0 identifier at '${leak}' — refusing to return it`);
  }
  return projected;
}

/**
 * The durable artifact-record body — a JSON projection of the composed artefact
 * + its provenance decomposition, stable enough that the record's content hash
 * (computed by `saveArtifactRecord`) anchors the exact composition. Pure.
 */
export function compositionRecordBody(result: CompositionResult): string {
  return JSON.stringify(
    {
      target: result.target,
      artefact: result.artefact,
      provenance: result.provenance,
      validation: result.validation,
      recommendations: result.recommendations,
    },
    null,
    2,
  );
}
