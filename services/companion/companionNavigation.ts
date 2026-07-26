/**
 * Companion 1.1 — the ONE navigation definition (SCOPE-MMC-004 §4.3, D-3).
 *
 * D-3 as ratified: **shared constitutional navigation with adaptive
 * presentation.** The navigation VOCABULARY is identical on every surface;
 * only the PRESENTATION adapts. So the vocabulary lives here, once, and every
 * surface derives from it — three hand-maintained lists would be the
 * `inv.engineering.036` defect this rule exists to prevent, and the drift
 * would show up as a citizen having to relearn navigation, which is precisely
 * the invariant §4.3 protects.
 *
 * "Adaptive" governs spacing, density and affordance size. It NEVER governs
 * which concepts exist, what they are called, or what order they appear in.
 * That is why `COMPANION_NAV_ITEMS` is a single frozen tuple and the per-
 * surface record below carries only density.
 *
 * D-10 RESOLVED (operator, 2026-07-26): the item is **Workspace**, not
 * "Workbench". The nav vocabulary now agrees with SPEC-MMC-001 and
 * PRD-MMC-IMPL-003, which named this surface Workspace as a deliberate
 * correction away from an invented label. The §4.3 draft briefly said
 * Workbench and was implemented that way for one commit; the operator's
 * ruling restores the original name, so `tests/companion-capture.test.ts`'s
 * "never reintroduces the workbench mis-naming" prohibition is REINSTATED
 * rather than retired.
 *
 * D-10 ALSO (same ruling): the Companion/copilot nav renders **icons with
 * tooltips**, not text labels. The label is still part of the vocabulary — it
 * is the tooltip and the accessible name — so D-3's "identical vocabulary"
 * invariant is unaffected: what adapts is how the item is *presented*, which
 * is exactly what "adaptive presentation" was scoped to cover.
 *
 * ALSO THE C0 CAPABILITY INVENTORY (§12 C0, §11.1). Companion 1.1 introduces
 * no new capabilities, and that rule is unenforceable without a list of the
 * ones that already ship — so each nav item records the capability it exposes
 * and where that capability was reachable BEFORE 1.1. The canary in
 * `tests/companion-1-1-navigation.test.ts` derives from this rather than
 * restating it.
 */

import type { CompanionSurfaceKind } from '@/types/companion';

// ---------------------------------------------------------------------------
// Vocabulary — identical on every surface (D-3)
// ---------------------------------------------------------------------------

/** The canonical bottom-navigation item set, in canonical order (§4.3). */
export const COMPANION_NAV_ITEMS = [
  'avatar',
  'wallet',
  'agent-me',
  'search',
  'workspace',
  'overlay',
  'activity',
  // SPLIT OUT OF `activity` (operator, 2026-07-26). Observer permissions were
  // rendered underneath the activity Timeline, so the one control that decides
  // what the Observer may see was reached by scrolling past a feed. Consent is
  // not an appendix to history: it is its own destination, and it now occupies
  // the slot the dead close-chevron vacated in the copilot menu row.
  'permissions',
] as const;

/** Derived from the value tuple so the runtime list and the type cannot drift. */
export type CompanionNavItemId = (typeof COMPANION_NAV_ITEMS)[number];

/**
 * The icon each item renders as (D-10). `lucide-react` names, resolved by the
 * consuming component — kept as a name rather than a component so this module
 * stays free of React and remains importable by node-side canaries.
 */
export const COMPANION_NAV_ICON: Record<CompanionNavItemId, string> = {
  avatar: 'UserRound',
  wallet: 'Wallet',
  'agent-me': 'MessageCircle',
  search: 'Search',
  workspace: 'LayoutGrid',
  overlay: 'Layers',
  activity: 'Activity',
  permissions: 'ShieldCheck',
};

/**
 * Display label per item. Part of the vocabulary — NOT surface-adaptive.
 *
 * With D-10's icon presentation these are the TOOLTIP and the accessible
 * name. They remain load-bearing: an icon-only nav with no accessible name is
 * unusable with a screen reader, and "the citizen never has to relearn
 * navigation" (§4.3) is only true if the words behind the icons are stable.
 */
export const COMPANION_NAV_LABEL: Record<CompanionNavItemId, string> = {
  avatar: 'Avatar',
  wallet: 'Wallet',
  'agent-me': 'Agent Me',
  // Operator-set (2026-07-26, revised same day from "Search Registry"). The
  // surface federates over research, the iQube registry, registry assets and
  // libraries, the capability graph, mySoftware and MoneyPenny — "Knowledge
  // Field" names the whole scope rather than the largest source.
  search: 'Search Knowledge Field',
  workspace: 'Workspace',
  overlay: 'Overlay',
  activity: 'Activity',
  permissions: 'Permissions',
};

/**
 * The primary occupant (§1, §3). Agent Me is the Companion; every other item
 * is a peer mode beside it. Stated as a value rather than left implicit in
 * component state so the canary can assert it.
 */
export const COMPANION_PRIMARY_NAV_ITEM: CompanionNavItemId = 'agent-me';

/**
 * `avatar` is not a separate surface — it selects Agent Me and enters the
 * copilot's OWN avatar mode (D-8: the avatar is another renderer of Agent Me,
 * never a second session). `CodexCopilotLayer` already models this as
 * `CopilotMode = 'chat' | 'avatar'` over one conversation, so 1.1 reuses that
 * rather than mounting anything parallel.
 */
export const COMPANION_NAV_ITEM_TO_SURFACE: Record<CompanionNavItemId, CompanionNavItemId> = {
  avatar: 'agent-me',
  wallet: 'wallet',
  'agent-me': 'agent-me',
  search: 'search',
  workspace: 'workspace',
  overlay: 'overlay',
  activity: 'activity',
  permissions: 'permissions',
};

/**
 * The nav items the Copilot's own menu row ALREADY owns.
 *
 * §3.2 as corrected by the operator (2026-07-26): the Copilot is the shell and
 * the Companion is a deployment of it, so there is ONE navigation system.
 * `CodexCopilotLayer`'s footer row already carries an avatar/chat mode toggle
 * and a wallet launcher — those three items need no migration, and re-rendering
 * them beside the copilot's own would give the citizen two controls for one
 * concept.
 *
 * Everything NOT in this set is what a host deployment supplies through
 * `navExtras`. Written here rather than as a literal in the page so the split
 * cannot drift from the vocabulary above (`inv.engineering.036`).
 */
export const COPILOT_NATIVE_NAV_ITEMS = ['avatar', 'wallet', 'agent-me'] as const;

/** Items a host must migrate into the copilot menu itself. */
export function migratedNavItems(): CompanionNavItemId[] {
  const native = new Set<string>(COPILOT_NATIVE_NAV_ITEMS);
  return COMPANION_NAV_ITEMS.filter((id) => !native.has(id));
}

/** Which copilot mode a nav item enters, when it resolves to Agent Me. */
export function copilotModeForNavItem(item: CompanionNavItemId): 'chat' | 'avatar' {
  return item === 'avatar' ? 'avatar' : 'chat';
}

// ---------------------------------------------------------------------------
// Adaptive presentation — density only (D-3)
// ---------------------------------------------------------------------------

export type CompanionNavDensity = 'full' | 'comfortable' | 'compact';

/**
 * Presentation per host surface. Keyed by `CompanionSurfaceKind` so a new
 * surface is a compile error here rather than a silent fallback to someone
 * else's spacing.
 */
export const COMPANION_NAV_DENSITY: Record<CompanionSurfaceKind, CompanionNavDensity> = {
  'web-embed': 'full',
  'extension-sidebar': 'comfortable',
  // The partner-site case in §4.3's table: the Companion rendered OVER a page
  // the platform does not control. Compact, and — per D-4 — always inside the
  // Companion's own frame, never injected into the host page.
  'extension-overlay': 'compact',
  mobile: 'comfortable',
  desktop: 'full',
  vscode: 'comfortable',
  'embedded-widget': 'compact',
  // MCP hosts render no navigation at all; the density is unused but must be
  // stated, because an unstated surface should be a compile error rather than
  // a silent inheritance of someone else's spacing.
  'mcp-host': 'compact',
};

/** Tailwind for each density. Spacing and size only — never item content. */
export const COMPANION_NAV_DENSITY_CLASS: Record<
  CompanionNavDensity,
  { bar: string; item: string; label: string }
> = {
  full: { bar: 'gap-1 px-3 py-2', item: 'px-3 py-1.5', label: 'text-xs' },
  comfortable: { bar: 'gap-0.5 px-2 py-1.5', item: 'px-2 py-1', label: 'text-[11px]' },
  compact: { bar: 'gap-0 px-1 py-1', item: 'px-1.5 py-1', label: 'text-[10px]' },
};

export function navDensityForSurface(surface: CompanionSurfaceKind): CompanionNavDensity {
  return COMPANION_NAV_DENSITY[surface];
}

// ---------------------------------------------------------------------------
// C0 capability inventory (§12 C0, §11.1)
// ---------------------------------------------------------------------------

export interface CompanionCapabilityRecord {
  /** The shipped capability this nav item exposes. */
  readonly capability: string;
  /**
   * How the capability was reachable BEFORE Companion 1.1.
   *  - `pre-1.1-companion-mode`: already a Companion mode; only its position
   *    in the navigation changes.
   *  - `pre-1.1-elsewhere`: shipped and reachable, but not from the Companion.
   *    1.1 EXPOSES it here — exposure of an existing capability, not a new one.
   */
  readonly priorReach: 'pre-1.1-companion-mode' | 'pre-1.1-elsewhere';
  /** Where it already lives. Evidence for `priorReach`, not a new binding. */
  readonly shippedIn: string;
}

/**
 * Every capability the 1.1 navigation can reach, with its provenance.
 *
 * **The entire inventory is `pre-1.1-*`. There is no third value**, and that
 * is the point: a nav item that could not name a shipped capability would be
 * a new capability, which §6.1 forbids absolutely. Adding a `new` variant here
 * would be the first step of the scope creep the rule exists to stop.
 */
export const COMPANION_CAPABILITY_INVENTORY: Record<
  CompanionNavItemId,
  CompanionCapabilityRecord
> = {
  avatar: {
    capability: 'avatar rendering of the active copilot session',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: "app/components/codex/CodexCopilotLayer.tsx (CopilotMode 'avatar')",
  },
  wallet: {
    capability: 'wallet, agreements, receipts, MoneyPenny surfaces',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: 'app/components/content/SmartWalletDrawer.tsx',
  },
  'agent-me': {
    capability: 'the aigentMe copilot conversation',
    priorReach: 'pre-1.1-elsewhere',
    shippedIn: 'app/components/codex/CodexCopilotLayer.tsx',
  },
  search: {
    capability: 'federated search across research, registry, capability graph',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: 'components/companion/CompanionSearchPanel.tsx',
  },
  workspace: {
    capability: 'capture inbox — review and assign captured material',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: 'components/companion/CaptureInboxPanel.tsx',
  },
  overlay: {
    capability: 'constitutional overlay for the observed page',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: 'components/companion/CompanionOverlayPanel.tsx',
  },
  activity: {
    capability: 'activity timeline of receipted acts',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: 'app/(embed)/triad/embed/companion/page.tsx (Timeline)',
  },
  permissions: {
    // Still §6.1-clean: this is the SAME shipped panel, given its own
    // destination instead of a position below the Timeline. Splitting where a
    // capability is reached is not adding one.
    capability: 'observer permission grants — what the Observer may see',
    priorReach: 'pre-1.1-companion-mode',
    shippedIn: 'components/companion/ObserverGrantPanel.tsx',
  },
};

/**
 * The Companion modes that existed BEFORE 1.1, by the label each carried.
 *
 * Success criterion §14.6 is "no existing constitutional capability is lost",
 * and it cannot be checked against the new navigation alone — the old set has
 * to be written down. Every entry maps to where its capability lives now.
 *
 * `companion` is the one pre-1.1 mode with **no** nav item in the ratified
 * six-item vocabulary. Its content (identity chip, activity timeline, observer
 * permissions) is preserved and reachable, but where it belongs under the new
 * navigation is an open decision — SCOPE-MMC-004 D-9. It is recorded here
 * rather than quietly dropped.
 */
export const PRE_1_1_COMPANION_MODES = {
  wallet: 'wallet',
  // D-9 RESOLVED (operator, 2026-07-26): the pre-1.1 `companion` rail — the
  // activity Timeline and observer permissions — is a FIRST-CLASS nav item,
  // reached from the copilot menu in the slot the dead chevron vacated. It was
  // recorded here as `null` while its home was undecided; nothing is unplaced
  // now.
  // The pre-1.1 rail carried BOTH halves. The Timeline keeps the `activity`
  // home it was given; observer permissions became `permissions` in its own
  // right. Recorded against `activity` because that is where the rail's
  // identity chip + feed live — nothing was lost, one half was promoted.
  companion: 'activity',
  search: 'search',
  overlay: 'overlay',
  workspace: 'workspace',
} as const satisfies Record<string, CompanionNavItemId | null>;
