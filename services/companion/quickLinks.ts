/**
 * Companion 1.1 C3 — Quick Links as Agent Me actions (SCOPE-MMC-004 §5.1).
 *
 * REUSE, NOT NEW CAPABILITY (§6.1). Opening a cartridge/page in the left pane
 * already ships: `CompanionSearchPanel` renders `buildCodexUrl(slug, { tab,
 * personaId })` anchors and the pane navigates. Quick Links are the SAME
 * capability reached a different way — the copilot surfacing slugs from across
 * the application instead of the citizen typing a search. This module resolves
 * and GATES those slugs; it opens nothing itself.
 *
 * ── THE GATING REQUIREMENT (operator, 2026-07-26) ──────────────────────────
 *
 *   "we also need to ensure that admin and access gating is retained as need
 *    be. Ideally observer should be state and context aware and not enable
 *    unauthorised surfaces to be surfaced as quicklinks"
 *
 * This is the sharp edge of C3, and it is a WIDER surface than search. The
 * federated search targets are a short hardcoded list of destinations known to
 * be safe (`searchFederation.ts` mentions `adminOnly` only in a comment
 * explaining why one target was chosen). Quick Links draw from the whole
 * cartridge registry, so "the list is short and someone checked it" stops
 * being a defensible answer and the gate has to be real.
 *
 * Two properties make it real:
 *
 *  1. **Derived, never hand-listed.** Candidates come from `CODEX_DEFINITIONS`
 *     — the same registry the picker and the embed route use. A hand-copied
 *     Quick Link list would drift and, worse, would drift silently past a tab
 *     that LATER became `adminOnly` (`inv.engineering.036`/`037`).
 *  2. **Fails closed.** A link is offered only when the persona is positively
 *     known to be permitted. Absent flags, an unresolved persona, or an
 *     unrecognised gate all mean EXCLUDE. The default answer to "may this
 *     citizen see this?" is no.
 *
 * ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────────
 *
 * **It is not an authority gate, and must never become one.** Hiding a link is
 * a PRESENTATION decision — it stops an unauthorised surface being *offered*.
 * The server-side gate remains the thing that actually refuses access
 * (CLAUDE.md, "Access gates are always resolved server-side"). If this filter
 * were ever the only check, an operator who guessed a URL would walk straight
 * in. Belt and braces, and this is the belt.
 */

import { CODEX_DEFINITIONS } from '@/data/codex-configs';
import { buildCodexUrl } from '@/utils/codex-nav';

/**
 * The access facts a Quick Link decision needs. A deliberately narrow mirror
 * of the spine's `cartridgeFlags` (`types/access.ts`) — narrow because this
 * module must never grow into a second place where authority is decided.
 *
 * `null` means "not resolved yet", which is NOT the same as "no privileges"
 * and is handled explicitly: an unresolved persona gets only ungated links.
 */
export interface QuickLinkAccessContext {
  readonly isAdmin: boolean;
  readonly isPartner: boolean;
  /** Per-cartridge admin grants, by cartridge slug. */
  readonly adminCartridges: readonly string[];
}

export interface QuickLink {
  /** `${codexSlug}:${tabSlug}` — stable, and safe to use as a React key. */
  readonly id: string;
  readonly label: string;
  readonly codexSlug: string;
  readonly tabSlug: string;
  /** Why it was allowed. Diagnostic — makes a wrong decision legible. */
  readonly allowedBecause: 'ungated' | 'global-admin' | 'cartridge-admin' | 'partner';
  /**
   * Lower-cased match surface for context ranking: codex name + tab label +
   * slug + tab GROUP. Separate from `label` because the group a tab belongs to
   * is a real association the citizen navigates by ("myCluster") without it
   * ever appearing in the link's own text. Optional so a hand-built QuickLink
   * in a test stays valid; ranking falls back to the label when absent.
   */
  readonly rankKey?: string;
}

/**
 * May this persona be OFFERED this tab?
 *
 * Exported because the canary asserts it directly: the fail-closed property
 * has to be testable without constructing a whole registry.
 */
export function quickLinkVisibility(
  gate: { adminOnly?: boolean; partnerOnly?: boolean },
  access: QuickLinkAccessContext | null,
  codexSlug: string,
): QuickLink['allowedBecause'] | null {
  const gated = Boolean(gate.adminOnly) || Boolean(gate.partnerOnly);
  if (!gated) return 'ungated';

  // Unresolved persona + a gated surface = refuse. This is the branch that
  // makes "fails closed" true rather than aspirational: an unauthenticated or
  // still-loading Companion must never advertise an admin surface, however
  // briefly, because a Quick Link is an offer and an offer is an intervention.
  if (!access) return null;

  if (access.isAdmin) return 'global-admin';
  // A per-cartridge admin grant satisfies an adminOnly tab on THAT cartridge
  // only (types/access.ts: `isAdmin` overrides; the two are independent).
  if (gate.adminOnly && access.adminCartridges.includes(codexSlug)) return 'cartridge-admin';
  // partnerOnly admits partners; admins already returned above.
  if (gate.partnerOnly && !gate.adminOnly && access.isPartner) return 'partner';

  return null;
}

/**
 * Every Quick Link this persona may be offered, derived from the live
 * cartridge registry.
 *
 * `matching` narrows by a copilot-supplied query — that is how "slugs surfaced
 * from across the application via the copilot" reaches the citizen. Narrowing
 * happens AFTER gating, never instead of it: a query must not be able to
 * surface something the gate excluded.
 */
/**
 * OBSERVED CONTEXT → a ranking needle (operator, 2026-07-26: "I would ideally
 * like to see the quick actions change and be dynamic — observer and context
 * driven even to a small degree now").
 *
 * A SMALL, EXPLICIT table, deliberately mirroring `overlayMapping.ts`'s own
 * discipline: an unmapped shape yields `null` and no ranking happens. Guessing
 * a topic for an unrecognised page would be exactly the fabricated association
 * that module refuses to make for overlay cards.
 *
 * Keyed by `OverlayShape`, which is what the Companion already receives from
 * `GET /api/companion/overlay` — no new observation, no new permission, no new
 * read. This is the SAME observation the Overlay surface already renders,
 * informing a second surface (§6.1: exposure of a shipped signal, not a new
 * capability).
 */
export const QUICK_LINK_CONTEXT_NEEDLE: Readonly<Record<string, string>> = {
  'github-repo': 'software',
  'financial-context': 'wallet',
};

/**
 * THE SURFACE the citizen is on, as a ranking needle.
 *
 * WHY THIS EXISTS (operator, 2026-07-26: "still not seeing any dynamic changes
 * in the quick links"). The first cut ranked ONLY on the observed page shape —
 * but `shapeForDomain` recognises github.com and a handful of financial hosts
 * and abstains everywhere else, so on almost every page the needle was null and
 * nothing ever reordered. A mechanism whose signal is almost never present is
 * inert, whatever its design says.
 *
 * The active surface is a signal that is ALWAYS present and changes as the
 * citizen navigates, so the strip visibly responds. It is still context, not
 * preference: it says "you are looking at your wallet", not "you like wallets".
 *
 * Deliberately partial. `agent-me` maps to nothing — the conversation surface
 * has no topic of its own, and inventing one would be exactly the fabricated
 * association `overlayMapping` refuses to make.
 */
/**
 * Operator-specified associations (2026-07-26): the wallet surface offers the
 * money-shaped destinations — MoneyPenny and the Financial Services programme
 * — not generic wallet-labelled tabs; Workspace offers myCluster. Multiple
 * needles per surface because one surface legitimately relates to several
 * destinations. `overlay` is deliberately absent: its context comes from the
 * OBSERVED PAGE shape (the `??` chain in the page), not from the surface name.
 */
export const QUICK_LINK_SURFACE_NEEDLES: Readonly<Record<string, readonly string[]>> = {
  wallet: ['moneypenny', 'financial'],
  search: ['registry'],
  workspace: ['mycluster', 'cluster'],
  permissions: ['passport'],
  activity: ['ledger'],
};

export function quickLinkSurfaceNeedle(
  surface: string | null | undefined,
): readonly string[] | null {
  if (!surface) return null;
  return QUICK_LINK_SURFACE_NEEDLES[surface] ?? null;
}

/**
 * OBSERVED HOST → destination needles.
 *
 * The Overlay surface deliberately has no needle of its own: its context is
 * the page the citizen is on, not the word "overlay". But that context only
 * ever arrived via `shapeForDomain`, which asserts a shape for GitHub and the
 * verified financial-profile hosts and abstains everywhere else — so on the
 * hosts the operator actually works on, the strip never moved.
 *
 * This is the same SMALL, EXPLICIT table `overlayMapping` uses, at the one
 * level that table does not cover: a host that has no Domain Profile and no
 * overlay shape can still have an operator-declared DESTINATION. It ranks
 * only; it asserts nothing about the host, renders no card, and creates no
 * profile — an unlisted host still yields nothing rather than a guess.
 *
 * Seeded from the operator's own mapping (2026-07-27): on `claude.ai`, the
 * relevant destination is the **AgentiQ OS** cartridge — the home of the
 * `aigent-z` development command-centre agent (RUNTIME_AGENT_IDS' "aigentZ —
 * development command center agent"). The needle matches the codex NAME via
 * `rankKey`, so it reaches whichever AgentiQ OS tabs the citizen may see
 * rather than naming a tab that might be gated for them.
 */
export const QUICK_LINK_DOMAIN_NEEDLES: Readonly<Record<string, readonly string[]>> = {
  'claude.ai': ['agentiq os'],
};

export function quickLinkDomainNeedle(
  domain: string | null | undefined,
): readonly string[] | null {
  if (!domain) return null;
  const host = domain.trim().toLowerCase().replace(/^www\./, '');
  if (!host) return null;
  return QUICK_LINK_DOMAIN_NEEDLES[host] ?? null;
}

export function quickLinkContextNeedle(shape: string | null | undefined): string | null {
  if (!shape) return null;
  return QUICK_LINK_CONTEXT_NEEDLE[shape] ?? null;
}

export function resolveQuickLinks(input: {
  access: QuickLinkAccessContext | null;
  matching?: string;
  /**
   * Observed-context needle. RANKS, never filters — links that match are
   * offered first and the rest still fill the limit behind them.
   *
   * The distinction matters: a filter would let an observation SUBTRACT the
   * citizen's quick links, so landing on an unrecognised page would empty a
   * surface that works fine with no observation at all. Context specialises
   * what is offered; it never decides whether anything is offered.
   *
   * It also cannot WIDEN the set: ranking happens after `quickLinkVisibility`,
   * so an observation can never promote a surface the persona may not see.
   */
  context?: string | readonly string[] | null;
  limit?: number;
}): QuickLink[] {
  const needle = input.matching?.trim().toLowerCase() ?? '';
  const out: QuickLink[] = [];

  for (const codex of CODEX_DEFINITIONS) {
    for (const tab of codex.tabs ?? []) {
      const allowedBecause = quickLinkVisibility(tab, input.access, codex.slug);
      if (!allowedBecause) continue;

      if (needle) {
        const haystack = `${codex.name ?? ''} ${tab.label ?? ''} ${tab.slug}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
      }

      out.push({
        id: `${codex.slug}:${tab.slug}`,
        label: `${codex.name ?? codex.slug} · ${tab.label ?? tab.slug}`,
        codexSlug: codex.slug,
        tabSlug: tab.slug,
        allowedBecause,
        // What context ranking matches against — NOT the display label.
        //
        // WHY (operator, 2026-07-27: "still not seeing quick link changes for
        // workspace"). Ranking read the visible label only, so the Workspace
        // surface's `myCluster` needle matched nothing: myCluster is a tab
        // GROUP, and its members are labelled myCanvas / myWorkspace /
        // myCartridge / myLedger. A needle naming the group the operator
        // actually named could never hit a tab. Including the group id (and
        // the slug, already used by `matching`) makes the association the
        // operator specified resolvable without renaming anything they see.
        rankKey: `${codex.name ?? codex.slug} ${tab.label ?? ''} ${tab.slug} ${tab.group ?? ''}`.toLowerCase(),
      });
    }
  }

  // Context ranking — stable partition, matches first. Applied BEFORE the
  // limit so a context-relevant link can actually reach the visible set.
  const needles = (
    typeof input.context === 'string' ? [input.context] : (input.context ?? [])
  )
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  const hit = (l: QuickLink) =>
    needles.some((n) => (l.rankKey ?? l.label.toLowerCase()).includes(n));
  const ranked = needles.length > 0
    ? [...out.filter(hit), ...out.filter((l) => !hit(l))]
    : out;

  return typeof input.limit === 'number' ? ranked.slice(0, input.limit) : ranked;
}

/**
 * QUICK LINKS DRIVE THE BROWSER, NOT THE COMPANION (§3.2.5, operator
 * correction 2026-07-26).
 *
 * A Quick Link is a **Class 2 Context Action**: it changes *what the citizen
 * is doing*, so it launches the destination in the **left-hand browser
 * workspace** and leaves the Companion where it is, on the right. The model is
 * an assistant saying *"I've opened your Passport"* — not one that replaces
 * itself with the Passport UI.
 *
 * `quickLinkTarget()` therefore returns `_blank`: from the extension side
 * panel that opens the main browser window, and from a web embed a new tab.
 * The Companion never navigates its own pane to a Quick Link destination.
 *
 * (CLAUDE.md's `target="_blank"` prohibition is scoped to **gated PDF and
 * video files** — handing a confidential media URL to the browser. A cartridge
 * page is neither, and it re-resolves its own access gates server-side on
 * arrival, so opening one in the workspace is the intended behaviour rather
 * than an exception to that rule.)
 *
 * The destination itself is the SAME `buildCodexUrl` the search results
 * already use, so identity propagates per CLAUDE.md's inter-cartridge
 * navigation rule.
 *
 * Note what is NOT passed: `isAdmin`/`isPartner` are never put on the URL.
 * They exist as optimistic-render params, and sending them from a link the
 * Companion generated would be this module asserting privilege rather than
 * observing it. The receiving embed re-resolves server-side regardless.
 */
/**
 * THE RULE (operator, 2026-07-26): **any cartridge page reached from a link
 * opens in the left-hand browser workspace, never inside the Companion.**
 *
 * The Companion is a persistent side surface. Navigating it to a cartridge
 * replaces the citizen's agent with a page — losing the conversation and the
 * thing that made the link worth following. Quick Links already worked this
 * way (§3.2.5); search results and overlay capability links did not, and
 * rendered the cartridge inside the panel.
 *
 * One definition, so a new linking surface cannot quietly pick the other
 * behaviour.
 */
export function cartridgeLinkTarget(): '_blank' {
  return '_blank';
}

/** @see cartridgeLinkTarget — retained name for the Quick Link call sites. */
export function quickLinkTarget(): '_blank' {
  return cartridgeLinkTarget();
}

export function quickLinkHref(link: QuickLink, personaId?: string): string {
  return buildCodexUrl(link.codexSlug, {
    tab: link.tabSlug,
    personaId,
    from: 'companion',
    fromTab: 'agent-me',
  });
}
