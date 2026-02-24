'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MetaAvatarProvider } from '../contexts/MetaAvatarContext';

/**
 * Embed Layout
 * 
 * Chrome-free layout for embed routes (triad, codex embeds, etc.)
 * Provides QueryClient for React Query hooks without full platform UI.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  }));

  return (
    <MetaAvatarProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MetaAvatarProvider>
  );
}
