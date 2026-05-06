/**
 * Inter-cartridge navigation helpers.
 *
 * CANONICAL RULE: Every link that navigates from one codex/cartridge to
 * another MUST propagate personaId (and optionally isAdmin/isPartner) as URL
 * query params. The receiving embed route already reads and forwards these
 * to tab components. Never rely solely on localStorage/sessionStorage for
 * cross-cartridge identity — URL params are explicit, auditable, and work
 * regardless of storage availability.
 *
 * SHELL CONTEXTS:
 *   "embed"  (default) — standalone thin-client embed; no platform chrome.
 *              Route: /triad/embed/codex/[slug]
 *   "viewer" — within the AgentiQ platform shell (multi-cartridge viewer or
 *              any in-platform navigation). Full side menu available.
 *              Route: /codex/viewer?id=[slug]-codex
 *
 * See CLAUDE.md § Inter-Cartridge Navigation for the full platform rule.
 */

export type CodexShell = "embed" | "viewer";

export interface CodexNavOptions {
  /** Active persona — propagated as ?personaId= */
  personaId?: string;
  /** Initial tab slug in the target codex */
  tab?: string;
  /** Carry admin flag for optimistic gate rendering (server re-validates) */
  isAdmin?: boolean;
  /** Carry partner flag for optimistic gate rendering */
  isPartner?: boolean;
  /** Carry investor flag for optimistic gate rendering (server re-validates) */
  isInvestor?: boolean;
  /** Source slug — used as ?from= for breadcrumb back-links */
  from?: string;
  /** Source tab slug — used as ?fromTab= for back-link construction */
  fromTab?: string;
  /**
   * Rendering shell for the destination.
   *   "embed"  (default) — /triad/embed/codex/[slug] — standalone, no platform chrome
   *   "viewer"           — /codex/viewer?id=[slug]-codex — inside AgentiQ platform shell
   */
  shell?: CodexShell;
}

/**
 * Build a cross-cartridge URL with identity context and correct shell routing.
 *
 * @param slug - Target codex slug (e.g. "knyt", "alpha-knyt", "knyt-codex").
 *   For embed shell: slug is used as the route segment; the embed route appends
 *   "-codex" automatically if not already present.
 *   For viewer shell: slug is normalised to the full codexId (ensuring "-codex"
 *   suffix) and passed as ?id=.
 */
export function buildCodexUrl(slug: string, opts: CodexNavOptions = {}): string {
  const { personaId, tab, isAdmin, isPartner, isInvestor, from, fromTab, shell = "embed" } = opts;

  const params = new URLSearchParams();

  if (personaId)  params.set("personaId",  personaId);
  if (isAdmin)    params.set("isAdmin",    "true");
  if (isPartner)  params.set("isPartner",  "true");
  if (isInvestor) params.set("isInvestor", "true");
  if (from)       params.set("from",       from);
  if (fromTab)    params.set("fromTab",    fromTab);

  if (shell === "viewer") {
    // Normalise to full codexId — viewer expects ?id=knyt-codex, not the bare slug
    const codexId = slug.endsWith("-codex") ? slug : `${slug}-codex`;
    params.set("id", codexId);
    if (tab) params.set("tab", tab);
    const qs = params.toString();
    return qs ? `/codex/viewer?${qs}` : "/codex/viewer";
  }

  // Default: standalone embed route
  const base = `/triad/embed/codex/${encodeURIComponent(slug)}`;
  if (tab) params.set("tab", tab);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
