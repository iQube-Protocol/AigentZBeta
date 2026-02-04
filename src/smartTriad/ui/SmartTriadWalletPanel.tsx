import React from 'react';
import type { SmartTriadSet } from '../model';
import { TriadCard, TriadCardHeader, TriadCardContent } from './TriadCard';

interface SmartTriadWalletPanelProps {
  triadSet: SmartTriadSet;
  onChange: (updated: SmartTriadSet) => void;
}

export function SmartTriadWalletPanel({ triadSet, onChange }: SmartTriadWalletPanelProps) {
  const toggleSection = (section: keyof typeof triadSet.wallet) => {
    onChange({
      ...triadSet,
      wallet: {
        ...triadSet.wallet,
        [section]: !triadSet.wallet[section],
      },
    });
  };

  return (
    <div className="space-y-6">
      <TriadCard>
        <TriadCardHeader title="Wallet Configuration" subtitle="Configure wallet sections and behavior" />
        <TriadCardContent>
          <div className="space-y-4">
            {(['showTasks', 'showRewards', 'showLibrary', 'personaAware'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-border/40">
                <p className="text-sm font-semibold capitalize">{key.replace('show', '').replace('persona', 'Persona ')}</p>
                <button
                  onClick={() => toggleSection(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    triadSet.wallet[key]
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white/10 text-muted-foreground'
                  }`}
                >
                  {triadSet.wallet[key] ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </TriadCardContent>
      </TriadCard>
    </div>
  );
}
