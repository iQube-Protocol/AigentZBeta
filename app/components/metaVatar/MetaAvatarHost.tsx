'use client';

/**
 * MetaAvatarHost — the mount gate for the singleton <MetaAvatar/>, extracted
 * so standalone pages outside the (shell)/(embed) route groups can render it
 * too (2026-08-11, targeted correction pass #98).
 *
 * Root cause of "Copilot metaVatar drawer opens but the avatar never
 * renders" on /bridge/ci (and identically on /bridge/knyts): both pages wrap
 * themselves in their OWN <MetaAvatarProvider> so `useMetaAvatar()` doesn't
 * throw, but neither page — nor the root app/layout.tsx above them — ever
 * renders <MetaAvatar/> itself. That render-and-position gate previously
 * existed ONLY inside app/(shell)/layout.tsx and app/(embed)/layout.tsx,
 * neither of which wraps a plain top-level route like app/bridge/ci/page.tsx.
 * So CodexCopilotLayer's `requestAvatar('codexCopilot', ...)` updated
 * context state exactly as designed (confirmed live via the
 * `[MetaAvatar] requestAvatar: codexCopilot, agent: aigent-me` console log),
 * but nothing in the tree ever mounted the component that log implies should
 * appear — a missing mount gate, not a D-ID script failure. This is UNRELATED
 * to the separate honest-error-state fix added to MetaAvatar.tsx itself
 * (which covers a real D-ID load failure once the component IS mounted), and
 * unrelated to the "active-persona failed (504)" fix in personaRepo.ts.
 *
 * Mirrors app/(embed)/layout.tsx's position-class/style logic exactly (the
 * simpler of the two — no sidebar-relative offsets a standalone page can't
 * provide) rather than re-deriving it, per CLAUDE.md's "extend, don't
 * duplicate": one shared implementation, three mount sites use it.
 */

import { useMetaAvatar } from '@/app/contexts/MetaAvatarContext';
import MetaAvatar from '@/app/components/metaVatar/MetaAvatar';

const METAAVATAR_POSITION_CLASSES = {
  hidden: 'opacity-0 pointer-events-none -z-10',
  immersive: 'block inset-0 opacity-100 z-[140]',
  sidebar: 'block right-0 top-0 h-full w-[min(34vw,420px)] opacity-100 z-[140]',
  copilot: 'block opacity-100 z-[180]',
  codexCopilot: 'block opacity-100 z-[180]',
} as const;

export function MetaAvatarHost() {
  const { avatarInitialized, activeContainer, avatarRefreshKey } = useMetaAvatar();

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
    if (!activeContainer) return { display: 'none' };
    return { position: 'fixed', zIndex: 140 };
  };

  if (!avatarInitialized || !activeContainer) return null;

  return (
    <div className={getAvatarPositionClasses()} style={getAvatarPositionStyle()}>
      <MetaAvatar key={avatarRefreshKey} />
    </div>
  );
}

export default MetaAvatarHost;
