import React, { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface Props {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function ResizableLayout({ leftPanel, rightPanel }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full">
      <div className={`transition-all ${collapsed ? 'w-16' : 'w-[40%]'} border-r border-white/10`}>
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} className="p-4" title="Expand configuration panel" aria-label="Expand configuration panel">
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        ) : (
          <div className="h-full overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Configuration</h2>
              <button onClick={() => setCollapsed(true)} className="p-2 rounded bg-white/5" title="Collapse configuration panel" aria-label="Collapse configuration panel">
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
            {leftPanel}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">{rightPanel}</div>
    </div>
  );
}
