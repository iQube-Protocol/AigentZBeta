"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Save, X, Palette, Download, Upload, Loader2, XCircle } from "lucide-react";
import type { SmartTriadSet } from '@/src/smartTriad';
import { saveSmartTriadSet } from '@/src/smartTriad/service';
import { qriptopianTriadSet, metaKnytsTriadSet, moneyPennyTriadSet } from '@/src/smartTriad/fixtures';
import { DynamicModeSelector } from '@/components/smartDrawer/DynamicModeSelector';
import { DrawerMenuList } from '@/components/smartDrawer/DrawerMenuList';
import { DrawerDetailEditor } from '@/components/smartDrawer/DrawerDetailEditor';
import { LivePreviewPanel } from '@/components/smartDrawer/LivePreviewPanel';
import { ResizableLayout } from '@/components/smartDrawer/ResizableLayout';
import { CopilotBar } from '@/components/smartDrawer/CopilotBar';

const APPS = [
  { id: "Qriptopian", label: "Qriptopian" },
  { id: "metaKnyts", label: "metaKnyts" },
  { id: "MoneyPenny", label: "MoneyPenny" },
];

export default function SmartDrawerDemoPage() {
  const [triadSet, setTriadSet] = useState<SmartTriadSet | null>(null);
  const [selectedApp, setSelectedApp] = useState("Qriptopian");
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<'drawers' | 'content' | 'api'>('drawers');
  const [showGallery, setShowGallery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    window.location.href = '/';
  };

  const handleSave = async () => {
    if (!triadSet) return;
    setSaving(true);
    setError(null);
    try {
      await saveSmartTriadSet(triadSet);
      console.log('✅ Configuration saved successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      setError(message);
      console.error('❌ Save failed:', message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    try {
      const json = JSON.stringify(triadSet, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedApp}-config.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('✅ Configuration exported');
    } catch (err) {
      const message = 'Failed to export configuration';
      setError(message);
      console.error('❌ Export failed:', err);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setTriadSet(imported);
      } catch (err) {
        alert('Invalid configuration file');
      }
    };
    reader.readAsText(file);
  };

  const handleAddDrawer = () => {
    if (!triadSet) {
      console.error('No triadSet available');
      return;
    }
    console.log('Adding new drawer...');
    const newDrawer = {
      id: `drawer-${Date.now()}`,
      label: `New Drawer ${triadSet.drawers.length + 1}`,
      side: 'right' as const,
      defaultSize: 'panel-3q' as const,
      defaultMenuBehavior: { mode: 'fixed-rail' as const, side: 'right' as const },
      tabs: [{ id: 'tab-1', label: 'Tab 1', slots: [] }],
    };
    const updatedSet = { ...triadSet, drawers: [...triadSet.drawers, newDrawer] };
    console.log('New drawer created:', newDrawer);
    setTriadSet(updatedSet);
    setSelectedDrawerId(newDrawer.id);
  };

  const handleDeleteDrawer = (drawerId: string) => {
    if (!triadSet) return;
    
    // Prevent deleting the last drawer
    if (triadSet.drawers.length <= 1) {
      setError('Cannot delete the last drawer. At least one drawer is required.');
      return;
    }
    
    console.log('Deleting drawer:', drawerId);
    const updatedDrawers = triadSet.drawers.filter(d => d.id !== drawerId);
    setTriadSet({ ...triadSet, drawers: updatedDrawers });
    
    // If deleted drawer was selected, select the first remaining drawer
    if (selectedDrawerId === drawerId) {
      setSelectedDrawerId(updatedDrawers[0]?.id || null);
    }
  };

  const handleRenameDrawer = (drawerId: string, newLabel: string) => {
    if (!triadSet || !newLabel.trim()) return;
    
    console.log('Renaming drawer:', drawerId, 'to:', newLabel);
    const updatedDrawers = triadSet.drawers.map(d => 
      d.id === drawerId ? { ...d, label: newLabel.trim() } : d
    );
    setTriadSet({ ...triadSet, drawers: updatedDrawers });
  };

  useEffect(() => {
    const fixtures = {
      'Qriptopian': qriptopianTriadSet,
      'metaKnyts': metaKnytsTriadSet,
      'MoneyPenny': moneyPennyTriadSet,
    };
    const fixture = fixtures[selectedApp as keyof typeof fixtures];
    if (fixture) {
      setTriadSet(fixture);
      // Auto-select first drawer when app changes
      if (fixture.drawers.length > 0) {
        setSelectedDrawerId(fixture.drawers[0].id);
      }
    }
  }, [selectedApp]);

  // Ensure a drawer is always selected if none is selected
  useEffect(() => {
    if (triadSet && !selectedDrawerId && triadSet.drawers.length > 0) {
      console.log('Page: Auto-selecting first drawer (none selected):', triadSet.drawers[0].label);
      setSelectedDrawerId(triadSet.drawers[0].id);
    }
    // If selected drawer no longer exists, select first available
    if (triadSet && selectedDrawerId) {
      const drawerExists = triadSet.drawers.some(d => d.id === selectedDrawerId);
      if (!drawerExists && triadSet.drawers.length > 0) {
        console.log('Page: Selected drawer no longer exists, selecting first:', triadSet.drawers[0].label);
        setSelectedDrawerId(triadSet.drawers[0].id);
      }
    }
  }, [triadSet, selectedDrawerId]);

  // Log when drawer selection changes
  useEffect(() => {
    if (selectedDrawerId && triadSet) {
      const drawer = triadSet.drawers.find(d => d.id === selectedDrawerId);
      console.log('Page: Drawer selection changed to:', drawer?.label, selectedDrawerId);
    }
  }, [selectedDrawerId, triadSet]);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [triadSet, handleSave]);

  if (!triadSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <p className="text-white/60">Loading Smart Drawer Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Smart Drawer Framework</h1>
              <p className="text-xs text-white/50">Unified Config & Preview</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="bg-white/10 rounded-lg px-3 py-2 border border-white/20"
            >
              {APPS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <button
              onClick={handleExport}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Export configuration"
            >
              <Download className="w-4 h-4" />
            </button>
            <label className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer" title="Import configuration">
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Close console"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/90 text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="h-[calc(100vh-80px)] overflow-hidden">
        <ResizableLayout
          leftPanel={
            <>
              <div className="flex gap-2 mb-6">
                {(['drawers', 'content', 'api'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setConfigTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${
                      configTab === tab ? 'bg-purple-500/30 text-purple-200' : 'bg-white/5 text-white/60'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {configTab === 'drawers' && (
                <>
                  <DynamicModeSelector
                    value={triadSet.dynamicMode}
                    onChange={(m) => setTriadSet({ ...triadSet, dynamicMode: m })}
                  />
                  <DrawerMenuList
                    triadSet={triadSet}
                    selectedDrawerId={selectedDrawerId}
                    onSelectDrawer={setSelectedDrawerId}
                    onAddDrawer={handleAddDrawer}
                    onDeleteDrawer={handleDeleteDrawer}
                    onRenameDrawer={handleRenameDrawer}
                  />
                  {selectedDrawerId && (
                    <DrawerDetailEditor
                      triadSet={triadSet}
                      selectedDrawerId={selectedDrawerId}
                      onChange={setTriadSet}
                    />
                  )}
                </>
              )}

              {configTab === 'content' && (
                <div className="space-y-4">
                  <p className="text-white/60 text-sm">Smart Content variants available for slots</p>
                  <button
                    onClick={() => setShowGallery(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                  >
                    <Palette className="w-4 h-4" />
                    Browse Smart Content Gallery
                  </button>
                  <div className="p-4 rounded-lg bg-white/5 space-y-2">
                    <h4 className="text-sm font-semibold">Allowed Variants</h4>
                    {triadSet.content?.allowedVariants?.map(v => (
                      <div key={v.id} className="text-xs px-2 py-1 rounded bg-white/10">{v.id}</div>
                    ))}
                  </div>
                </div>
              )}

              {configTab === 'api' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white/70">API Endpoints</h4>
                  {['/api/drawer/sets', '/api/drawer/resolve', '/api/copilot/compile'].map(endpoint => (
                    <div key={endpoint} className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                      {endpoint}
                    </div>
                  ))}
                </div>
              )}
            </>
          }
          rightPanel={<LivePreviewPanel triadSet={triadSet} />}
        />
      </main>

      <CopilotBar 
        triadSet={triadSet} 
        onChange={setTriadSet} 
        selectedDrawerId={selectedDrawerId}
        onAddDrawer={handleAddDrawer}
        onDeleteDrawer={handleDeleteDrawer}
      />

      {/* Smart Content Gallery Drawer */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] overflow-y-auto">
          <div className="sticky top-0 bg-black/40 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold">Smart Content Gallery</h2>
            </div>
            <button
              onClick={() => setShowGallery(false)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {['card-hero-wide', 'card-compact', 'card-panel-3q', 'card-immersive', 'wallet-section'].map(variant => (
                <div key={variant} className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <h3 className="text-sm font-semibold text-cyan-400">{variant}</h3>
                  <p className="text-xs text-white/50">Click to preview this variant</p>
                  <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-white/40">Preview</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
