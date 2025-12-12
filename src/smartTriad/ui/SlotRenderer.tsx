import React from 'react';
import type { TriadDrawerSlotConfig, SmartTriadSet } from '../model';

interface SlotRendererProps {
  triadSet: SmartTriadSet;
  slot: TriadDrawerSlotConfig;
}

export function SlotRenderer({ triadSet, slot }: SlotRendererProps) {
  const variantId = slot.variantId || triadSet.content.slotBindings?.[slot.id];

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-6">
      <h4 className="text-lg font-bold mb-2">{slot.label}</h4>
      <p className="text-sm text-muted-foreground">
        {slot.modality} • {variantId || 'default'}
      </p>
      <div className="mt-4 aspect-video rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20" />
    </div>
  );
}
