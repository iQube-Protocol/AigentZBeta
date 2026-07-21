/**
 * businessArtifactTiering — AgentMe business-artifact production wired into the
 * Artifact Runtime's consequence model (CFS-025 increment 3).
 *
 * AgentMe's create-artifact surface (`app/api/assistant/create-artifact`)
 * produces BUSINESS artifacts through Google connectors (a doc, a sheet, a
 * deck, a calendar event, a gmail draft). This module assigns each production
 * a consequence tier so those artifacts participate in the same
 * disposable | operational | constitutional ladder as delegate productions —
 * WITHOUT changing how the artifacts are created.
 *
 * Tiering rules (deliberate, pinned by tests/business-artifact-tiering.test.ts):
 *
 *   - A gmail DRAFT is DISPOSABLE. It is a scratch object living in the
 *     operator's Gmail until sent (the send path is a separate, approval-gated
 *     concern this module never touches). Disposable is NEVER persisted —
 *     that is its definition (artifactRecordStore header).
 *   - Docs / sheets / slides / calendar events are OPERATIONAL — real work
 *     product, versioned in the operator's Drive/Calendar, worth a durable
 *     record — under profile 'documentation' (docs, sheets, calendar) or
 *     'presentation' (slides).
 *   - NOTHING here maps to constitutional. A business artifact is never BORN
 *     constitutional; the operator PROMOTES it later (canPromote →
 *     promoteArtifactRecord), the same maturation discipline as every other
 *     CFS-025 artifact. The return type makes this structurally impossible.
 *   - An UNKNOWN connector id classifies disposable — fail-safe: we never
 *     persist what we cannot name.
 *
 * Failure isolation: the impure functions are best-effort and NEVER throw.
 * The existing create-artifact flow must keep working byte-for-byte when
 * anything in here fails.
 *
 * TIER DISCIPLINE: no T0 identifier crosses this module. The record body is a
 * compact pointer {connectorId, locationUrl, title} — never document contents,
 * never a personaId.
 */

import type { ArtifactProfileId } from '@/types/artifactRuntime';
import { saveArtifactRecord } from '@/services/artifact/artifactRecordStore';

/** The tier a business-artifact production runs under. Never constitutional. */
export interface BusinessArtifactTier {
  profile: ArtifactProfileId;
  consequenceClass: 'disposable' | 'operational';
}

/**
 * The classification map — creation connector id → tier. PURE data; the single
 * authoritative home for business-artifact tiering (extend here, never inline
 * in the route).
 */
const BUSINESS_ARTIFACT_TIERS: Record<string, BusinessArtifactTier> = {
  // A draft is scratch until sent — disposable, never persisted.
  'google.gmail.draft': { profile: 'documentation', consequenceClass: 'disposable' },
  // Real work product in the operator's Drive/Calendar — operational.
  'google.drive.create-doc': { profile: 'documentation', consequenceClass: 'operational' },
  'google.sheets.create': { profile: 'documentation', consequenceClass: 'operational' },
  'google.slides.create': { profile: 'presentation', consequenceClass: 'operational' },
  'google.calendar.create-event': { profile: 'documentation', consequenceClass: 'operational' },
};

/** Fail-safe default for connectors the map does not name: disposable. */
const UNKNOWN_TIER: BusinessArtifactTier = {
  profile: 'documentation',
  consequenceClass: 'disposable',
};

/**
 * Classify a business-artifact production by its creation connector id.
 * PURE + total: never throws, unknown ids fall to the disposable default.
 */
export function classifyBusinessArtifact(connectorId: string): BusinessArtifactTier {
  return BUSINESS_ARTIFACT_TIERS[connectorId] ?? UNKNOWN_TIER;
}

export interface RecordBusinessArtifactInput {
  /** The CREATION connector that produced the artifact (classification key). */
  connectorId: string;
  /** The route-synthesised artifact id (`art_...`). */
  artifactId: string;
  /** The artifact's user-facing label. */
  title: string;
  /** Where the artifact lives (Google URL). Pointer only — never contents. */
  locationUrl?: string | null;
  /** The `artifact_created` receipt id, when one was written. */
  receiptId?: string | null;
  /** The user goal, if available — becomes the record's brief. */
  goal?: string | null;
}

/**
 * Persist an OPERATIONAL business-artifact production as a durable
 * ArtifactRecord (delegate 'agentme'). Disposable classifications return null
 * without touching storage — disposable is NEVER persisted. Best-effort +
 * failure-isolated: returns the record id or null, NEVER throws.
 */
export async function recordBusinessArtifact(input: RecordBusinessArtifactInput): Promise<string | null> {
  try {
    const { profile, consequenceClass } = classifyBusinessArtifact(input.connectorId);
    if (consequenceClass !== 'operational') return null;
    return await saveArtifactRecord({
      artifactId: input.artifactId,
      profile,
      consequenceClass: 'operational',
      delegate: 'agentme',
      title: input.title,
      brief: input.goal ?? input.title,
      // A compact pointer to the artifact — NOT the document contents.
      body: JSON.stringify({
        connectorId: input.connectorId,
        locationUrl: input.locationUrl ?? null,
        title: input.title,
      }),
      receiptId: input.receiptId ?? null,
      sovereignty: null,
    });
  } catch (e) {
    console.warn(
      '[business artifact tiering] record failed (non-fatal):',
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * The one-call seam for the create-artifact route: classify, persist when
 * operational, and return the ADDITIVE surface fields to spread onto the
 * artifact card. Never throws; on any failure the tier still comes from the
 * pure map and `artifactRecordId` is simply absent.
 */
export async function tierBusinessArtifact(
  input: RecordBusinessArtifactInput,
): Promise<{ consequenceClass: 'disposable' | 'operational'; artifactRecordId?: string }> {
  const { consequenceClass } = classifyBusinessArtifact(input.connectorId);
  if (consequenceClass !== 'operational') return { consequenceClass };
  const artifactRecordId = await recordBusinessArtifact(input);
  return artifactRecordId ? { consequenceClass, artifactRecordId } : { consequenceClass };
}
