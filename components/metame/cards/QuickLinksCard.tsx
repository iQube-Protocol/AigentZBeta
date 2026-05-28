"use client";

/**
 * QuickLinksCard — Aigent Me welcome surface.
 *
 * Deep-links into the cartridges + specific tabs the user works in most.
 * Each link is built via `buildCodexUrl` so personaId travels (cross-
 * cartridge navigation rule in CLAUDE.md).
 *
 * Renders inline below the iQube disclosure on the welcome surface.
 * Phase 5/6 will extend this with usage-weighted ordering; for alpha
 * the order is static + matches the locked active-cartridge roster.
 */

import React from "react";
import { ExternalLink, Compass } from "lucide-react";
import { buildCodexUrl } from "@/utils/codex-nav";

export interface QuickLink {
  id: string;
  label: string;
  /** Short helper line below the label. */
  hint: string;
  /** Cartridge slug for buildCodexUrl (no `-codex` suffix). */
  slug: string;
  /** Tab slug within the destination cartridge. */
  tab: string;
}

interface Props {
  /** Persona id to carry as `?personaId=` for the destination cartridge. */
  personaId?: string;
  /** Override the default link set. */
  links?: QuickLink[];
  /** isAdmin override — passed through to the destination url. */
  isAdmin?: boolean;
  /** isPartner override — passed through to the destination url. */
  isPartner?: boolean;
  /** Source slug for back-link breadcrumbs. */
  fromSlug?: string;
  fromTab?: string;
  theme?: "light" | "dark";
}

const DEFAULT_LINKS: QuickLink[] = [
  { id: "knyt-bundles",     label: "KNYT · Bundles",          hint: "Episodes + collector tiers",     slug: "knyt",                 tab: "store-bundles" },
  { id: "knyt-codex",       label: "KNYT · Codex",            hint: "Scrolls, characters, lore",      slug: "knyt",                 tab: "scrolls" },
  { id: "qriptopian",       label: "The Qriptopian",          hint: "Editorial layer with Quill",     slug: "qripto",               tab: "scrolls" },
  { id: "marketa-propose",  label: "Marketa · Propose",       hint: "Pitch a partner / campaign",     slug: "marketa",              tab: "propose" },
  { id: "marketa-reports",  label: "Marketa · Reports",       hint: "Campaign performance",           slug: "marketa",              tab: "reports" },
  { id: "agentiq-alpha",    label: "AgentiQ · Alpha Program", hint: "Build plan + golden path",       slug: "aigentiq",             tab: "alpha-program" },
  { id: "venture-lab",      label: "Venture Lab α",           hint: "AgentiQ Lab workstream",         slug: "alpha-knyt",           tab: "alpha-programme" },
  { id: "agentiq-os",       label: "AgentiQ OS",              hint: "Developer cartridge",            slug: "agentiq-os-cartridge", tab: "os-readme" },
];

export function QuickLinksCard({
  personaId,
  links,
  isAdmin,
  isPartner,
  fromSlug = "metame",
  fromTab = "aigent-me",
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/40 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  // Mix emerald (metaMe brand) with violet (Aigent Me primary).
  const accentClass = isDark ? "text-emerald-300" : "text-emerald-700";
  const linkClass = isDark
    ? "bg-slate-800/40 border-slate-700/60 hover:border-emerald-500/50 hover:bg-slate-800/60"
    : "bg-slate-50 border-slate-200 hover:border-emerald-400 hover:bg-white";

  const items = links && links.length > 0 ? links : DEFAULT_LINKS;

  return (
    <div className={`rounded-lg border p-4 ${surfaceClass}`}>
      <div className={`flex items-center gap-2 mb-3 text-xs uppercase tracking-wider ${mutedClass}`}>
        <Compass className={`w-3.5 h-3.5 ${accentClass}`} />
        Open a cartridge
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map((link) => {
          const href = buildCodexUrl(link.slug, {
            tab: link.tab,
            personaId,
            isAdmin,
            isPartner,
            from: fromSlug,
            fromTab,
          });
          return (
            <a
              key={link.id}
              href={href}
              className={`block rounded-md border p-2.5 transition ${linkClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{link.label}</div>
                  <div className={`text-[11px] mt-0.5 ${mutedClass}`}>{link.hint}</div>
                </div>
                <ExternalLink className={`w-3.5 h-3.5 shrink-0 ${accentClass}`} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default QuickLinksCard;
