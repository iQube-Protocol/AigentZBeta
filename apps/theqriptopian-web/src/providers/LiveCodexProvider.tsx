/**
 * LiveCodexProvider - Wrapper that fetches live content from QubeBase
 * and provides it to the CodexProvider
 */

import { ReactNode } from 'react';
import { CodexProvider } from '@agentiq/codex';
import { useLiveCodex } from '@/hooks/useLiveCodex';
import { issue0 } from '@/data/issue-0';

interface LiveCodexProviderProps {
  children: ReactNode;
}

export function LiveCodexProvider({ children }: LiveCodexProviderProps) {
  const { codex, isLoading, error } = useLiveCodex();
  
  // Use live codex if available, otherwise fall back to static issue-0
  const activeCodex = codex || issue0;
  
  // Show loading state only on initial load
  if (isLoading && !codex) {
    return (
      <CodexProvider
        source={{ type: 'local' }}
        initialCodex={issue0}
        autoLoadCodexId="theqriptopian-issue-0"
      >
        {children}
      </CodexProvider>
    );
  }
  
  // Log error but continue with fallback
  if (error) {
    console.warn('[LiveCodexProvider] Error fetching live content, using static fallback:', error);
  }
  
  return (
    <CodexProvider
      source={{ type: 'local' }}
      initialCodex={activeCodex}
      autoLoadCodexId="theqriptopian-issue-0"
    >
      {children}
    </CodexProvider>
  );
}
