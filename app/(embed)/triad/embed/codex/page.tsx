/**
 * Default Codex Embed Page (Backward Compatibility)
 * 
 * Defaults to KNYT Codex for backward compatibility.
 * For new implementations, use: /triad/embed/codex/[codexSlug]
 * 
 * Query params:
 * - tab: string (optional)
 * - theme: 'light' | 'dark' (optional)
 * - density: 'narrow' | 'wide' (optional)
 * - personaId: string (optional)
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CodexPanelDynamic from "../../../../triad/components/CodexPanelDynamic";

function CodexContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || undefined;
  const theme = (searchParams.get('theme') as 'light' | 'dark') || 'dark';
  const density = (searchParams.get('density') as 'narrow' | 'wide') || 'wide';
  const personaId = searchParams.get('personaId') || undefined;

  // Default to KNYT Codex for backward compatibility
  return (
    <CodexPanelDynamic
      codexId="knyt-codex"
      theme={theme}
      density={density}
      initialTab={tab}
      personaId={personaId}
      useDefaults={true}
    />
  );
}

export default function CodexEmbedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="text-white">Loading Codex...</div>
      </div>
    }>
      <CodexContent />
    </Suspense>
  );
}
