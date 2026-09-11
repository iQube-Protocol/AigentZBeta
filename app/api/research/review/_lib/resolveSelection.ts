/**
 * Server-side reviewer selection — the AUTHORITATIVE same-family guard.
 *
 * The UI disables same-family options in its dropdown. That is a UX affordance,
 * not a control: a direct POST bypasses it entirely, and a reviewer pair that
 * is two instances of one lineage checks nothing while looking like dual
 * review. So the decision is made HERE, from metadata the server fetched
 * itself, and the client's opinion about families is never read.
 *
 * Two properties make that true rather than merely stated:
 *
 *   1. The request body carries only MODEL IDS (and, for a human slot, a
 *      reviewer ref). There is no field for a family, so a client cannot assert
 *      one — the shape of the input makes the lie unrepresentable.
 *   2. Families are resolved from the live catalogue via the same
 *      `parseCatalogueEntry` the CLI runner uses, and the same
 *      `assertReviewerIndependence` decides. One derivation, one decision,
 *      shared by the API and the CLI. The UI's disabled-option logic is
 *      DERIVED from the very response this module's catalogue endpoint returns,
 *      so the list a human sees and the rule the server enforces cannot drift.
 */

import {
  assertReviewerIndependence,
  createVeniceProvider,
  DEFAULT_DETERMINISM,
  INDEPENDENCE_PROMPT_VERSION,
  INDEPENDENCE_RUBRIC_VERSION,
  ReviewRefusal,
  type ModelCatalogueEntry,
  type ReviewerAssignment,
  type ReviewerSlot,
} from '@/services/research/review';
import { EXP_P1_REVIEWER_PAIR } from '@/services/research/review/templates/expP1Admissibility';

/** What a client may say about a reviewer slot. Note the absence of a family. */
export interface ReviewerSlotSelection {
  reviewerType: 'external-model' | 'human';
  /** Required when `reviewerType` is 'external-model'. */
  modelId?: string;
  /** Required when `reviewerType` is 'human'. */
  humanReviewerRef?: string;
}

export interface SelectableModel {
  id: string;
  family: string | null;
  familyEvidence: string | null;
  offline: boolean;
  deprecationDate: string | null;
  /** Whether this id may be chosen at all — lineage-unknown models may not. */
  selectable: boolean;
  unselectableReason: string | null;
}

/** The catalogue as the UI receives it: ids WITH their server-derived family. */
export function toSelectableModels(catalogue: readonly ModelCatalogueEntry[], runAtIso: string): SelectableModel[] {
  return catalogue
    .map((e) => {
      const deprecated = Boolean(e.deprecationDate && e.deprecationDate <= runAtIso);
      const unselectableReason = !e.family
        ? 'lineage cannot be determined from the catalogue — unknown lineage fails closed'
        : e.offline
          ? 'marked offline by the provider'
          : deprecated
            ? `deprecated (${e.deprecationDate})`
            : null;
      return {
        id: e.id,
        family: e.family,
        familyEvidence: e.familyEvidence,
        offline: e.offline,
        deprecationDate: e.deprecationDate,
        selectable: unselectableReason === null,
        unselectableReason,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface ResolvedSelection {
  assignments: [ReviewerAssignment, ReviewerAssignment];
  /** True when either slot differs from the ratified default pair. */
  isPairAmendment: boolean;
  amendedFrom: string;
}

/**
 * Resolve a client selection into two verified assignments, or throw.
 *
 * Defaults to the ratified pair when a slot is omitted. A slot that differs
 * from the default is recorded as a versioned pair AMENDMENT rather than
 * absorbed silently — the manifest and the receipt carry requested and resolved
 * ids either way, but a changed pair must be visible AS a change.
 */
export function resolveReviewerSelection(input: {
  selection: Partial<Record<ReviewerSlot, ReviewerSlotSelection>>;
  catalogue: readonly ModelCatalogueEntry[];
  runAtIso: string;
}): ResolvedSelection {
  const build = (slot: ReviewerSlot): ReviewerAssignment => {
    const chosen = input.selection[slot];
    const base = {
      reviewerSlot: slot,
      promptVersion: INDEPENDENCE_PROMPT_VERSION,
      rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    } as const;

    if (chosen?.reviewerType === 'human') {
      if (!chosen.humanReviewerRef?.trim()) {
        throw new ReviewRefusal(
          'unattributable-human-reviewer',
          `${slot} was selected as a human slot with no reviewer reference; review must be attributable`,
        );
      }
      return {
        ...base,
        reviewerType: 'human',
        humanReviewerRef: chosen.humanReviewerRef.trim(),
        humanReviewerRole: 'independent-review-steward',
      };
    }

    const pinned = EXP_P1_REVIEWER_PAIR[slot];
    const requestedModelId = chosen?.modelId?.trim() || pinned.modelId;
    const entry = input.catalogue.find((e) => e.id === requestedModelId);
    if (!entry) {
      throw new ReviewRefusal(
        'pinned-model-unavailable',
        `${slot} model '${requestedModelId}' is not in the provider catalogue. Refusing: a reviewer ` +
          'change is a versioned pair amendment, never a run-time substitution.',
      );
    }
    if (entry.offline) {
      throw new ReviewRefusal('pinned-model-offline', `${slot} model '${requestedModelId}' is marked offline`);
    }
    if (entry.deprecationDate && entry.deprecationDate <= input.runAtIso) {
      throw new ReviewRefusal(
        'pinned-model-deprecated',
        `${slot} model '${requestedModelId}' has an applicable deprecation date (${entry.deprecationDate})`,
      );
    }
    if (!entry.family || !entry.familyEvidence) {
      throw new ReviewRefusal(
        'unknown-model-lineage',
        `${slot} model '${requestedModelId}' discloses no family or source metadata; unknown lineage fails closed`,
      );
    }
    return {
      ...base,
      reviewerType: 'external-model',
      provider: pinned.provider,
      requestedModelId,
      resolvedModelId: entry.id,
      // Server-derived. The client never supplies this and cannot influence it.
      modelFamily: entry.family,
      modelFamilyEvidence: entry.familyEvidence,
      declaredLineage: requestedModelId === pinned.modelId ? pinned.declaredLineage : 'operator-selected, lineage read from the provider catalogue',
      determinismSettings: { ...DEFAULT_DETERMINISM },
    };
  };

  const r1 = build('R1');
  const r2 = build('R2');
  // The one decision. Same function the CLI uses; same refusals.
  assertReviewerIndependence(r1, r2);

  const isPairAmendment =
    (r1.reviewerType === 'external-model' && r1.requestedModelId !== EXP_P1_REVIEWER_PAIR.R1.modelId) ||
    (r2.reviewerType === 'external-model' && r2.requestedModelId !== EXP_P1_REVIEWER_PAIR.R2.modelId) ||
    r1.reviewerType === 'human' ||
    r2.reviewerType === 'human';

  return { assignments: [r1, r2], isPairAmendment, amendedFrom: EXP_P1_REVIEWER_PAIR.pairVersion };
}

/** The provider used by the API surface. Absence of a credential is loud. */
export function reviewProvider() {
  return createVeniceProvider();
}
