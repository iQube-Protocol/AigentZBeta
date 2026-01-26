/**
 * MarketaTab Component
 * 
 * Renders the complete Aigent Marketa cartridge within the Multi-Codex Viewer
 */

"use client";

import React from "react";
import MarketaCartridge from "@/app/(shell)/marketa/components/MarketaCartridge";

interface MarketaTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
}

export function MarketaTab({ theme = 'dark', density = 'wide', personaId }: MarketaTabProps) {
  return (
    <div className={`h-full w-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      <MarketaCartridge />
    </div>
  );
}
