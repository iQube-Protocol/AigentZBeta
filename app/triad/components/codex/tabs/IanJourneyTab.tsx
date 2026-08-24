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
 * Delegation, the Reciprocal Artifact Exchange workspace, IRL Welcome/
 * Dashboard). This file owns only what is genuinely journey-specific: the
 * Orient stage's completion flag (read from the already-resolved
 * runtimeState, never re-derived) and the header label.
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

interface IanJourneyTabProps {
  personaId?: string;
}

const JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  IanOrientationPanel,
  PassportBureauApplyTab,
  BoundedDelegationTab,
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
        return { complete: orientState === 'COMPLETE', requestStateRefresh };
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
