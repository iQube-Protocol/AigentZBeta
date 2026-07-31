'use client';

/**
 * MobilityWorkstreamShellTab — generic shell for HMS workstream top-level tabs.
 *
 * When used as a standalone top-level tab (Housing / Education / Relocation /
 * Business / Economic / Family), the TabRenderer has no caseId context to pass.
 * This shell:
 *   1. Fetches the operator's cases.
 *   2. Auto-selects the single active case (most common scenario).
 *   3. Shows a case picker if there are multiple cases.
 *   4. Renders the correct workstream component once a caseId is selected.
 *
 * Receives `workstream` from tab.config.props (set in codex-configs.ts).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, FolderOpen, ChevronDown } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { MobilityHousingTab }    from './MobilityHousingTab';
import { MobilityEducationTab }  from './MobilityEducationTab';
import { MobilityRelocationTab } from './MobilityRelocationTab';
import { MobilityBusinessTab }   from './MobilityBusinessTab';
import { MobilityEconomicTab }   from './MobilityEconomicTab';
import { MobilityFamilyTab }     from './MobilityFamilyTab';

type WorkstreamKey = 'housing' | 'education' | 'relocation' | 'business' | 'economic' | 'family';

interface CaseSummary {
  id: string;
  case_type: string;
  case_status: string;
}

interface Props {
  workstream: WorkstreamKey;
  [key: string]: unknown;
}

function WorkstreamContent({ workstream, caseId }: { workstream: WorkstreamKey; caseId: string }) {
  switch (workstream) {
    case 'housing':    return <MobilityHousingTab    caseId={caseId} />;
    case 'education':  return <MobilityEducationTab  caseId={caseId} />;
    case 'relocation': return <MobilityRelocationTab caseId={caseId} />;
    case 'business':   return <MobilityBusinessTab   caseId={caseId} />;
    case 'economic':   return <MobilityEconomicTab   caseId={caseId} />;
    case 'family':     return <MobilityFamilyTab     caseId={caseId} />;
    default:           return null;
  }
}

export function MobilityWorkstreamShellTab({ workstream }: Props) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/mobility/cases', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load cases');
      const list: CaseSummary[] = json.cases ?? [];
      setCases(list);
      if (list.length === 1) setSelectedId(list[0].id);
      else if (list.length > 1) {
        // prefer active case; fall back to first
        const active = list.find(c => c.case_status === 'active') ?? list[0];
        setSelectedId(active.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading case…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="py-16 text-center">
        <FolderOpen className="h-10 w-10 text-slate-700 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No cases found.</p>
        <p className="text-xs text-slate-600 mt-1">Create a case in the Activation → Cases tab first.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Case selector — only shown when multiple cases exist */}
      {cases.length > 1 && (
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-2">
          <span className="text-xs text-slate-500">Case:</span>
          <div className="relative">
            <button
              onClick={() => setPickerOpen(v => !v)}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
              {cases.find(c => c.id === selectedId)?.case_type?.replace('_', ' ') ?? 'Select case'}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {pickerOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 min-w-48 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                {cases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedId(c.id); setPickerOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span className="capitalize">{c.case_type.replace('_', ' ')}</span>
                    <span className="ml-auto text-slate-500 capitalize">{c.case_status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {selectedId && <WorkstreamContent workstream={workstream} caseId={selectedId} />}
      </div>
    </div>
  );
}
