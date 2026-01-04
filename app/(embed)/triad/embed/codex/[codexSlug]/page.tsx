/**
 * Dynamic Codex Embed Route
 * 
 * Supports multiple codexes via slug parameter:
 * - /triad/embed/codex/knyt
 * - /triad/embed/codex/qripto
 * - /triad/embed/codex/aigentiq
 * 
 * Query params: ?tab=scrolls&theme=dark&density=wide&personaId=xyz
 */

"use client";

import React from "react";
import CodexPanelDynamic from "@/app/triad/components/CodexPanelDynamic";

interface CodexEmbedPageProps {
  params: { codexSlug: string };
  searchParams: {
    tab?: string;
    theme?: 'light' | 'dark';
    density?: 'narrow' | 'wide';
    personaId?: string;
  };
}

export default function CodexEmbedPage({ params, searchParams }: CodexEmbedPageProps) {
  const { codexSlug } = params;
  const { tab, theme = 'dark', density = 'wide', personaId } = searchParams;

  // Convert slug to codex ID (e.g., 'knyt' -> 'knyt-codex')
  const codexId = codexSlug.endsWith('-codex') ? codexSlug : `${codexSlug}-codex`;

  return (
    <CodexPanelDynamic
      codexId={codexId}
      theme={theme}
      density={density}
      initialTab={tab}
      personaId={personaId}
      useDefaults={true}
    />
  );
}
