'use client';

/**
 * ValidationProgrammeJourneyTab — the external reviewer's guided path
 * through EXP-P1 review (operator spec, 2026-08-01), rendered via the same
 * shared Guided Journey Runtime runner PilotJourneyTab uses
 * (components/journey/JourneyRunSurface.tsx — inv.engineering.036, one
 * stepper implementation for every journey).
 *
 * Everything this journey shows is an EXISTING surface — see
 * services/journey/validationProgrammeJourney.ts's own header for the full
 * reuse map. This file owns only what is genuinely journey-specific: the
 * `isAdmin` pass-through PartnerProgrammesTab needs (not carried in the
 * static JourneyDefinition, since it comes from the mounting persona, not
 * the journey's own data) and the header label.
 */

import { useCallback } from 'react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import { VALIDATION_PROGRAMME_JOURNEY } from '@/services/journey/validationProgrammeJourney';
import { PartnerProgrammesTab } from './PartnerProgrammesTab';

interface ValidationProgrammeJourneyTabProps {
  personaId?: string;
  isAdmin?: boolean;
}

const JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  PartnerProgrammesTab,
};

function ValidationProgrammeJourneyTabInner({ personaId, isAdmin }: ValidationProgrammeJourneyTabProps) {
  const resolveSurfaceProps = useCallback(
    (_args: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => ({ isAdmin: Boolean(isAdmin) }),
    [isAdmin],
  );

  return (
    <JourneyRunSurface
      journey={VALIDATION_PROGRAMME_JOURNEY}
      stateUrl="/api/journey/validation-programme/state"
      personaId={personaId}
      documentTitle="Validation Programme — EXP-P1 External Review"
      components={JOURNEY_COMPONENTS}
      resolveSurfaceProps={resolveSurfaceProps}
      headerLabel={
        <>
          <span className="shrink-0 font-semibold text-slate-100">metaMe × Autonomi</span>
          <span className="shrink-0 text-slate-600">·</span>
          <span className="truncate text-slate-300">{VALIDATION_PROGRAMME_JOURNEY.label}</span>
          <span className="shrink-0 text-slate-600">·</span>
          <span className="shrink-0 text-xs text-slate-500">EXP-P1 External Review</span>
        </>
      }
    />
  );
}

export function ValidationProgrammeJourneyTab(props: ValidationProgrammeJourneyTabProps) {
  return <ValidationProgrammeJourneyTabInner {...props} />;
}

export default ValidationProgrammeJourneyTab;
