/**
 * Content Gating Classifier
 *
 * Deny-by-tag, default-free model:
 *   • A content row's gating_kind column is authoritative when set.
 *   • When NULL, falls back to category-derived defaults (paid/credentialed
 *     kinds get stamped; everything else stays free).
 *   • Loaders stamp the resulting Gating object on every Smart Content item
 *     so downstream surfaces (SmartContentActions, SmartTriadSurfaces gate
 *     evaluator, ContentViewer) act on it uniformly.
 *
 * This file is the SINGLE SOURCE OF TRUTH for which content kinds are gated.
 * To add a new gated kind, edit CATEGORY_DEFAULTS below — every loader and
 * every gate consumer picks up the change automatically.
 */

export type GatingKind = 'free' | 'payment' | 'credential';

export interface Gating {
  kind: GatingKind;
  /** Credential id required when kind='credential'. e.g. 'admin' | 'investor' | 'partner' | 'zero-knyt'. */
  credential?: string;
  /** Optional advisory price for the payment path (USD). */
  priceUsd?: number;
  /** Human-readable reason for display when locked. */
  reason?: string;
  /** Trace: where did this gating come from? Useful for audit / debugging. */
  source?: 'row' | 'category-default' | 'unknown-fallback';
}

/**
 * Category-derived defaults applied when a row's gating_kind column is NULL.
 * Anything not listed here defaults to FREE — preserves the operator's
 * default-free invariant so editorial / community / partner content stays
 * unrestricted unless explicitly stamped.
 */
const CATEGORY_DEFAULTS: Record<string, Gating> = {
  // master_content_qubes.content_type → all episode formats payment-gated
  episode_still:  { kind: 'payment', source: 'category-default', reason: 'Episode access requires purchase or bundle ownership.' },
  episode_motion: { kind: 'payment', source: 'category-default', reason: 'Motion comic access requires purchase or bundle ownership.' },
  episode_print:  { kind: 'payment', source: 'category-default', reason: 'Print edition access requires purchase or bundle ownership.' },

  // codex_media_assets.asset_kind → character cards payment-gated; lore admin-gated
  character_poster:        { kind: 'payment',    source: 'category-default', reason: 'Character card access requires purchase or bundle ownership.' },
  background_lore_doc:     { kind: 'credential', credential: 'admin', source: 'category-default', reason: 'Lore docs are restricted to keepers.' },
  powers_sheet:            { kind: 'credential', credential: 'admin', source: 'category-default', reason: 'Powers sheets are restricted to keepers.' },
  twenty_one_sats_concept: { kind: 'credential', credential: 'admin', source: 'category-default', reason: 'Concept docs are restricted to keepers.' },

  // EVERYTHING ELSE — bundle_pack, ra_badge, cover_*, game_*, social_* — stays
  // free. They are display/promotional/preview imagery, not the gated payload.
};

const FREE: Gating = { kind: 'free', source: 'unknown-fallback' };

interface ClassifierInput {
  /** Operator-overridable column on master_content_qubes / codex_media_assets. */
  gating_kind?: GatingKind | null;
  gating_credential?: string | null;
  /** master_content_qubes.content_type or codex_media_assets.asset_kind. */
  contentType?: string | null;
  assetKind?: string | null;
}

/**
 * Classify a row's gating. Row column wins; otherwise category default.
 *
 * IMPORTANT: when neither the column nor the category match a known kind,
 * returns FREE. The user-stated invariant is "false positives (free content
 * locked) are worse than false negatives". The classifier never invents a
 * gate — only paid/credentialed kinds explicitly listed in CATEGORY_DEFAULTS
 * will be stamped.
 */
export function classifyContentGating(input: ClassifierInput): Gating {
  // 1. Row-level operator override is authoritative
  if (input.gating_kind) {
    const g: Gating = { kind: input.gating_kind, source: 'row' };
    if (input.gating_kind === 'credential' && input.gating_credential) {
      g.credential = input.gating_credential;
    }
    return g;
  }

  // 2. Category-derived default
  const category = input.contentType ?? input.assetKind ?? null;
  if (category && CATEGORY_DEFAULTS[category]) {
    return { ...CATEGORY_DEFAULTS[category] };
  }

  // 3. Unknown / unrecognised — default free
  return { ...FREE };
}

/**
 * Convenience: derive Gating from a SmartContent item (or any object with the
 * standard fields). Used by SmartTriadSurfaces gate evaluator when the loader
 * has already stamped the gating, OR when it hasn't (legacy paths) so we
 * still get a sensible default rather than `undefined`.
 */
export function gatingForContent(content: { gating?: Gating; contentType?: string; assetKind?: string }): Gating {
  if (content.gating) return content.gating;
  return classifyContentGating({ contentType: content.contentType, assetKind: content.assetKind });
}
