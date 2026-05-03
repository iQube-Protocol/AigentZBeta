/**
 * Card Access Resolver — single source of truth for what a content card renders
 *
 * Every surface (KnytTab Scrolls/Characters, KnytStageTemplates,
 * CartridgeRuntimeTemplate, Qriptopian tabs, metaMe experience qubes, Terra,
 * community panels) consults this function to decide what UI affordances
 * appear on a content card given the persona's access state.
 *
 * The contract — given a content item and a persona context, return a
 * CardActions object specifying what to render and how to route clicks.
 *
 * Three invariants the resolver enforces:
 *   1. Shopping cart is reserved for payment-gated, not-yet-owned content.
 *   2. Smart Actions render ONLY when access is established.
 *   3. Anonymous users on payment-gated cards see the cart and click → sign-in
 *      modal (with intent preservation: post-auth, the purchase modal opens).
 */

import { classifyContentGating, type Gating } from './contentGating';

export interface CardContent {
  id: string;
  /** Optional pre-stamped gating from the loader. */
  gating?: Gating;
  /** Underlying DB shape hints used by the classifier when gating is unset. */
  contentType?: string | null;
  assetKind?: string | null;
  episodeNumber?: number | null;
  /** Content with no source-row identity (Terra signal, community post, etc.) — defaults free. */
  source?: 'codex' | 'terra' | 'community' | 'partner' | 'editorial' | 'unknown';
}

export interface CardContext {
  personaId?: string | null;
  /** Asset ids the persona owns (direct + SKU-expanded). */
  ownedAssets: Set<string>;
  /** Credentials the persona holds (e.g. 'investor', 'admin', 'zero-knyt'). */
  credentials: Set<string>;
  /** Wallet-token credentials — keyed by `${contract}:${chainId}`. Stub for now. */
  walletTokens?: Set<string>;
}

export interface CardActions {
  /** Render the Read/Watch/Listen smart-action buttons. */
  showSmartActions: boolean;
  /** Render the shopping-cart icon (payment-gated, not yet owned). */
  showShoppingCart: boolean;
  /** Render the green "Owned" badge (entitlement-bearing). */
  showOwnedBadge: boolean;
  /**
   * Render the "Accessible" badge (credential-met, not necessarily owned —
   * e.g. an admin can read lore docs without owning them).
   */
  showAccessibleBadge: boolean;
  /**
   * Render a small "Restricted — investor access required" / "Admin only"
   * disclosure. No clickable action, no cart, no smart actions.
   */
  showRestrictedBadge: boolean;
  /** What clicking the cart should do, if showShoppingCart is true. */
  cartCtaTarget: 'sign-in' | 'purchase' | null;
  /** When showRestrictedBadge is true, the human-readable reason. */
  restrictedReason?: string;
  /** When showRestrictedBadge is true, the credential the user lacks. */
  requiredCredential?: string;
  /** Diagnostic — what gate decision led to this result. */
  reason: 'free' | 'owned' | 'credential-met' | 'payment-required' | 'credential-required' | 'token-required';
}

const DEFAULT_FREE: CardActions = {
  showSmartActions: true,
  showShoppingCart: false,
  showOwnedBadge: false,
  showAccessibleBadge: false,
  showRestrictedBadge: false,
  cartCtaTarget: null,
  reason: 'free',
};

function looksLikeCodexId(id: string): boolean {
  // master_content_qubes ids: mk_epNN_<type>_<tier>
  if (/^mk_ep\d{1,4}_/i.test(id)) return true;
  // codex_media_assets ids: UUID v4-ish
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
  return false;
}

export interface EvaluateOptions {
  /**
   * Override the asset-id ownership lookup with an externally-derived flag.
   * Useful when the caller has its own ownership state (e.g. KnytTab tracks
   * ownership by episodeNumber, not by master row id).
   */
  manualOwned?: boolean;
}

/**
 * Decide what a card should render. Pure function — no side effects, safe to
 * call in render. Should be paired with the `useOwnedAssets` /
 * `usePersonaCredentials` hooks in the calling component.
 */
export function evaluateCardActions(content: CardContent, ctx: CardContext, options: EvaluateOptions = {}): CardActions {
  // ── Step 1: Is this content gated at all? ─────────────────────────────────
  // Loader-stamped gating wins. Otherwise infer from the source row's
  // content_type / asset_kind. As a safety net for legacy paths that haven't
  // been migrated to stamp gating, codex-shaped ids default to gated.
  let gating: Gating;
  if (content.gating?.kind) {
    gating = content.gating;
  } else if (content.contentType || content.assetKind) {
    gating = classifyContentGating({
      contentType: content.contentType ?? null,
      assetKind: content.assetKind ?? null,
    });
  } else if (content.source === 'codex' || looksLikeCodexId(content.id)) {
    gating = { kind: 'payment', source: 'category-default' };
  } else {
    return { ...DEFAULT_FREE };
  }

  if (gating.kind === 'free') return { ...DEFAULT_FREE };

  // ── Step 2: Is the persona qualified? ─────────────────────────────────────
  const isOwned = options.manualOwned ?? ctx.ownedAssets.has(content.id);
  if (isOwned) {
    return {
      showSmartActions: true,
      showShoppingCart: false,
      showOwnedBadge: true,
      showAccessibleBadge: false,
      showRestrictedBadge: false,
      cartCtaTarget: null,
      reason: 'owned',
    };
  }

  if (gating.kind === 'credential' && gating.credential) {
    const credentialMet = ctx.credentials.has(gating.credential);
    if (credentialMet) {
      return {
        showSmartActions: true,
        showShoppingCart: false,
        showOwnedBadge: false,
        showAccessibleBadge: true, // accessible (not owned) — e.g. admin lore
        showRestrictedBadge: false,
        cartCtaTarget: null,
        reason: 'credential-met',
      };
    }
    // Credential gate, no credential — restricted, no purchase path
    return {
      showSmartActions: false,
      showShoppingCart: false,
      showOwnedBadge: false,
      showAccessibleBadge: false,
      showRestrictedBadge: true,
      cartCtaTarget: null,
      reason: 'credential-required',
      requiredCredential: gating.credential,
      restrictedReason: gating.reason ?? `Requires ${gating.credential} credential`,
    };
  }

  // Payment gate, not owned → cart. Anonymous routes through sign-in first.
  return {
    showSmartActions: false,
    showShoppingCart: true,
    showOwnedBadge: false,
    showAccessibleBadge: false,
    showRestrictedBadge: false,
    cartCtaTarget: ctx.personaId ? 'purchase' : 'sign-in',
    reason: 'payment-required',
  };
}
