'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MetaAvatarProvider } from '../contexts/MetaAvatarContext';
import MetaAvatar from '../components/metaVatar/MetaAvatar';
import { useMetaAvatar } from '../contexts/MetaAvatarContext';

function EmbedLayoutContent({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  }));
  const { avatarInitialized, activeContainer, avatarRefreshKey } = useMetaAvatar();

  const METAAVATAR_POSITION_CLASSES = {
    hidden: 'opacity-0 pointer-events-none -z-10',
    immersive: 'block inset-0 opacity-100 z-[140]',
    sidebar: 'block right-0 top-0 h-full w-[min(34vw,420px)] opacity-100 z-[140]',
    copilot: 'block opacity-100 z-[180]',
    codexCopilot: 'block opacity-100 z-[180]',
  } as const;

  const getAvatarPositionClasses = () => {
    if (!activeContainer) return METAAVATAR_POSITION_CLASSES.hidden;
    const key = activeContainer as keyof typeof METAAVATAR_POSITION_CLASSES;
    return METAAVATAR_POSITION_CLASSES[key] || METAAVATAR_POSITION_CLASSES.hidden;
  };

  const getAvatarPositionStyle = (): React.CSSProperties => {
    if (activeContainer === 'copilot') {
      return {
        position: 'fixed',
        zIndex: 180,
        left: 'var(--metaavatar-copilot-x, 16px)',
        top: 'var(--metaavatar-copilot-y, 96px)',
        width: 'var(--metaavatar-copilot-w, 360px)',
        height: 'var(--metaavatar-copilot-h, 320px)',
      };
    }
    if (activeContainer === 'codexCopilot') {
      return {
        position: 'fixed',
        zIndex: 180,
        left: 'var(--metaavatar-codex-x, 16px)',
        top: 'var(--metaavatar-codex-y, 96px)',
        width: 'var(--metaavatar-codex-w, 320px)',
        height: 'var(--metaavatar-codex-h, 240px)',
      };
    }
    return { position: 'fixed', zIndex: 140 };
  };

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {avatarInitialized && (
        <div className={getAvatarPositionClasses()} style={getAvatarPositionStyle()}>
          <MetaAvatar key={avatarRefreshKey} />
        </div>
      )}
    </QueryClientProvider>
  );
}

/**
 * Embed Layout
 * 
 * Chrome-free layout for embed routes (triad, codex embeds, etc.)
 * Provides QueryClient for React Query hooks without full platform UI.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <MetaAvatarProvider>
      <EmbedLayoutContent>{children}</EmbedLayoutContent>
    </MetaAvatarProvider>
  );
}
