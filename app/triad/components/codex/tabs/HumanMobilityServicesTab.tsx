'use client';

/**
 * HumanMobilityServicesTab — root tab for the HMS Cartridge.
 *
 * Manages the three-view state machine:
 *   list  → case list (MobilityActivationTab)
 *   intake → MAF intake wizard (MobilityIntakeTab)
 *   case  → active case dashboard (MobilityCaseOverviewTab)
 *
 * The tab is the shell. It never fetches data directly — it delegates
 * to the three child views.
 */

import React, { useState } from 'react';
import { Home, ChevronLeft } from 'lucide-react';
import { MobilityActivationTab } from './MobilityActivationTab';
import { MobilityIntakeTab } from './MobilityIntakeTab';
import { MobilityCaseOverviewTab } from './MobilityCaseOverviewTab';

type View = 'list' | 'intake' | 'case';

export function HumanMobilityServicesTab() {
  const [view, setView] = useState<View>('list');
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const handleSelectCase = (caseId: string) => {
    setActiveCaseId(caseId);
    setView('case');
  };

  const handleOpenIntake = () => {
    if (activeCaseId) setView('intake');
  };

  const handleIntakeComplete = () => {
    if (activeCaseId) setView('case');
  };

  const breadcrumb = view !== 'list';

  return (
    <div className="h-full overflow-auto">
      {/* Back nav */}
      {breadcrumb && (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur">
          <button
            onClick={() => setView(view === 'intake' && activeCaseId ? 'case' : 'list')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {view === 'intake' ? 'Back to case' : 'All cases'}
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-xs text-slate-300">
            {view === 'intake' ? 'MAF Intake' : 'Case Overview'}
          </span>
        </div>
      )}

      {view === 'list' && (
        <MobilityActivationTab onSelectCase={handleSelectCase} />
      )}
      {view === 'intake' && activeCaseId && (
        <MobilityIntakeTab caseId={activeCaseId} onComplete={handleIntakeComplete} />
      )}
      {view === 'case' && activeCaseId && (
        <MobilityCaseOverviewTab caseId={activeCaseId} onOpenIntake={handleOpenIntake} />
      )}
    </div>
  );
}
