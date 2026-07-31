/**
 * Reviewer independence — SPEC §8, rulings §3.
 *
 *   > model IDs must differ; model families must differ; aliases resolving to
 *   > the same underlying model must be refused; silent fallback to a shared
 *   > default must be refused; requested AND resolved model IDs must be
 *   > recorded; unknown lineage fails closed.
 *
 * The rationale is the whole point of the second slot: two instances of one
 * model check nothing. A systematic bias in provenance judgement appears in
 * both, and the second review confirms rather than tests. Shared hosting is an
 * acceptable correlate; shared weights are not.
 *
 * The failure this guards is specifically the one a requested-ID check cannot
 * see: two distinct-looking aliases that expand to the same weights. Hence the
 * resolved-ID comparison, and hence the refusal to proceed when a catalogue
 * will not tell us what an ID resolved to.
 */

import { ReviewRefusal, type ReviewerAssignment } from './types';

/**
 * A provider's catalogue entry, normalised.
 *
 * Field names here are OURS. `parseCatalogueEntry` maps a provider payload into
 * this shape and returns `family: null` when it cannot determine lineage from
 * the payload it actually received — rather than guessing a plausible family
 * name, which would defeat the check it exists to perform.
 */
export interface ModelCatalogueEntry {
  id: string;
  /** Lineage. `null` when the payload does not disclose it — fails closed. */
  family: string | null;
  /** Which field the family was read from, so lineage is auditable. */
  familyEvidence: string | null;
  offline: boolean;
  /** ISO date, when the provider publishes one. */
  deprecationDate: string | null;
  /** The entry as received, for the manifest. */
  raw: Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function firstString(source: Record<string, unknown>, keys: readonly string[]): { value: string; key: string } | null {
  for (const k of keys) {
    const v = source[k];
    if (typeof v === 'string' && v.trim().length > 0) return { value: v.trim(), key: k };
  }
  return null;
}

/**
 * Candidate lineage fields, in preference order. An explicit family/lineage
 * field beats a source URL; a source URL beats an owner string, because an
 * owner can be the host rather than the trainer.
 *
 * This list is deliberately a list of CANDIDATES rather than an assertion about
 * any provider's schema. If none of them is present, lineage is unknown and the
 * run is refused — which is the correct outcome and not a bug to be worked
 * around by inventing a field name.
 */
const FAMILY_FIELDS = ['modelFamily', 'model_family', 'family', 'lineage', 'modelSource', 'model_source'] as const;
const OWNER_FIELDS = ['owned_by', 'ownedBy', 'organization', 'org'] as const;
const OFFLINE_FIELDS = ['offline', 'isOffline', 'unavailable'] as const;
const DEPRECATION_FIELDS = ['deprecation_date', 'deprecationDate', 'deprecated_at', 'sunset_date'] as const;

/**
 * Derive a comparable family token.
 *
 * When the value looks like a model-hosting URL (`.../<org>/<model>`), the
 * organisation segment is the lineage signal — two models from the same trainer
 * share the org, two models from different trainers do not. When it is a bare
 * string, it is used as given, lowercased.
 */
export function normaliseFamily(value: string): string {
  const trimmed = value.trim();
  const urlish = /^https?:\/\//i.test(trimmed);
  if (urlish) {
    const parts = trimmed.replace(/^https?:\/\//i, '').split('/').filter(Boolean);
    // host, org, model → the org segment is index 1.
    if (parts.length >= 2) return parts[1].toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function parseCatalogueEntry(raw: unknown): ModelCatalogueEntry | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = typeof rec.id === 'string' ? rec.id : typeof rec.model === 'string' ? rec.model : null;
  if (!id) return null;

  const spec = asRecord(rec.model_spec) ?? asRecord(rec.modelSpec) ?? {};
  const merged: Record<string, unknown> = { ...spec, ...rec };

  const familyHit = firstString(merged, FAMILY_FIELDS) ?? firstString(merged, OWNER_FIELDS);
  const offline = OFFLINE_FIELDS.some((k) => merged[k] === true);
  const depHit = firstString(merged, DEPRECATION_FIELDS);

  return {
    id,
    family: familyHit ? normaliseFamily(familyHit.value) : null,
    familyEvidence: familyHit ? familyHit.key : null,
    offline,
    deprecationDate: depHit ? depHit.value : null,
    raw: rec,
  };
}

export interface PinnedReviewerModel {
  provider: string;
  /** A FIXED model id. Aliases are refused — reproducibility needs a fixed id. */
  modelId: string;
  /** Operator-declared lineage, recorded next to the derived family. */
  declaredLineage: string;
}

export interface ReviewerPairSpec {
  pairVersion: string;
  /** Why this pair, in the operator's terms. Amendments are versioned. */
  rationale: string;
  R1: PinnedReviewerModel;
  R2: PinnedReviewerModel;
}

export interface CatalogueVerification {
  slot: 'R1' | 'R2';
  requestedModelId: string;
  resolvedModelId: string;
  family: string;
  familyEvidence: string;
  declaredLineage: string;
}

/**
 * Verify a pinned pair against a live catalogue, at the moment of the run.
 *
 * Refuses when a pinned id is absent, offline, carries an applicable
 * deprecation date, or has undeterminable lineage. There is deliberately no
 * substitution path: an unavailable pinned model requires a versioned
 * reviewer-pair amendment, not a fallback. A fallback is how both slots end up
 * on the provider's default model without anyone deciding to do that.
 */
export function verifyPinnedPairAgainstCatalogue(
  pair: ReviewerPairSpec,
  catalogue: readonly ModelCatalogueEntry[],
  runAtIso: string,
): { R1: CatalogueVerification; R2: CatalogueVerification } {
  const check = (slot: 'R1' | 'R2'): CatalogueVerification => {
    const pinned = pair[slot];
    const entry = catalogue.find((e) => e.id === pinned.modelId);
    if (!entry) {
      throw new ReviewRefusal(
        'pinned-model-unavailable',
        `${slot} pinned model '${pinned.modelId}' is not in the ${pinned.provider} catalogue. ` +
          `Refusing the run: a reviewer-pair change requires a versioned amendment to pair ` +
          `'${pair.pairVersion}', never a substitution at run time.`,
      );
    }
    if (entry.offline) {
      throw new ReviewRefusal(
        'pinned-model-offline',
        `${slot} pinned model '${pinned.modelId}' is marked offline. Refusing the run.`,
      );
    }
    if (entry.deprecationDate && entry.deprecationDate <= runAtIso) {
      throw new ReviewRefusal(
        'pinned-model-deprecated',
        `${slot} pinned model '${pinned.modelId}' has an applicable deprecation date ` +
          `(${entry.deprecationDate} <= ${runAtIso}). Refusing the run.`,
      );
    }
    if (!entry.family || !entry.familyEvidence) {
      throw new ReviewRefusal(
        'unknown-model-lineage',
        `${slot} pinned model '${pinned.modelId}' discloses no family or source metadata, so its ` +
          'lineage cannot be determined. Unknown lineage fails closed (SPEC §8).',
      );
    }
    return {
      slot,
      requestedModelId: pinned.modelId,
      resolvedModelId: entry.id,
      family: entry.family,
      familyEvidence: entry.familyEvidence,
      declaredLineage: pinned.declaredLineage,
    };
  };
  const R1 = check('R1');
  const R2 = check('R2');
  if (R1.family === R2.family) {
    throw new ReviewRefusal(
      'shared-model-family',
      `both reviewers resolve to family '${R1.family}'. Two instances of one lineage do not ` +
        'constitute independent review (SPEC §8).',
    );
  }
  return { R1, R2 };
}

/**
 * The assignment-level gate, applied to whatever the two slots ended up being —
 * model or human, same provider or not.
 *
 * Human slots are exempt from the model checks and subject to their own: a
 * human reviewer must be attributable, and the two slots must not be the same
 * person for the same reason two instances of one model are not two reviewers.
 */
export function assertReviewerIndependence(r1: ReviewerAssignment, r2: ReviewerAssignment): void {
  if (r1.reviewerSlot !== 'R1' || r2.reviewerSlot !== 'R2') {
    throw new ReviewRefusal('slot-mismatch', 'dual review requires exactly one R1 assignment and one R2 assignment');
  }

  const humans = [r1, r2].filter((r) => r.reviewerType === 'human');
  for (const h of humans) {
    if (!h.humanReviewerRef?.trim()) {
      throw new ReviewRefusal(
        'unattributable-human-reviewer',
        `${h.reviewerSlot} is a human slot with no humanReviewerRef; review must be attributable (SPEC §16)`,
      );
    }
  }
  if (
    r1.reviewerType === 'human' &&
    r2.reviewerType === 'human' &&
    r1.humanReviewerRef === r2.humanReviewerRef
  ) {
    throw new ReviewRefusal('same-human-both-slots', 'one person cannot occupy both reviewer slots');
  }

  const models = [r1, r2].filter((r) => r.reviewerType !== 'human');
  if (models.length < 2) return; // at least one human slot — model checks do not apply

  for (const m of models) {
    if (!m.requestedModelId?.trim()) {
      throw new ReviewRefusal('missing-requested-model', `${m.reviewerSlot} has no requestedModelId recorded`);
    }
    if (!m.resolvedModelId?.trim()) {
      throw new ReviewRefusal(
        'unresolved-model-id',
        `${m.reviewerSlot} has no resolvedModelId. A requested-id check alone cannot see two aliases ` +
          'expanding to the same weights, so an unresolved id fails closed (rulings §3).',
      );
    }
    if (!m.modelFamily?.trim()) {
      throw new ReviewRefusal('unknown-model-lineage', `${m.reviewerSlot} has no modelFamily — unknown lineage fails closed`);
    }
  }

  if (r1.requestedModelId === r2.requestedModelId) {
    throw new ReviewRefusal('identical-requested-model', `both slots requested '${r1.requestedModelId}'`);
  }
  if (r1.resolvedModelId === r2.resolvedModelId) {
    throw new ReviewRefusal(
      'alias-collision',
      `both slots resolved to '${r1.resolvedModelId}' despite differing requested ids — ` +
        'aliases expanding to the same underlying model are refused (rulings §3)',
    );
  }
  if (normaliseFamily(r1.modelFamily!) === normaliseFamily(r2.modelFamily!)) {
    throw new ReviewRefusal(
      'shared-model-family',
      `both slots are family '${r1.modelFamily}' — shared hosting is acceptable, shared weights are not`,
    );
  }
}
