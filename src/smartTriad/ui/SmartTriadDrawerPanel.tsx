/**
 * SmartTriadDrawerPanel
 * Configure drawers, tabs, and slots for a SmartTriadSet
 */

import React from 'react';
import { Plus, X, Settings } from 'lucide-react';
import type { SmartTriadSet, TriadDrawerConfig } from '../model';
import { TriadCard, TriadCardHeader, TriadCardContent } from './TriadCard';

interface SmartTriadDrawerPanelProps {
  triadSet: SmartTriadSet;
  onChange: (updated: SmartTriadSet) => void;
}

export function SmartTriadDrawerPanel({ triadSet, onChange }: SmartTriadDrawerPanelProps) {
  const handleDynamicModeChange = (mode: SmartTriadSet['dynamicMode']) => {
    onChange({ ...triadSet, dynamicMode: mode });
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Mode Selector */}
      <TriadCard>
        <TriadCardHeader 
          title="Dynamic Mode"
          subtitle="How Copilot can modify this triad"
        />
        <TriadCardContent>
          <div className="grid grid-cols-3 gap-3">
            {(['static-only', 'copilot-suggest', 'copilot-adaptive'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleDynamicModeChange(mode)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  triadSet.dynamicMode === mode
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-border/40 hover:border-border/60'
                }`}
              >
                <p className="text-sm font-semibold capitalize">
                  {mode.replace('-', ' ')}
                </p>
              </button>
            ))}
          </div>
        </TriadCardContent>
      </TriadCard>

      {/* Drawers List */}
      <TriadCard>
        <TriadCardHeader 
          title="Drawers"
          subtitle={`${triadSet.drawers.length} drawer${triadSet.drawers.length !== 1 ? 's' : ''} configured`}
          actions={
            <button className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Drawer
            </button>
          }
        />
        <TriadCardContent>
          <div className="space-y-4">
            {triadSet.drawers.map((drawer) => (
              <DrawerConfigCard key={drawer.id} drawer={drawer} />
            ))}
          </div>
        </TriadCardContent>
      </TriadCard>
    </div>
  );
}

function DrawerConfigCard({ drawer }: { drawer: TriadDrawerConfig }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4 hover:border-border/60 transition-all">
      {/* Drawer Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold">{drawer.label}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs font-semibold">
              {drawer.defaultSize}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-xs font-semibold">
              {drawer.side}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 text-xs font-semibold">
              {drawer.defaultMenuBehavior?.mode || 'default'}
            </span>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
          Tabs ({drawer.tabs.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {drawer.tabs.map((tab) => (
            <div
              key={tab.id}
              className="px-3 py-2 rounded-lg bg-white/5 border border-border/40 hover:border-cyan-500/40 transition-all cursor-pointer group"
            >
              <p className="text-sm font-semibold">{tab.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tab.slots.length} slot{tab.slots.length !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
          <button className="px-3 py-2 rounded-lg border-2 border-dashed border-border/40 hover:border-cyan-500/40 transition-all flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="w-3 h-3" />
            Add Tab
          </button>
        </div>
      </div>
    </div>
  );
}
