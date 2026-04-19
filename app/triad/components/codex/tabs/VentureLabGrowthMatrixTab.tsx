'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Grid3x3, Layers, Briefcase, Target, RefreshCw, Plus, Route } from 'lucide-react';
import { CodexCopilotLayer } from '@/app/components/codex/CodexCopilotLayer';

import {
  Venture, IndustryOverlay, MatrixSubTab,
  SAMPLE_VENTURES,
} from './_ventureLabData';
import { LadderView, ModelView, StrategyView } from './_ventureLabSubViews';
import { MatrixView, AddVentureModal } from './_ventureLabMatrix';

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
}

const OVERLAY_LABELS: { id: IndustryOverlay; label: string }[] = [
  { id: 'generic', label: 'Generic' },
  { id: 'media',   label: 'Media'   },
  { id: 'legal',   label: 'Legal'   },
];

const SUB_TABS: { id: MatrixSubTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'matrix',   label: 'Matrix',   Icon: Grid3x3  },
  { id: 'ladder',   label: 'Ladder',   Icon: Layers   },
  { id: 'model',    label: 'Model',    Icon: Briefcase},
  { id: 'strategy', label: 'Strategy', Icon: Target   },
];

export function VentureLabGrowthMatrixTab({ isAdmin }: Props) {
  const [ventures,       setVentures]       = useState<Venture[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [subTab,         setSubTab]         = useState<MatrixSubTab>('matrix');
  const [overlay,        setOverlay]        = useState<IndustryOverlay>('generic');
  const [showGoldenPath, setShowGoldenPath] = useState(false);
  const [showAdd,        setShowAdd]        = useState(false);
  const [addPreY,        setAddPreY]        = useState<number | undefined>();
  const [addPreX,        setAddPreX]        = useState<number | undefined>();
  const [copilotOpen,    setCopilotOpen]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/venture-lab/portfolio?status=active');
      const data = await res.json();
      if (data.ok) setVentures(data.ventures ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addVenture = async (v: { venture_name: string; venture_slug: string; y_maturity: number; x_commercialization: number; payload: Record<string, unknown> }) => {
    const res  = await fetch('/api/venture-lab/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    const data = await res.json();
    if (data.ok) { setVentures(prev => [...prev, data.venture]); setShowAdd(false); }
  };

  const seedSamples = async () => {
    for (const s of SAMPLE_VENTURES) {
      const existing = ventures.find(v => v.venture_slug === s.venture_slug);
      if (existing) continue;
      await fetch('/api/venture-lab/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
    }
    await load();
  };

  const savePayload = async (id: string, payload: Venture['payload']) => {
    const res  = await fetch(`/api/venture-lab/portfolio/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    const data = await res.json();
    if (data.ok) setVentures(prev => prev.map(v => v.id === id ? data.venture : v));
  };

  const handleMarketaPrompt = useCallback(async (prompt: string): Promise<string> => {
    try {
      const res = await fetch('/api/codex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, persona: 'aigent-marketa', domain: 'venture-lab' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.response || 'No response — try again.';
    } catch {
      return 'Something went wrong. Please try again.';
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">

        {/* Sub-tabs */}
        <div className="flex items-center gap-0.5">
          {SUB_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                subTab === id
                  ? 'bg-amber-500/[0.12] text-amber-300 ring-1 ring-amber-500/25'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Overlay selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-600 mr-0.5">Lens:</span>
          {OVERLAY_LABELS.map(o => (
            <button key={o.id} onClick={() => setOverlay(o.id)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                overlay === o.id
                  ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Golden path toggle */}
        <button onClick={() => setShowGoldenPath(p => !p)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all ${
            showGoldenPath
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25'
              : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.04]'
          }`}
          title="Toggle golden path">
          <Route className="w-3 h-3" />
          Path
        </button>

        <button onClick={load} className="text-slate-600 hover:text-slate-300 transition-colors" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {isAdmin && subTab === 'matrix' && (
          <button onClick={() => { setAddPreY(undefined); setAddPreX(undefined); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-medium transition-all">
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>

      {/* Zone legend strip */}
      <div className="flex-shrink-0 px-4 py-1.5 border-b border-white/[0.04] flex items-center gap-4">
        {(['formation','validation','activation','strategic','scale'] as const).map(zone => {
          const dots: Record<string, string> = {
            formation: 'bg-slate-400', validation: 'bg-blue-400',
            activation: 'bg-emerald-400', strategic: 'bg-amber-400', scale: 'bg-violet-400',
          };
          const labels: Record<string, string> = {
            formation: 'text-slate-400', validation: 'text-blue-300',
            activation: 'text-emerald-300', strategic: 'text-amber-300', scale: 'text-violet-300',
          };
          return (
            <div key={zone} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${dots[zone]}`} />
              <span className={`text-[10px] capitalize ${labels[zone]}`}>{zone}</span>
            </div>
          );
        })}
        {showGoldenPath && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-amber-400/60 text-[10px]">◆</span>
            <span className="text-[10px] text-amber-400/60">golden path</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto relative">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : (
          <>
            {subTab === 'matrix' && (
              <MatrixView
                ventures={ventures}
                overlay={overlay}
                showGoldenPath={showGoldenPath}
                isAdmin={isAdmin}
                onAdd={(y, x) => { setAddPreY(y); setAddPreX(x); setShowAdd(true); }}
                onSeedSamples={seedSamples}
              />
            )}
            {subTab === 'ladder' && (
              <LadderView ventures={ventures} overlay={overlay} />
            )}
            {subTab === 'model' && (
              <ModelView ventures={ventures} isAdmin={isAdmin} onSave={savePayload} />
            )}
            {subTab === 'strategy' && (
              <StrategyView ventures={ventures} overlay={overlay} />
            )}
          </>
        )}
      </div>

      {/* Add venture modal */}
      {showAdd && (
        <AddVentureModal
          onClose={() => setShowAdd(false)}
          onSave={addVenture}
          preY={addPreY}
          preX={addPreX}
        />
      )}

      {/* Marketa copilot */}
      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        accentColor="rose"
        agent={{ id: 'aigent-marketa', name: 'Marketa' }}
        personaId="aigent-marketa"
        onUserPrompt={handleMarketaPrompt}
        enableInferenceRendering
        promptPlaceholder="Ask Marketa to assess a venture, suggest next actions, or enrich a scorecard..."
        initialMessage="I'm Marketa — your venture studio copilot. Tell me about a venture and I'll help position it on the growth matrix, suggest next actions, or draft a scorecard."
        quickPrompts={[
          'Assess MetaKnyt position',
          'What zone are we in?',
          'Next best action',
          'Enrich scorecard',
          'Compare ventures',
        ]}
      />
    </div>
  );
}
