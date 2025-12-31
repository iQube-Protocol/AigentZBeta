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
import CodexPanel from "../../../../triad/components/CodexPanel";

function CodexContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'scrolls';
  const theme = (searchParams.get('theme') as 'light' | 'dark') || 'dark';
  const density = (searchParams.get('density') as 'narrow' | 'wide') || 'wide';

  return <CodexPanel theme={theme} density={density} initialTab={tab} />;
}

export default function CodexEmbedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="text-white">Loading KNYT Codex...</div>
      </div>
    }>
      <CodexContent />
    </Suspense>
  );
}
