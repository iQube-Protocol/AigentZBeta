'use client';

import { BookOpen, Eye, Play, Share2 } from 'lucide-react';

type Variant = 'indigo' | 'amber' | 'slate';

interface CodexActionRowProps {
  showRead?: boolean;
  showWatch?: boolean;
  showView?: boolean;
  showShare?: boolean;
  onRead?: () => void;
  onWatch?: () => void;
  onView?: () => void;
  onShare?: () => void;
  variant?: Variant;
  className?: string;
}

const VARIANTS: Record<Variant, { primary: string; secondary: string }> = {
  indigo: {
    primary:
      'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
    secondary:
      'border-slate-600 bg-slate-700/30 text-slate-200 hover:bg-slate-700/60',
  },
  amber: {
    primary:
      'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
    secondary:
      'border-slate-600 bg-slate-700/30 text-slate-200 hover:bg-slate-700/60',
  },
  slate: {
    primary:
      'border-slate-500/40 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20',
    secondary:
      'border-slate-600 bg-slate-700/30 text-slate-200 hover:bg-slate-700/60',
  },
};

export function CodexActionRow({
  showRead,
  showWatch,
  showView = true,
  showShare = false,
  onRead,
  onWatch,
  onView,
  onShare,
  variant = 'indigo',
  className,
}: CodexActionRowProps) {
  const styles = VARIANTS[variant];
  const base =
    'flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors border';

  const stop = (handler?: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    handler?.();
  };

  if (!showRead && !showWatch && !showView && !showShare) return null;

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {showRead && (
        <button
          type="button"
          onClick={stop(onRead)}
          aria-label="Read"
          className={`${base} ${styles.primary}`}
        >
          <BookOpen className="h-3 w-3" />
          Read
        </button>
      )}
      {showWatch && (
        <button
          type="button"
          onClick={stop(onWatch)}
          aria-label="Watch"
          className={`${base} ${styles.primary}`}
        >
          <Play className="h-3 w-3" />
          Watch
        </button>
      )}
      {showView && (
        <button
          type="button"
          onClick={stop(onView)}
          aria-label="View"
          className={`${base} ${styles.secondary}`}
        >
          <Eye className="h-3 w-3" />
          View
        </button>
      )}
      {showShare && (
        <button
          type="button"
          onClick={stop(onShare)}
          aria-label="Share"
          className={`${base} ${styles.secondary}`}
        >
          <Share2 className="h-3 w-3" />
          Share
        </button>
      )}
    </div>
  );
}
