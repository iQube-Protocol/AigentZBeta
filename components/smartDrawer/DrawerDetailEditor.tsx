import React, { useState, useEffect } from 'react';
import { Plus, X, ExternalLink, Edit2, Check, GripVertical } from 'lucide-react';
import type { SmartTriadSet, DrawerSize, TriadDrawerSlotConfig } from '@/src/smartTriad';

interface Props {
  triadSet: SmartTriadSet;
  selectedDrawerId: string;
  onChange: (updated: SmartTriadSet) => void;
}

const DRAWER_SIZES: DrawerSize[] = ['wallet-narrow', 'wallet-wide', 'panel-3q', 'immersive-3q', 'modal-centered', 'full-immersive'];

const CONTENT_VARIANTS = [
  { id: 'hero', label: 'Hero', modality: 'content-card' },
  { id: 'featured', label: 'Featured', modality: 'content-card' },
  { id: 'standard', label: 'Standard', modality: 'content-card' },
  { id: 'compact', label: 'Compact', modality: 'content-card' },
  { id: 'carousel3', label: 'Carousel 3', modality: 'content-card' },
  { id: 'carousel4', label: 'Carousel 4', modality: 'content-card' },
  { id: 'poster2', label: 'Poster 2', modality: 'content-card' },
  { id: 'poster3', label: 'Poster 3', modality: 'content-card' },
  { id: 'thumbnail6', label: 'Thumbnail 6', modality: 'content-card' },
  { id: 'wallet-overview', label: 'Wallet Overview', modality: 'wallet-section' },
  { id: 'wallet-tasks', label: 'Wallet Tasks', modality: 'wallet-section' },
];

export function DrawerDetailEditor({ triadSet, selectedDrawerId, onChange }: Props) {
  const drawer = triadSet.drawers.find(d => d.id === selectedDrawerId);
  const [selectedTabId, setSelectedTabId] = useState(drawer?.tabs[0]?.id);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  
  if (!drawer) return null;
  
  // Reset tab selection when drawer changes
  useEffect(() => {
    if (drawer && drawer.tabs.length > 0) {
      // Always reset to first tab when drawer changes
      setSelectedTabId(drawer.tabs[0].id);
      console.log('DrawerDetailEditor: Reset to first tab for drawer:', selectedDrawerId, 'tab:', drawer.tabs[0].id);
    }
  }, [selectedDrawerId, drawer]);
  
  const selectedTab = drawer.tabs.find(t => t.id === selectedTabId);

  const handleAddSlot = () => {
    if (!selectedTab) return;
    
    const newSlot: TriadDrawerSlotConfig = {
      id: `slot-${Date.now()}`,
      label: `New Slot ${selectedTab.slots.length + 1}`,
      modality: 'content-card',
    };

    const updatedDrawers = triadSet.drawers.map(d => {
      if (d.id !== selectedDrawerId) return d;
      return {
        ...d,
        tabs: d.tabs.map(t => {
          if (t.id !== selectedTabId) return t;
          return { ...t, slots: [...t.slots, newSlot] };
        }),
      };
    });

    onChange({ ...triadSet, drawers: updatedDrawers });
  };

  const handleRemoveSlot = (slotId: string) => {
    const updatedDrawers = triadSet.drawers.map(d => {
      if (d.id !== selectedDrawerId) return d;
      return {
        ...d,
        tabs: d.tabs.map(t => {
          if (t.id !== selectedTabId) return t;
          return { ...t, slots: t.slots.filter(s => s.id !== slotId) };
        }),
      };
    });

    onChange({ ...triadSet, drawers: updatedDrawers });
  };

  const handleUpdateSlot = (slotId: string, variantId: string) => {
    const updatedDrawers = triadSet.drawers.map(d => {
      if (d.id !== selectedDrawerId) return d;
      return {
        ...d,
        tabs: d.tabs.map(t => {
          if (t.id !== selectedTabId) return t;
          return {
            ...t,
            slots: t.slots.map(s => s.id === slotId ? { ...s, variantId } : s),
          };
        }),
      };
    });

    onChange({ ...triadSet, drawers: updatedDrawers });
  };

  const handleUpdateDrawerSize = (size: DrawerSize) => {
    const updatedDrawers = triadSet.drawers.map(d => {
      if (d.id !== selectedDrawerId) return d;
      return { ...d, defaultSize: size };
    });

    onChange({ ...triadSet, drawers: updatedDrawers });
  };

  const handleStartEdit = (slotId: string, currentLabel: string) => {
    setEditingSlotId(slotId);
    setEditLabel(currentLabel);
  };

  const handleSaveLabel = (slotId: string) => {
    const updatedDrawers = triadSet.drawers.map(d => {
      if (d.id !== selectedDrawerId) return d;
      return {
        ...d,
        tabs: d.tabs.map(t => {
          if (t.id !== selectedTabId) return t;
          return {
            ...t,
            slots: t.slots.map(s => s.id === slotId ? { ...s, label: editLabel } : s),
          };
        }),
      };
    });
    onChange({ ...triadSet, drawers: updatedDrawers });
    setEditingSlotId(null);
  };

  const handleDragStart = (slotId: string) => {
    setDraggedSlotId(slotId);
  };

  const handleDragOver = (e: React.DragEvent, targetSlotId: string) => {
    e.preventDefault();
    if (!draggedSlotId || draggedSlotId === targetSlotId || !selectedTab) return;
    
    const slots = [...selectedTab.slots];
    const draggedIdx = slots.findIndex(s => s.id === draggedSlotId);
    const targetIdx = slots.findIndex(s => s.id === targetSlotId);
    
    const [removed] = slots.splice(draggedIdx, 1);
    slots.splice(targetIdx, 0, removed);
    
    const updatedDrawers = triadSet.drawers.map(d => {
      if (d.id !== selectedDrawerId) return d;
      return {
        ...d,
        tabs: d.tabs.map(t => t.id === selectedTabId ? { ...t, slots } : t),
      };
    });
    onChange({ ...triadSet, drawers: updatedDrawers });
  };

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-purple-300">{drawer.label} Configuration</h3>
        <a
          href="/demo/smart-content"
          target="_blank"
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Gallery
        </a>
      </div>

      {drawer.tabs.length > 1 && (
        <div className="flex gap-1">
          {drawer.tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTabId(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                selectedTabId === tab.id
                  ? 'bg-purple-500/30 text-purple-200 font-semibold'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 block mb-2">Drawer Type</label>
          <select 
            value={drawer.defaultSize}
            onChange={(e) => handleUpdateDrawerSize(e.target.value as DrawerSize)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
          >
            {DRAWER_SIZES.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-2">Menu Position</label>
          <select 
            value={drawer.defaultMenuBehavior?.side || 'right'}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>
      </div>

      {selectedTab && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/50">Smart Content Slots ({selectedTab.slots.length})</label>
            <button 
              onClick={handleAddSlot}
              className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs text-white/70 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {selectedTab.slots.map(slot => (
              <div 
                key={slot.id} 
                className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
                draggable
                onDragStart={() => handleDragStart(slot.id)}
                onDragOver={(e) => handleDragOver(e, slot.id)}
                onDragEnd={() => setDraggedSlotId(null)}
              >
                <div className="flex items-center gap-2">
                  <button className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/60">
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center gap-2">
                    {editingSlotId === slot.id ? (
                      <>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel(slot.id)}
                          className="flex-1 bg-white/10 border border-purple-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveLabel(slot.id)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-white/90 flex-1">{slot.label}</span>
                        <button 
                          onClick={() => handleStartEdit(slot.id, slot.label)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-white/50" />
                        </button>
                      </>
                    )}
                  </div>
                  <button 
                    onClick={() => handleRemoveSlot(slot.id)}
                    className="p-1 hover:bg-white/10 rounded transition-colors" 
                    title="Remove slot" 
                    aria-label="Remove slot"
                  >
                    <X className="w-3.5 h-3.5 text-white/50" />
                  </button>
                </div>
                <div className="text-xs text-white/50">Modality: {slot.modality}</div>
                <select
                  value={slot.variantId || ''}
                  onChange={(e) => handleUpdateSlot(slot.id, e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-xs text-white"
                >
                  <option value="">Select variant...</option>
                  {CONTENT_VARIANTS.filter(v => v.modality === slot.modality).map(variant => (
                    <option key={variant.id} value={variant.id}>{variant.label}</option>
                  ))}
                </select>
                {slot.variantId && (
                  <div className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-mono">
                    {slot.variantId}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
