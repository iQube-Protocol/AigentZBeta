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
 * See CLAUDE.md § Inter-Cartridge Navigation for the full platform rule.
 */

export interface CodexNavOptions {
  /** Active persona — propagated as ?personaId= */
  personaId?: string;
  /** Initial tab slug in the target codex */
  tab?: string;
  /** Carry admin flag for optimistic gate rendering (server re-validates) */
  isAdmin?: boolean;
  /** Carry partner flag for optimistic gate rendering */
  isPartner?: boolean;
  /** Source slug — used as ?from= for breadcrumb back-links */
  from?: string;
  /** Source tab slug — used as ?fromTab= for back-link construction */
  fromTab?: string;
}

/**
 * Build a `/triad/embed/codex/<slug>` URL with identity context carried forward.
 *
 * @param slug - Target codex slug (e.g. "knyt", "alpha-knyt", "knyt-codex").
 *   If the slug already ends in "-codex" the embed route uses it as-is;
 *   otherwise it appends "-codex" automatically. Pass the bare slug to be safe.
 * @param opts - Identity + routing options.
 */
export function buildCodexUrl(slug: string, opts: CodexNavOptions = {}): string {
  const { personaId, tab, isAdmin, isPartner, from, fromTab } = opts;

  const base = `/triad/embed/codex/${encodeURIComponent(slug)}`;
  const params = new URLSearchParams();

  if (tab)       params.set("tab",       tab);
  if (personaId) params.set("personaId", personaId);
  if (isAdmin)   params.set("isAdmin",   "true");
  if (isPartner) params.set("isPartner", "true");
  if (from)      params.set("from",      from);
  if (fromTab)   params.set("fromTab",   fromTab);

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
