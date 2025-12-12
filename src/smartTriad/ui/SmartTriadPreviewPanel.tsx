import React, { useState } from 'react';
import type { SmartTriadSet } from '../model';
import { SmartMenuRail } from './SmartMenuRail';
import { SmartDrawerShell } from './SmartDrawerShell';
import { SlotRenderer } from './SlotRenderer';

interface SmartTriadPreviewPanelProps {
  triadSet: SmartTriadSet;
}

export function SmartTriadPreviewPanel({ triadSet }: SmartTriadPreviewPanelProps) {
  const [activeDrawerId, setActiveDrawerId] = useState<string | undefined>();
  
  const activeDrawer = triadSet.drawers.find(d => d.id === activeDrawerId);
  const activeTab = activeDrawer?.tabs[0];
  
  return (
    <div className="relative h-full min-h-[600px] rounded-3xl border border-border/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Menu Rail */}
      <SmartMenuRail
        items={triadSet.drawers.map(d => ({
          id: d.id,
          icon: <div className="w-5 h-5 rounded bg-cyan-500/20" />,
          label: d.label,
          tooltip: d.label,
        }))}
        activeItemId={activeDrawerId}
        behavior={triadSet.drawers[0]?.defaultMenuBehavior || { mode: 'fixed-rail', side: 'right' }}
        onSelect={setActiveDrawerId}
      />

      {/* Active Drawer */}
      {activeDrawer && activeTab && (
        <SmartDrawerShell
          isOpen={true}
          size={activeDrawer.defaultSize}
          title={activeDrawer.label}
          subtitle={activeTab.label}
          onClose={() => setActiveDrawerId(undefined)}
        >
          <div className="p-6 space-y-4">
            {activeTab.slots.map(slot => (
              <SlotRenderer key={slot.id} triadSet={triadSet} slot={slot} />
            ))}
          </div>
        </SmartDrawerShell>
      )}

      {/* Preview Hint */}
      {!activeDrawerId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground">Select a drawer from the menu →</p>
        </div>
      )}
    </div>
  );
}
