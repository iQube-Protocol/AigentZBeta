import type { ReactNode } from 'react';

type Tone = 'amber' | 'indigo' | 'cyan' | 'slate';

const TONES: Record<Tone, string> = {
  amber: 'border-amber-500/40 bg-amber-500/20 text-amber-200',
  indigo: 'border-indigo-500/40 bg-indigo-500/20 text-indigo-200',
  cyan: 'border-cyan-500/40 bg-cyan-500/20 text-cyan-200',
  slate: 'border-slate-600/60 bg-slate-900/70 text-slate-100',
};

interface CodexBadgeProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

export function CodexBadge({ tone = 'slate', className = '', children }: CodexBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase backdrop-blur-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
