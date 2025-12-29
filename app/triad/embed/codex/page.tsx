/**
 * KNYT Codex Embed Page
 * 
 * Full-panel KNYT Codex for iframe embedding.
 * Query params:
 * - tab: 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order' (optional)
 * - theme: 'light' | 'dark' (optional)
 * - density: 'narrow' | 'wide' (optional)
 * - personaId: string (optional)
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Placeholder - will be replaced with ported Codex component
function CodexPanel() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'scrolls';
  const theme = searchParams.get('theme') || 'dark';
  const density = searchParams.get('density') || 'wide';
  const personaId = searchParams.get('personaId');

  return (
    <div className="flex flex-col h-full w-full p-4">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">KNYT Codex Embed</h1>
          <p className="text-slate-300">
            Tab: {tab} | Theme: {theme} | Density: {density}
          </p>
          {personaId && (
            <p className="text-slate-300 text-sm">Persona: {personaId}</p>
          )}
          <p className="text-slate-400 text-sm">Component porting in progress...</p>
        </div>
      </div>
    </div>
  );
}

export default function CodexEmbedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <CodexPanel />
    </Suspense>
  );
}
