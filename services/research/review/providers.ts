/**
 * Provider interface — reviewers are pluggable, not wired to one vendor.
 *
 * SPEC §3: reviewers may be external models, internal models or humans, and a
 * human may occupy either slot using the same package, rubric and output
 * schema. That is only true if the dispatch path never names a vendor. So the
 * adjudication path depends on `ReviewProvider` and nothing else; the vendor
 * lives in one implementation behind it.
 *
 * Three implementations ship, and the second and third are not decoration:
 *
 *   veniceProvider      — the default external-model reviewer.
 *   scriptedProvider    — a deterministic stub. Proves the seam is real (a
 *                         second implementation compiles and runs through the
 *                         identical path) and lets every canary exercise the
 *                         full runner with no network and no credential.
 *   fileBackedProvider  — a human slot. The Independent Review Steward reviews
 *                         the same frozen package and returns the same decision
 *                         schema; the runner cannot tell the difference, which
 *                         is exactly the property SPEC §3 asks for.
 *
 * Credential handling: absence is LOUD. A provider that cannot authenticate
 * refuses at construction. It does not skip the reviewer, it does not fall back
 * to another model, and it does not return an empty decision set that a caller
 * could mistake for "the reviewer found nothing".
 */

import { callVeniceChatRaw, listVeniceModels, veniceCredentialPresent } from '@/services/agents/_lib/llmDraftHelper';
import { ReviewRefusal } from './types';
import { parseCatalogueEntry, type ModelCatalogueEntry } from './reviewerIndependence';

export interface AdjudicationRequest {
  modelId: string;
  system: string;
  user: string;
  /** Recorded in the manifest and passed to the provider where supported. */
  determinism: DeterminismSettings;
}

export interface DeterminismSettings {
  temperature: number;
  topP?: number;
  seed?: number;
  maxTokens: number;
}

export interface AdjudicationResponse {
  /** The provider's raw text, unmodified. Hashed and stored before parsing. */
  raw: string;
  /** What the provider says it actually served, when it says anything. */
  servedModelId?: string;
}

export interface ReviewProvider {
  readonly providerName: string;
  /** Whether this provider can enumerate models. Human slots cannot. */
  readonly supportsCatalogue: boolean;
  listModels(): Promise<ModelCatalogueEntry[]>;
  adjudicate(request: AdjudicationRequest): Promise<AdjudicationResponse>;
}

/**
 * Determinism settings committed BEFORE a run (rulings §7). Temperature 0 is
 * not a guarantee of identical output — no hosted model offers one — which is
 * why the raw output is hashed and stored rather than assumed reproducible.
 * What this fixes is the SETTINGS, so a rerun differs in the model's sampling
 * and in nothing we control.
 */
export const DEFAULT_DETERMINISM: DeterminismSettings = {
  temperature: 0,
  topP: 1,
  maxTokens: 8000,
};

// ── Venice ──────────────────────────────────────────────────────────────────

export function createVeniceProvider(): ReviewProvider {
  if (!veniceCredentialPresent()) {
    throw new ReviewRefusal(
      'missing-provider-credential',
      'VENICE_API_KEY is not set. The independent-review runner refuses to proceed rather than ' +
        'skipping a reviewer or degrading to another provider: a review that did not happen must ' +
        'never be recorded as a review that found nothing. Set VENICE_API_KEY in the server ' +
        'environment (never NEXT_PUBLIC_, never committed) and re-run.',
    );
  }
  return {
    providerName: 'venice',
    supportsCatalogue: true,
    async listModels() {
      const res = await listVeniceModels('text');
      if (!res.ok) {
        throw new ReviewRefusal(
          'catalogue-unreachable',
          `Venice model catalogue could not be read (${res.error ?? `HTTP ${res.status}`}). ` +
            'Refusing the run: reviewer lineage cannot be verified against a catalogue we did not receive.',
        );
      }
      const entries = res.models.map(parseCatalogueEntry).filter((e): e is ModelCatalogueEntry => e !== null);
      if (entries.length === 0) {
        throw new ReviewRefusal('catalogue-empty', 'Venice returned no parseable text models; refusing the run');
      }
      return entries;
    },
    async adjudicate(request) {
      const res = await callVeniceChatRaw({
        model: request.modelId,
        system: request.system,
        user: request.user,
        temperature: request.determinism.temperature,
        topP: request.determinism.topP,
        seed: request.determinism.seed,
        maxTokens: request.determinism.maxTokens,
        timeoutMs: 180_000,
      });
      if (!res.ok || !res.text) {
        throw new ReviewRefusal(
          'reviewer-call-failed',
          `Venice adjudication for '${request.modelId}' failed (${res.error ?? `HTTP ${res.status}`}). ` +
            'The run stops here; a partial review is not a review.',
        );
      }
      return { raw: res.text, servedModelId: request.modelId };
    },
  };
}

// ── Scripted stub (second implementation of the same seam) ──────────────────

/**
 * A provider whose answers are supplied up front. No network, no credential,
 * no clock. Used by every canary to drive the real runner end to end, and by
 * `--plan` runs to show what the dispatch would look like.
 */
export function createScriptedProvider(input: {
  providerName?: string;
  catalogue?: ModelCatalogueEntry[];
  /** modelId → raw response text. */
  responses: Record<string, string>;
  onCall?: (request: AdjudicationRequest) => void;
}): ReviewProvider {
  return {
    providerName: input.providerName ?? 'scripted',
    supportsCatalogue: Boolean(input.catalogue),
    async listModels() {
      if (!input.catalogue) {
        throw new ReviewRefusal('catalogue-unsupported', 'this provider does not publish a model catalogue');
      }
      return input.catalogue;
    },
    async adjudicate(request) {
      input.onCall?.(request);
      const raw = input.responses[request.modelId];
      if (raw === undefined) {
        throw new ReviewRefusal(
          'reviewer-call-failed',
          `scripted provider has no response for '${request.modelId}'`,
        );
      }
      return { raw, servedModelId: request.modelId };
    },
  };
}

// ── Human slot ──────────────────────────────────────────────────────────────

/**
 * A human reviewer, reached through a file of decisions in the same schema a
 * model returns.
 *
 * `supportsCatalogue` is false and `listModels` refuses: a human has no model
 * lineage, and pretending otherwise would let a human slot satisfy a
 * distinct-family check by accident. The independence rules for human slots are
 * separate and live in `assertReviewerIndependence`.
 */
export function createFileBackedProvider(input: {
  reviewerRef: string;
  /** The steward's already-written adjudication, in DECISION_OUTPUT_SCHEMA form. */
  rawDecisions: string;
}): ReviewProvider {
  if (!input.reviewerRef.trim()) {
    throw new ReviewRefusal('unattributable-human-reviewer', 'a human reviewer slot requires an attributable reviewerRef');
  }
  if (!input.rawDecisions.trim()) {
    throw new ReviewRefusal('empty-human-adjudication', `no adjudication supplied for human reviewer ${input.reviewerRef}`);
  }
  return {
    providerName: 'human',
    supportsCatalogue: false,
    async listModels() {
      throw new ReviewRefusal(
        'catalogue-unsupported',
        'a human reviewer has no model catalogue; human-slot independence is checked separately',
      );
    },
    async adjudicate() {
      return { raw: input.rawDecisions };
    },
  };
}
