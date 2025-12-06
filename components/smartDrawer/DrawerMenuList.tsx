import React, { useState } from 'react';
import { Plus, X, Edit2, Check } from 'lucide-react';
import type { SmartTriadSet } from '@/src/smartTriad';

interface Props {
  triadSet: SmartTriadSet;
  selectedDrawerId: string | null;
  onSelectDrawer: (id: string) => void;
  onAddDrawer?: () => void;
  onDeleteDrawer?: (drawerId: string) => void;
  onRenameDrawer?: (drawerId: string, newLabel: string) => void;
}

export function DrawerMenuList({ triadSet, selectedDrawerId, onSelectDrawer, onAddDrawer, onDeleteDrawer, onRenameDrawer }: Props) {
  const [editingDrawerId, setEditingDrawerId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Drawer Menu Items</h3>
        {onAddDrawer && (
          <button
            onClick={onAddDrawer}
            className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-xs text-purple-300 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Drawer
          </button>
        )}
      </div>
      <div className="space-y-2">
        {triadSet.drawers.map((d) => (
          <div
            key={d.id}
            className={`rounded-xl border-2 transition-all ${
              selectedDrawerId === d.id 
                ? 'border-purple-500 bg-purple-500/10' 
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {editingDrawerId === d.id ? (
                      <>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRenameDrawer?.(d.id, editLabel);
                              setEditingDrawerId(null);
                            }
                          }}
                          className="flex-1 bg-white/10 border border-purple-500/50 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:border-purple-500"
                          autoFocus
                          aria-label="Edit drawer name"
                          placeholder="Drawer name"
                        />
                        <button
                          onClick={() => {
                            onRenameDrawer?.(d.id, editLabel);
                            setEditingDrawerId(null);
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="Save drawer name"
                          aria-label="Save drawer name"
                        >
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            console.log('DrawerMenuList: Selecting drawer:', d.label, d.id);
                            onSelectDrawer(d.id);
                          }}
                          className="font-semibold text-white/90 flex-1 truncate text-left hover:text-white transition-colors"
                          title={`Select ${d.label} drawer`}
                        >
                          {d.label}
                        </button>
                        {onRenameDrawer && (
                          <button
                            onClick={() => {
                              setEditingDrawerId(d.id);
                              setEditLabel(d.label);
                            }}
                            className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                            title="Rename drawer"
                            aria-label="Rename drawer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-white/50" />
                          </button>
                        )}
                      </>
                    )}
                    {onDeleteDrawer && (
                      <button
                        onClick={() => onDeleteDrawer(d.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                        title="Delete drawer"
                        aria-label="Delete drawer"
                      >
                        <X className="w-3.5 h-3.5 text-white/50" />
                      </button>
                    )}
                  </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {d.tabs.map(tab => (
                    <span key={tab.id} className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60">
                      {tab.label}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-xs font-semibold">
                    {d.defaultSize}
                  </span>
                  <span className="text-xs text-white/50">{d.side}</span>
                </div>
              </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
