'use client';

/**
 * FoundersClubTab — the Founders Club's host surface inside the Founder
 * Office. The Human Domain counterpart to `FounderOfficeTab`'s Operational
 * Domain sub-views (Workspace · Discover · Validate · Architect · Blueprint).
 *
 * PRD-FDC-001 (Founders Club) §2.1 (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-fdc-001-founders-club.md`) — a new PRIMARY section,
 * coordinate with the Operational Domain, explicitly NOT named "Community"
 * (Community is one of the Club's own internal sub-bodies, §2.2 — naming the
 * whole section after one of its parts would be a category error).
 *
 * Style-parity pass (2026-07-23): the tab previously rendered nothing but
 * the header + `CommunityConciergeLayer` chat, which read as "out of sync"
 * next to its Venture Lab siblings (Relationship Builder, Growth Matrix,
 * Founder Office) — all of which lead with a real dashboard section before
 * any chat surface. This adds an honest dashboard header (roster summary +
 * Standing stat tile, matching the siblings' stat-tile/card conventions)
 * ahead of the Concierge chat — not instead of it, per PRD-FDC-001/PRD-
 * FOI-001: the chat remains the tab's real interactive surface.
 *
 * Data sources — no new plumbing invented:
 *   - Roster: `FOUNDERS_CLUB_AGENT_ROSTER` (`services/founders-club/
 *     agentRoster.ts`) — the single source of truth for the 12-agent roster
 *     (Community Concierge + 11 specialists, Increment 2 + Increment 3).
 *   - Standing: `/api/venture/standing-summary`, the SAME endpoint
 *     `FounderOfficeTab.tsx` already reads via `personaFetch` for its own
 *     Standing banner. The fetched score is also threaded into
 *     `CommunityConciergeLayer`'s existing `standingScore` prop, which
 *     upgrades Recognition Steward's "My standing" chip from a stub prompt
 *     to its real deterministic narration — a bonus of reusing the source
 *     rather than a new feature.
 *   - No fabricated stats (no invented "upcoming events" or activity feed) —
 *     if a data point isn't available from an existing source, it is
 *     deliberately left out (see this session's final report).
 */

import React, { useEffect, useState } from 'react';
import { Users, Sparkles, Compass } from 'lucide-react';
import { CommunityConciergeLayer } from '@/components/foundersClub/CommunityConciergeLayer';
import { FOUNDERS_CLUB_AGENT_ROSTER, foundersClubSpecialists } from '@/services/founders-club/agentRoster';
import { personaFetch } from '@/utils/personaSpine';

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

interface StandingScoreShape {
  score?: { score: number } | null;
  hasStandingSignal?: boolean;
}

/** Small stat-tile primitive, mirroring the inline shape already repeated in
 *  `RelationshipBuilderTab.tsx` (`PartnersPanel` summary tiles) and
 *  `FounderOfficeTab.tsx` (`ConfidenceStat`) — no new shared component
 *  exists to extend, so this follows the same inline convention rather than
 *  introducing a parallel one. */
function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
      <div className={`text-base font-bold leading-none ${accent}`}>{value}</div>
      <div className="text-[10px] text-slate-600 mt-0.5">{label}</div>
    </div>
  );
}

export function FoundersClubTab({ personaId }: Props) {
  const [standingScore, setStandingScore] = useState<number | null>(null);

  useEffect(() => {
    if (!personaId) return;
    personaFetch('/api/venture/standing-summary', { personaIdHint: personaId, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json() as { ok: boolean } & StandingScoreShape;
        if (json.ok && json.hasStandingSignal && json.score) {
          setStandingScore(Math.round(json.score.score));
        }
      })
      .catch(() => {/* non-fatal — Standing tile just stays hidden */});
  }, [personaId]);

  const specialists = foundersClubSpecialists();
  const domainCount = new Set(
    FOUNDERS_CLUB_AGENT_ROSTER.map((a) => a.awarenessDomain).filter(Boolean),
  ).size;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/40 flex-shrink-0 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-300" />
            <h2 className="text-sm font-semibold text-white">Founders Club</h2>
          </div>
          <p className="text-xs text-white/60 mt-1">
            The Human Domain of the Founder Office — connection, collaboration, opportunity,
            wellbeing, recognition, community, and mentoring. Membership derives from your
            Founder Office participation; there is nothing separate to join.
          </p>
        </div>

        {/* Roster + Standing summary tiles */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Club specialists" value={String(specialists.length)} accent="text-violet-300" />
          <StatTile label="Awareness domains" value={String(domainCount)} accent="text-cyan-300" />
          <StatTile
            label="Standing"
            value={standingScore == null ? '—' : `${standingScore}/100`}
            accent={standingScore == null ? 'text-slate-500' : 'text-emerald-300'}
          />
        </div>

        {/* Compact roster grid — name + one-line function, styled like
            RelationshipBuilderTab's partner rows. Capped + scrollable so the
            12-agent roster never crowds out the Concierge chat below. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {FOUNDERS_CLUB_AGENT_ROSTER.map((agent) => (
            <div
              key={agent.id}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                {agent.isOrchestrator ? (
                  <Sparkles className="h-2.5 w-2.5 text-amber-300 shrink-0" />
                ) : (
                  <Compass className="h-2.5 w-2.5 text-slate-600 shrink-0" />
                )}
                <span className="text-[11px] font-semibold text-slate-100">{agent.name}</span>
                {agent.awarenessDomain && (
                  <span className="text-[9px] rounded-full border border-cyan-800/40 text-cyan-300 px-1.5 py-0">
                    {agent.awarenessDomain}
                  </span>
                )}
                {agent.isReusedPlatformAgent && (
                  <span className="text-[9px] rounded-full border border-slate-700/60 text-slate-400 px-1.5 py-0">
                    reused
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{agent.function}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <CommunityConciergeLayer
          variant="embedded"
          personaId={personaId}
          standingScore={standingScore}
        />
      </div>
    </div>
  );
}
