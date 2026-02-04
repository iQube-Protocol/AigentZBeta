import React, { useState } from 'react';
import { Monitor, Smartphone, Tv, X, Wallet, FileText, TrendingUp, Layers, Menu } from 'lucide-react';
import type { SmartTriadSet } from '@/src/smartTriad';
import SmartContentCard from '@/app/components/content/SmartContentCard';
import { getSampleContentByVariant } from './sampleContent';

interface Props {
  triadSet: SmartTriadSet;
}

const ICONS: Record<string, any> = {
  'Wallet': Wallet, 'Article': FileText, 'Analytics': TrendingUp, 'Codex': Layers,
};

export function LivePreviewPanel({ triadSet }: Props) {
  const [activeDrawerId, setActiveDrawerId] = useState<string>();
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'tv'>('desktop');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const activeDrawer = triadSet.drawers.find(d => d.id === activeDrawerId);
  const activeTab = activeDrawer?.tabs[0];

  const deviceScales = {
    desktop: { width: '100%', scale: 1 },
    mobile: { width: '375px', scale: 0.8 },
    tv: { width: '100%', scale: 1.2 },
  };
  
  const deviceConfig = deviceScales[device];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Live Preview</h3>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {[
            { id: 'desktop' as const, Icon: Monitor },
            { id: 'mobile' as const, Icon: Smartphone },
            { id: 'tv' as const, Icon: Tv },
          ].map(({ id, Icon }) => (
            <button key={id} onClick={() => setDevice(id)}
              className={`p-2 rounded-md transition-colors ${device === id ? 'bg-purple-500/30 text-purple-300' : 'text-white/50 hover:text-white/80 hover:bg-white/10'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        <div 
          className="relative h-full w-full flex items-center justify-center"
          style={{ 
            transform: `scale(${deviceConfig.scale})`,
            transformOrigin: 'center center'
          }}
        >
          <div className="relative h-full" style={{ width: deviceConfig.width }}>
          {/* Transparent centered menu - Desktop only */}
          {device !== 'mobile' && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3 p-3 z-40">
              {triadSet.drawers.map(drawer => {
                const Icon = ICONS[drawer.label] || Layers;
                return (
                  <button key={drawer.id} onClick={() => setActiveDrawerId(drawer.id)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all backdrop-blur-sm ${
                      activeDrawerId === drawer.id ? 'bg-purple-500/40 ring-2 ring-purple-400' : 'bg-white/10 hover:bg-white/20'}`}>
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          )}

        {/* Drawer */}
        {activeDrawer && activeTab && (() => {
          const desktopSizeClasses = {
            'wallet-narrow': 'absolute right-16 top-0 h-full w-[320px]',
            'wallet-wide': 'absolute right-16 top-0 h-full w-[480px]',
            'panel-3q': 'absolute right-16 top-0 h-[75%] w-[calc(100%-64px)]',
            'immersive-3q': 'absolute right-0 top-0 h-[75%] w-full',
            'modal-centered': 'absolute inset-0 flex items-center justify-center p-8',
            'full-immersive': 'absolute inset-0',
          };
          const mobileSizeClasses = {
            'wallet-narrow': 'absolute inset-0',
            'wallet-wide': 'absolute inset-0',
            'panel-3q': 'absolute inset-0',
            'immersive-3q': 'absolute inset-0',
            'modal-centered': 'absolute inset-0',
            'full-immersive': 'absolute inset-0',
          };
          const sizeClasses = device === 'mobile' ? mobileSizeClasses : desktopSizeClasses;
          const drawerClass = sizeClasses[activeDrawer.defaultSize] || sizeClasses['panel-3q'];
          
          return (
            <div className={`${drawerClass} bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col overflow-hidden`}>
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                {device === 'mobile' && (
                  <button 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-semibold">{activeDrawer.label}</h2>
                  <p className="text-sm text-white/50">{activeTab.label}</p>
                </div>
              </div>
              <button onClick={() => setActiveDrawerId(undefined)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              {!activeTab.slots.length && (
                <p className="text-white/40 text-sm text-center mt-20">No slots yet. Add from left panel.</p>
              )}
              {activeTab.slots.map(slot => (
                <div key={slot.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">{slot.label}</span>
                    <span className="text-xs text-cyan-400 font-mono">{slot.variantId || 'standard'}</span>
                  </div>
                  <SmartContentCard content={getSampleContentByVariant(slot.variantId)} variant={(slot.variantId || 'standard') as any} />
                </div>
              ))}
            </div>
            
            {/* Mobile overlay menu */}
            {device === 'mobile' && mobileMenuOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="absolute inset-0 bg-black/20 z-10"
                  onClick={() => setMobileMenuOpen(false)}
                />
                {/* Menu */}
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-black/90 backdrop-blur-xl border-l border-white/10 flex flex-col items-center gap-3 p-3 z-20">
                {triadSet.drawers.map(drawer => {
                  const Icon = ICONS[drawer.label] || Layers;
                  return (
                    <button 
                      key={drawer.id} 
                      onClick={() => {
                        setActiveDrawerId(drawer.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        activeDrawerId === drawer.id ? 'bg-purple-500/40 ring-2 ring-purple-400' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
              </>
            )}
          </div>
          );
        })()}

          {!activeDrawerId && (
            <div className="absolute inset-0 flex items-center justify-center pr-20">
              <p className="text-white/40 text-sm">Click menu items to preview →</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
