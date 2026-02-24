import React from 'react';
import type { SmartTriadSet } from '../model';
import { TriadCard, TriadCardHeader, TriadCardContent } from './TriadCard';

interface SmartTriadContentPanelProps {
  triadSet: SmartTriadSet;
  onChange: (updated: SmartTriadSet) => void;
}

export function SmartTriadContentPanel({ triadSet, onChange }: SmartTriadContentPanelProps) {
  return (
    <TriadCard>
      <TriadCardHeader title="Smart Content Variants" subtitle="Assign content to slots" />
      <TriadCardContent>
        <div className="grid grid-cols-2 gap-4">
          {['card-hero-wide', 'card-panel-3q', 'card-thumbnail'].map((variant) => (
            <div key={variant} className="p-4 rounded-xl border border-border/40 hover:border-cyan-500/40 cursor-pointer">
              <p className="text-sm font-semibold">{variant}</p>
            </div>
          ))}
        </div>
      </TriadCardContent>
    </TriadCard>
  );
}
