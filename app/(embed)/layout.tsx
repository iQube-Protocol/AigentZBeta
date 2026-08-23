'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MetaAvatarProvider } from '../contexts/MetaAvatarContext';
import MetaAvatar from '../components/metaVatar/MetaAvatar';
import { useMetaAvatar } from '../contexts/MetaAvatarContext';
import { AGUIProvider } from '../components/AGUIProvider';
import { PersonaProvider } from '../contexts/PersonaContext';
import { ActivationsProvider } from '@/services/activations/ActivationsContext';
// Same shared Listen (text-to-speech) coordinator mounted in app/(shell)/
// layout.tsx — embed routes (/triad/embed/codex/...) render the same
// Qriptopian tab components (QriptoEssaysTab, QriptoPapersTab,
// KnytCommunityContentTab) via iframe, e.g. the CI/KNYTS Bridge journeys'
// "Continue reading" destination, so they need the same provider ancestor.
import { SmartContentAudioProvider } from '@/services/smartcontent/smartContentAudioController';

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
        width: 'var(--metaavatar-copilot-w, 375px)',
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
    // NO ACTIVE CONTAINER — the host stays MOUNTED (rebuilding the avatar
    // session is expensive; this file's whole design is "move it with CSS,
    // never unmount it") but it must be genuinely INERT.
    //
    // It was not. `avatarInitialized` latches true on the first avatar use and
    // never resets, so from then on this branch rendered a permanently mounted
    // `position: fixed` element — and its INLINE z-index overrode the `-z-10`
    // in the hidden class, parking an auto-sized, opacity-0 layer above the
    // copilot. An `opacity < 1` fixed layer forms its own composited stacking
    // context, which is exactly what stops `backdrop-filter` resolving on the
    // panel beneath it: the frosted backdrop silently stops rendering and the
    // near-transparent panel fill lets the page bleed through. Operator report
    // 2026-07-26 — "after the avatar has been clicked... the opacity has
    // disappeared", plus broken scrolling from the stray full-size layer.
    //
    // Zero-size + hidden + behind everything: mounted, costless, invisible.
    if (!activeContainer) {
      // display:none, nothing weaker. The first fix used visibility+zIndex on a
      // zero-size box — but a zero-size overflow:hidden wrapper does NOT clip
      // position:fixed descendants (fixed positions against the viewport), a
      // child can override inherited visibility, and an opacity-0 layer still
      // composites. display:none removes the entire subtree from rendering; no
      // child can escape it by any positioning scheme.
      //
      // As of 2026-07-27 this branch is belt-and-braces only: the host is no
      // longer RENDERED at all without an active container (see the mount gate
      // below), because the residue that kept breaking the panel beneath was
      // never inside this wrapper — the D-ID SDK injects nodes at document-body
      // level, which no wrapper style can reach. See MetaAvatar.tsx's header.
      return { display: 'none' };
    }
    return { position: 'fixed', zIndex: 140 };
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SmartContentAudioProvider>
        {children}
      </SmartContentAudioProvider>
      {/* MOUNT GATE (2026-07-27). `avatarInitialized` latches true forever, so
          on its own it kept the host — and the SDK's body-level nodes — alive
          for the rest of the session after a single avatar use. Requiring an
          ACTIVE CONTAINER means releasing the avatar unmounts it, and unmount
          sweeps the SDK's artifacts out of the document (MetaAvatar.tsx).
          Re-entering avatar mode re-injects the SDK: a deliberate reload cost,
          traded for a surface that is genuinely clean when the avatar is away. */}
      {avatarInitialized && activeContainer && (
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
    <PersonaProvider>
      <ActivationsProvider>
        <AGUIProvider>
          <MetaAvatarProvider>
            <EmbedLayoutContent>{children}</EmbedLayoutContent>
          </MetaAvatarProvider>
        </AGUIProvider>
      </ActivationsProvider>
    </PersonaProvider>
  );
}
