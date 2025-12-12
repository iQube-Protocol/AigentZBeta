"use client";

import React, { useState, useEffect } from 'react';
import type { SmartTriadSet } from '@/src/smartTriad/model';
import { getSmartTriadSet } from '@/src/smartTriad/service';
import {
  SmartTriadDrawerPanel,
  SmartTriadContentPanel,
  SmartTriadPreviewPanel,
  SmartTriadWalletPanel,
} from '@/src/smartTriad/ui';

export default function SmartTriadConsolePage() {
  const [triadSet, setTriadSet] = useState<SmartTriadSet | null>(null);
  const [activeTab, setActiveTab] = useState<'drawers' | 'content' | 'wallet'>('drawers');

  useEffect(() => {
    getSmartTriadSet('Qriptopian', 'tenant-main', 'investor').then(setTriadSet);
  }, []);

  if (!triadSet) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <h1 className="text-3xl font-bold mb-8">Smart Triad Console</h1>
      
      <div className="grid grid-cols-2 gap-8">
        {/* Left: Config */}
        <div>
          <div className="flex gap-2 mb-4">
            {['drawers', 'content', 'wallet'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-lg ${activeTab === tab ? 'bg-cyan-500 text-white' : 'bg-white/10'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          {activeTab === 'drawers' && <SmartTriadDrawerPanel triadSet={triadSet} onChange={setTriadSet} />}
          {activeTab === 'content' && <SmartTriadContentPanel triadSet={triadSet} onChange={setTriadSet} />}
          {activeTab === 'wallet' && <SmartTriadWalletPanel triadSet={triadSet} onChange={setTriadSet} />}
        </div>

        {/* Right: Preview */}
        <SmartTriadPreviewPanel triadSet={triadSet} />
      </div>
    </div>
  );
}
