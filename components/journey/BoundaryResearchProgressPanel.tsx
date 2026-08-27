'use client';

/**
 * BoundaryResearchProgressPanel — OCSGA's persistent Boundary Research
 * destination (item 7, semantic repair 2026-08-25).
 *
 * Replaces `research-active`'s prior default (a bare embed of the generic
 * IRL Welcome + IRL Dashboard tabs — platform-wide surfaces with no idea
 * which experiment, if any, THIS persona is actually assigned to) with a
 * surface centered on the participant's own work, following the SAME
 * composition pattern the Validation Programme journey already uses for its
 * "Experiment Progress" stage: the real `PartnerProgrammesTab` — Pipeline +
 * Evidence — locked to one research workspace via `lockedWorkspaceId`.
 *
 * NEVER a forked Boundary Research database or experiment engine: workspace
 * scoping reuses the EXACT client-side resolution `PartnerProgrammesTab`
 * itself uses internally (`useParticipationAccess` + `scopesGrantedIn` +
 * `listResearchWorkspaces`) — this component only decides HOW MANY scoped
 * experiment workspaces exist and what to show for that count; it never
 * re-derives or second-guesses the scoping decision `PartnerProgrammesTab`
 * makes once it is mounted.
 *
 * One experiment -> open directly. Several -> a small persona-scoped
 * selector. Zero -> an honest empty state (never a silent fallback to the
 * generic IRL Welcome/Dashboard this replaces). `Explore IRL OS ↗` remains
 * the explicit route into the larger body of work — never removed, per the
 * existing `openLabel` precedent for a focused embed elsewhere in the
 * Journey Runtime.
 */

import { useMemo, useState } from 'react';
import { FlaskConical, ExternalLink } from 'lucide-react';
import { PartnerProgrammesTab } from '@/app/triad/components/codex/tabs/PartnerProgrammesTab';
import { useParticipationAccess } from '@/app/hooks/useParticipationAccess';
import { scopesGrantedIn } from '@/services/passport/participationTabGate';
import { listResearchWorkspaces, researchWorkspaceLabel } from '@/services/research/researchWorkspace';
import { buildCodexUrl } from '@/utils/codex-nav';

const RESEARCH_ACCESS_DOMAIN = 'research-lab';

interface BoundaryResearchProgressPanelProps {
  personaId?: string;
  isAdmin?: boolean;
}

export function BoundaryResearchProgressPanel({ personaId, isAdmin }: BoundaryResearchProgressPanelProps) {
  const access = useParticipationAccess(personaId);
  const [chosenWorkspaceId, setChosenWorkspaceId] = useState<string | null>(null);

  // Every `experiment`-type workspace this persona's grant reaches — the
  // SAME filter PartnerProgrammesTab applies internally, computed here only
  // to decide the 0/1/many presentation, never to gate anything itself.
  const scopedExperimentWorkspaces = useMemo(() => {
    const grantedScopes = scopesGrantedIn(access, RESEARCH_ACCESS_DOMAIN, Boolean(isAdmin));
    return listResearchWorkspaces()
      .filter((w) => w.workspaceType === 'experiment')
      .filter((w) => grantedScopes === 'all' || grantedScopes.includes(w.id))
      .map((w) => ({ id: w.id, label: researchWorkspaceLabel(w) }));
  }, [access, isAdmin]);

  // Access-boundary correction (2026-08-26): this label has always said
  // "Explore IRL OS" but the href pointed at `irl-cartridge` — metaMe IRL, the
  // internal admin laboratory — not IRL OS. External IRL participation is
  // always mediated through IRL OS; metaMe IRL is strictly admin-gated (see
  // IRL_CARTRIDGE's tabs in data/codex-configs.ts).
  //
  // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
  // the irl-os-workspace tab this repointed to is now disabled (it shared
  // the same PartnerProgrammesTab/DeepLinkCard machinery that was
  // constructing `irl-cartridge` destinations elsewhere) — repointed again,
  // to the always-enabled Welcome tab, so this link never dangles onto a
  // hidden tab. Restore to a scoped Workspace destination in Phase 2 once
  // that surface has an IRL OS-native, public-safe projection.
  const exploreIrlOsLink = (
    <a
      href={buildCodexUrl('irl-os-cartridge', { tab: 'irl-os-welcome', personaId })}
      className="inline-flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200"
    >
      Explore IRL OS <ExternalLink className="h-3 w-3" />
    </a>
  );

  // MS-11 — a cache that hasn't hydrated yet must not answer authoritatively.
  // `access.loaded === false` means "not known yet", never "confirmed zero".
  if (!access.loaded) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-center text-sm text-slate-400">
        Resolving your Boundary Research assignment…
      </div>
    );
  }

  const activeWorkspaceId =
    scopedExperimentWorkspaces.length === 1 ? scopedExperimentWorkspaces[0].id : chosenWorkspaceId;

  if (scopedExperimentWorkspaces.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-10 text-center">
        <FlaskConical className="mx-auto h-8 w-8 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-100">No experiment is assigned yet</h2>
        <p className="text-sm text-slate-400">
          Your Boundary Research access is active, but no specific experiment workspace has been
          assigned to you yet. A steward assigns experiment access separately from crossing —
          check back, or explore the wider research programme below.
        </p>
        <div>{exploreIrlOsLink}</div>
      </div>
    );
  }

  if (scopedExperimentWorkspaces.length > 1 && !activeWorkspaceId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400">Boundary Research</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Which experiment?</h2>
          <p className="mt-1 text-sm text-slate-400">You are assigned to more than one experiment workspace.</p>
        </div>
        <div className="space-y-2">
          {scopedExperimentWorkspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => setChosenWorkspaceId(w.id)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left text-sm text-slate-200 hover:border-violet-500/60 hover:bg-slate-900"
            >
              {w.label}
            </button>
          ))}
        </div>
        <div>{exploreIrlOsLink}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400">Your Boundary Research</p>
        {exploreIrlOsLink}
      </div>
      {/* Same two-surface composition Validation Programme's own
          "Experiment Progress" stage uses — Pipeline then Evidence, both
          locked to this one workspace. */}
      <PartnerProgrammesTab
        personaId={personaId}
        isAdmin={isAdmin}
        workspaceDomain="research"
        lockedWorkspaceId={activeWorkspaceId ?? undefined}
        initialSurface="pipeline"
      />
      <PartnerProgrammesTab
        personaId={personaId}
        isAdmin={isAdmin}
        workspaceDomain="research"
        lockedWorkspaceId={activeWorkspaceId ?? undefined}
        initialSurface="evidence"
      />
    </div>
  );
}

export default BoundaryResearchProgressPanel;
