"use client";

/**
 * QriptoCommunityCorrespondentTab — Qriptopia › Community Correspondent.
 *
 * Phase 1: renders the three-pill structure (Canon · Community ·
 * Correspondent) mirroring the KNYT 21 Sats Living Canon cluster, but
 * scoped to Qriptopian Pulse content. The pills, layout, and copy are
 * here so operators see the right surface in the right place — the
 * underlying data pipe (Qriptopian Pulse posts → Canon/Community/
 * Correspondent branches) lands in Phase 2 alongside the cartridge-
 * parameterized Living Canon template refactor.
 *
 * See backlog: codexes/packs/agentiq/updates/
 * 2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md
 */

import React, { useState } from "react";
import { Megaphone, Users, ScrollText, Crown } from "lucide-react";

type Branch = "canon" | "community" | "correspondent";

const BRANCHES: Array<{
  id: Branch;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  short: string;
  blurb: string;
}> = [
  {
    id: "canon",
    label: "Canon",
    icon: Crown,
    short: "Steward-curated truths",
    blurb:
      "The canonical Qriptopian — articles and dispatches stewards have validated and published as part of the cartridge's reference record. Promoted from Community via correspondent oversight.",
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    short: "Open submissions, community-voted",
    blurb:
      "Qriptopian Pulse posts open to community review. Sparks, votes, and remixes happen here. Top-voted items can be promoted by correspondents into Canon.",
  },
  {
    id: "correspondent",
    label: "Correspondent",
    icon: ScrollText,
    short: "Curated dispatches from the field",
    blurb:
      "Reports and analysis from designated Qriptopian correspondents — the senior stewards of the publication. Editorial direction and curation live here.",
  },
];

interface QriptoCommunityCorrespondentTabProps {
  theme?: "light" | "dark";
  personaId?: string;
}

export function QriptoCommunityCorrespondentTab({
  theme = "dark",
}: QriptoCommunityCorrespondentTabProps) {
  const [active, setActive] = useState<Branch>("community");
  const isDark = theme === "dark";
  const branch = BRANCHES.find((b) => b.id === active) ?? BRANCHES[1];
  const Icon = branch.icon;

  return (
    <div className="space-y-6 p-4">
      <header className="flex items-start gap-3">
        <Megaphone className={`h-5 w-5 mt-0.5 ${isDark ? "text-indigo-300" : "text-indigo-600"}`} />
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            Community Correspondent
          </h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"} max-w-2xl`}>
            The Qriptopian community canon: contributions land in <strong>Community</strong>,
            voted-up posts are promoted to <strong>Canon</strong>, and <strong>Correspondents</strong>{" "}
            oversee curation. Source content flows in from Qriptopian Pulse — submissions arrive
            via the myCanvas shelf in metaMe.
          </p>
        </div>
      </header>

      {/* Branch pills — same three-up structure as the KNYT 21 Sats Living Canon cluster */}
      <nav className="flex gap-2">
        {BRANCHES.map((b) => {
          const BIcon = b.icon;
          const isActive = b.id === active;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActive(b.id)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                isActive
                  ? isDark
                    ? "bg-indigo-500/15 border-indigo-400/40 text-indigo-200"
                    : "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : isDark
                    ? "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-500"
                    : "bg-white border-slate-300 text-slate-600 hover:border-slate-500"
              }`}
            >
              <BIcon className="h-3.5 w-3.5" />
              {b.label}
            </button>
          );
        })}
      </nav>

      {/* Branch content — Phase 1 stub. Real data pipe lands when the
          Qriptopian Pulse → Living Canon wiring ships (see backlog doc). */}
      <section
        className={`rounded-lg border p-5 ${
          isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
        }`}
      >
        <header className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${isDark ? "text-indigo-300" : "text-indigo-600"}`} />
          <h3 className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            {branch.label}
          </h3>
          <span className={`text-[10px] uppercase tracking-wide ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            {branch.short}
          </span>
        </header>
        <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-700"} leading-relaxed`}>
          {branch.blurb}
        </p>
        <div
          className={`mt-4 rounded border border-dashed p-4 text-[11px] ${
            isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-500"
          }`}
        >
          <p>
            <strong>Wiring in progress.</strong> Posts published to Qriptopian Pulse from a
            persona's myCanvas shelf will appear here once the publish-to-Pulse pipeline is wired.
            Voting, sparking, and promotion to Canon use the same machinery as the KNYT Living
            Canon — cartridge-parameterized in the Phase 2 refactor.
          </p>
        </div>
      </section>
    </div>
  );
}
