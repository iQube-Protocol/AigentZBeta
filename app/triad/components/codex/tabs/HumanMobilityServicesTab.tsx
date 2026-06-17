'use client';

/**
 * HumanMobilityServicesTab — root tab for the HMS Cartridge.
 *
 * View state machine:
 *   list       → case list (MobilityActivationTab)
 *   intake     → MAF intake wizard (MobilityIntakeTab)
 *   overview   → active case dashboard (MobilityCaseOverviewTab)
 *   housing    → Workstream B: Housing Acquisition
 *   education  → Workstream C: Educational Continuity
 *   relocation → Workstream D: Physical Relocation
 *
 * All workstream sub-views receive caseId from here via activeCaseId state.
 * Workstreams E–G (Business, Economic, Family) are Phase 2.
 */

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { MobilityActivationTab } from './MobilityActivationTab';
import { MobilityIntakeTab } from './MobilityIntakeTab';
import { MobilityCaseOverviewTab } from './MobilityCaseOverviewTab';
import { MobilityHousingTab } from './MobilityHousingTab';
import { MobilityEducationTab } from './MobilityEducationTab';
import { MobilityRelocationTab } from './MobilityRelocationTab';

type View = 'list' | 'intake' | 'overview' | 'housing' | 'education' | 'relocation';

const VIEW_LABELS: Record<View, string> = {
  list:       'All Cases',
  intake:     'MAF Intake',
  overview:   'Case Overview',
  housing:    'Housing (B)',
  education:  'Education (C)',
  relocation: 'Relocation (D)',
};

const WORKSTREAM_VIEW: Record<string, View> = {
  B: 'housing',
  C: 'education',
  D: 'relocation',
};

export function HumanMobilityServicesTab() {
  const [view, setView] = useState<View>('list');
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const handleSelectCase = (caseId: string) => {
    setActiveCaseId(caseId);
    setView('overview');
  };

  const handleOpenIntake = () => {
    if (activeCaseId) setView('intake');
  };

  const handleIntakeComplete = () => {
    if (activeCaseId) setView('overview');
  };

  const parentOf: Partial<Record<View, View>> = {
    intake:     'overview',
    overview:   'list',
    housing:    'overview',
    education:  'overview',
    relocation: 'overview',
  };

  const handleBack = () => {
    const parent = parentOf[view];
    if (parent) setView(parent);
  };

  const showBreadcrumb = view !== 'list';

  return (
    <div className="h-full overflow-auto">
      {/* Back nav */}
      {showBreadcrumb && (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {VIEW_LABELS[parentOf[view] ?? 'list']}
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-xs text-slate-300">{VIEW_LABELS[view]}</span>
        </div>
      )}

      {view === 'list' && (
        <MobilityActivationTab onSelectCase={handleSelectCase} />
      )}
      {view === 'intake' && activeCaseId && (
        <MobilityIntakeTab caseId={activeCaseId} onComplete={handleIntakeComplete} />
      )}
      {view === 'overview' && activeCaseId && (
        <MobilityCaseOverviewTab
          caseId={activeCaseId}
          onOpenIntake={handleOpenIntake}
          onOpenWorkstream={(key) => {
            const target = WORKSTREAM_VIEW[key];
            if (target) setView(target);
          }}
        />
      )}
      {view === 'housing' && activeCaseId && (
        <MobilityHousingTab caseId={activeCaseId} />
      )}
      {view === 'education' && activeCaseId && (
        <MobilityEducationTab caseId={activeCaseId} />
      )}
      {view === 'relocation' && activeCaseId && (
        <MobilityRelocationTab caseId={activeCaseId} />
      )}
    </div>
  );
}
