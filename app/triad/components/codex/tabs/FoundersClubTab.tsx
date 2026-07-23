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
 * This is a minimal host: it mounts `CommunityConciergeLayer` (the Club's
 * single visible face, built in Increment 2 of PRD-FOI-001) and does not
 * reimplement any of that component's chrome or routing logic. Fetching a
 * live Standing score / match candidates to hand the Concierge richer seed
 * data (per `CommunityConciergeLayerProps.standingScore` /
 * `matchCandidates`) is left as a follow-up — this host renders correctly
 * with neither supplied (the Concierge shell degrades to stub routing for
 * Opportunity Scout / Recognition Steward in that case, per its own docs).
 */

import React from 'react';
import { Users } from 'lucide-react';
import { CommunityConciergeLayer } from '@/components/foundersClub/CommunityConciergeLayer';

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

export function FoundersClubTab({ personaId }: Props) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/40 flex-shrink-0">
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
      <div className="flex-1 min-h-0">
        <CommunityConciergeLayer variant="embedded" personaId={personaId} />
      </div>
    </div>
  );
}
