/**
 * MoneyPenny Tab Component
 * 
 * Renders the complete Aigent MoneyPenny cartridge within the Multi-Codex Viewer
 */

"use client";

import MoneyPennyCartridge from "@/app/(shell)/moneypenny/components/MoneyPennyCartridge";

interface MoneyPennyTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
}

export function MoneyPennyTab({ theme = 'dark', density = 'wide', personaId }: MoneyPennyTabProps) {
  return (
    <div className={`h-full w-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      <MoneyPennyCartridge />
    </div>
  );
}
