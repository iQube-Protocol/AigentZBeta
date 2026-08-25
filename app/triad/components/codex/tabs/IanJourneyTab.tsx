'use client';

/**
 * IanJourneyTab — Ian's real Boundary Research crossing experience,
 * rendered via the SAME shared Guided Journey Runtime runner every other
 * journey uses (components/journey/JourneyRunSurface.tsx —
 * inv.engineering.036, one stepper implementation for every journey).
 *
 * Everything this journey shows is an EXISTING surface — see
 * services/journey/journeySurfaceRegistry.ts's "Ian Boundary Research
 * journey" section for the full reuse map (Passport application,
 * Delegation, the Reciprocal Artifact Exchange workspace, the persona-scoped
 * Boundary Research progress panel). This file owns only what is genuinely
 * journey-specific: the Orient stage's completion flag, the Establish
 * Presence stage's `routeTo` derivation (OCSGA early invitation entry,
 * 2026-08-25 — see resolveSurfaceProps below), and the header label — all
 * read from the already-resolved runtimeState, never re-derived.
 *
 * This is the PARTICIPANT-facing surface — distinct from the diagnostic
 * viewer at /admin/journey/ian (components/journey/IanJourneyViewer.tsx),
 * which stays a debug/inspection tool, never Ian's actual collaboration UI.
 */

import { useCallback } from 'react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { IanOrientationPanel } from '@/components/journey/IanOrientationPanel';
import { PassportBureauApplyTab } from './PassportBureauApplyTab';
import { BoundedDelegationTab } from './BoundedDelegationTab';
import { BoundaryResearchProgressPanel } from '@/components/journey/BoundaryResearchProgressPanel';

interface IanJourneyTabProps {
  personaId?: string;
}

const JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  IanOrientationPanel,
  PassportBureauApplyTab,
  BoundedDelegationTab,
  BoundaryResearchProgressPanel,
};

const ACCENT = {
  node: 'border-violet-400 bg-violet-500/20 text-violet-200',
  label: 'text-violet-200',
  chip: 'bg-violet-500/20 text-violet-200',
};

function IanJourneyTabInner({ personaId }: IanJourneyTabProps) {
  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, runtimeState, requestStateRefresh }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'ian-orientation-panel') {
        const orientState = runtimeState?.stages.find((s) => s.stageId === 'orient')?.state;
        return {
          complete: orientState === 'COMPLETE',
          requestStateRefresh,
          // OCSGA early invitation entry (2026-08-25) — already-resolved by
          // the observer (/api/journey/ian/state), never re-derived here.
          activeExchangeId: runtimeState?.activeExchangeId ?? null,
        };
      }
      if (surfaceRef.ref === 'venture-participate-apply') {
        /*
         * OCSGA early invitation entry + Citizen Passport routing
         * (2026-08-25) — "when this OCSGA participant has entered/associated
         * a valid collaboration invite and does not already hold a usable
         * Polity Citizen Passport, route the existing PassportBureauApplyTab
         * directly into the Polity Citizen Passport path" (operator
         * directive). Both facts come from the SAME already-resolved
         * runtimeState the observer produced — never re-derived, never a
         * second read. An invite alone is never enough on its own (the
         * constitutional distinction this feature exists to preserve):
         * routeTo only ever resolves to 'citizen', never inferred as
         * 'delegate'/agent sponsorship from an invitation.
         *
         * When the operator already holds a usable Citizen Passport, this
         * intentionally passes `routeTo: undefined` — PassportBureauApplyTab
         * has its OWN existing "you already hold a Polity Citizen Passport"
         * branch (a live /api/passport/usable-status read, independent of
         * routeTo) that already handles that case correctly; overriding
         * routeTo here would be a second, redundant decision about the same
         * fact, never introduced.
         */
        const hasInvite = Boolean(runtimeState?.activeExchangeId);
        const hasCitizenPassport = runtimeState?.citizenPassportUsable === true;
        const routeTo = hasInvite && !hasCitizenPassport ? ('citizen' as const) : undefined;
        return { routeTo };
      }
      return {};
    },
    [],
  );

  return (
    <JourneyRunSurface
      journey={IAN_BOUNDARY_RESEARCH_JOURNEY}
      stateUrl="/api/journey/ian/state"
      personaId={personaId}
      documentTitle="OCSGA × Constitutional Computing Research Collaboration"
      components={JOURNEY_COMPONENTS}
      resolveSurfaceProps={resolveSurfaceProps}
      accent={ACCENT}
      compact
      headerLabel={
        <>
          <span className="shrink-0 font-semibold text-slate-100">Constitutional Computing / IRL</span>
          <span className="shrink-0 text-slate-600">×</span>
          <span className="truncate text-violet-300">OCSGA Research Collaboration</span>
        </>
      }
    />
  );
}

export function IanJourneyTab(props: IanJourneyTabProps) {
  return <IanJourneyTabInner {...props} />;
}

export default IanJourneyTab;
