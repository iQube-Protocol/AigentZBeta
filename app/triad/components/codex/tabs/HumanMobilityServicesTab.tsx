'use client';

/**
 * HumanMobilityServicesTab — root tab for the HMS Cartridge.
 *
 * View state machine:
 *   list        → case list (MobilityActivationTab)
 *   intake      → MAF intake wizard (MobilityIntakeTab)
 *   overview    → active case dashboard (MobilityCaseOverviewTab)
 *   management  → Workstream A: Case Management
 *   housing     → Workstream B: Housing Acquisition
 *   education   → Workstream C: Educational Continuity
 *   relocation  → Workstream D: Physical Relocation
 *   business    → Workstream E: Business Continuity
 *   economic    → Workstream F: Economic Reactivation
 *   family      → Workstream G: Family Stabilization
 *
 * All workstream sub-views receive caseId from here via activeCaseId state.
 */

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { MobilityActivationTab } from './MobilityActivationTab';
import { MobilityIntakeTab } from './MobilityIntakeTab';
import { MobilityCaseOverviewTab } from './MobilityCaseOverviewTab';
import { MobilityCaseManagementTab } from './MobilityCaseManagementTab';
import { MobilityHousingTab } from './MobilityHousingTab';
import { MobilityEducationTab } from './MobilityEducationTab';
import { MobilityRelocationTab } from './MobilityRelocationTab';
import { MobilityBusinessTab } from './MobilityBusinessTab';
import { MobilityEconomicTab } from './MobilityEconomicTab';
import { MobilityFamilyTab } from './MobilityFamilyTab';

type View = 'list' | 'intake' | 'overview' | 'management' | 'housing' | 'education' | 'relocation' | 'business' | 'economic' | 'family';

const VIEW_LABELS: Record<View, string> = {
  list:       'All Cases',
  intake:     'MAF Intake',
  overview:   'Case Overview',
  management: 'Case Management (A)',
  housing:    'Housing (B)',
  education:  'Education (C)',
  relocation: 'Relocation (D)',
  business:   'Business (E)',
  economic:   'Economic (F)',
  family:     'Family (G)',
};

const WORKSTREAM_VIEW: Record<string, View> = {
  A: 'management',
  B: 'housing',
  C: 'education',
  D: 'relocation',
  E: 'business',
  F: 'economic',
  G: 'family',
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
    management: 'overview',
    housing:    'overview',
    education:  'overview',
    relocation: 'overview',
    business:   'overview',
    economic:   'overview',
    family:     'overview',
  };

  const handleBack = () => {
    const parent = parentOf[view as View];
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
            {VIEW_LABELS[(parentOf[view as View] ?? 'list') as View]}
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-xs text-slate-300">{VIEW_LABELS[view as View]}</span>
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
      {view === 'management' && activeCaseId && (
        <MobilityCaseManagementTab caseId={activeCaseId} />
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
      {view === 'business' && activeCaseId && (
        <MobilityBusinessTab caseId={activeCaseId} />
      )}
      {view === 'economic' && activeCaseId && (
        <MobilityEconomicTab caseId={activeCaseId} />
      )}
      {view === 'family' && activeCaseId && (
        <MobilityFamilyTab caseId={activeCaseId} />
      )}
    </div>
  );
}
