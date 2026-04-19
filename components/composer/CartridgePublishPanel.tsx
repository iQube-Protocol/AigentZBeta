'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, Loader2, Globe, BookOpen } from 'lucide-react';

const TARGETS = [
  {
    codex: 'qriptopian' as const,
    label: 'Qriptopian',
    icon: Globe,
    sections: [
      { slug: 'features',   label: 'Features'   },
      { slug: 'pennydrops', label: 'PennyDrops' },
      { slug: 'scrolls',    label: 'Scrolls'    },
      { slug: 'kn0wdz',     label: '21 Kn0wdZ'  },
      { slug: 'rewards',    label: 'Rewards'    },
    ],
  },
  {
    codex: 'knyt' as const,
    label: 'KNYT Codex',
    icon: BookOpen,
    sections: [
      { slug: 'scrolls',      label: 'Scrolls'  },
      { slug: 'lore',         label: 'Lore'     },
      { slug: 'terra',        label: 'Terra'    },
      { slug: 'living-canon', label: '21 Sats'  },
    ],
  },
] as const;

type TargetCodex = typeof TARGETS[number]['codex'];

interface Props {
  prefillTitle?: string;
}

export function CartridgePublishPanel({ prefillTitle = '' }: Props) {
  const [title,         setTitle]         = useState(prefillTitle);
  const [targetCodex,   setTargetCodex]   = useState<TargetCodex>('qriptopian');
  const [targetSection, setTargetSection] = useState('features');
  const [loading,       setLoading]       = useState(false);
  const [publishedTo,   setPublishedTo]   = useState<{ label: string; section: string } | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  const activeTarget = TARGETS.find(t => t.codex === targetCodex)!;

  const handlePublish = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const createRes = await fetch('/api/marketa/publish/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body_markdown: `# ${title.trim()}\n\nPublished from ExperienceQube MCP App Inspector.`,
          target_codex: targetCodex,
          target_section: targetSection,
          campaign_tag: 'mcp-inspector',
        }),
      });
      const createData = await createRes.json();
      if (!createData.ok) throw new Error(createData.error ?? 'Failed to create draft');

      const pubRes = await fetch(`/api/marketa/publish/article/${createData.article.id}/publish`, {
        method: 'POST',
      });
      const pubData = await pubRes.json();
      if (!pubData.ok) throw new Error(pubData.error ?? 'Failed to publish');

      setPublishedTo({
        label: activeTarget.label,
        section: activeTarget.sections.find(s => s.slug === targetSection)?.label ?? targetSection,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (publishedTo) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200">
        <CheckCircle2 className="inline h-3.5 w-3.5 mr-1.5 text-emerald-400" />
        Published to <span className="font-semibold">{publishedTo.label} → {publishedTo.section}</span>. Editable in the cartridge Edit tab.
        <button
          onClick={() => { setPublishedTo(null); setTitle(prefillTitle); }}
          className="ml-2 underline opacity-70 hover:opacity-100"
        >
          Publish another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-3">
      <div className="flex items-center gap-1.5">
        <Send className="h-3.5 w-3.5 text-indigo-400" />
        <span className="text-xs font-semibold text-indigo-300">Publish to Cartridge</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={targetCodex}
          onChange={e => {
            const next = e.target.value as TargetCodex;
            setTargetCodex(next);
            setTargetSection(TARGETS.find(t => t.codex === next)!.sections[0].slug);
          }}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
        >
          {TARGETS.map(t => <option key={t.codex} value={t.codex}>{t.label}</option>)}
        </select>
        <select
          value={targetSection}
          onChange={e => setTargetSection(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
        >
          {activeTarget.sections.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
        </select>
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Article title…"
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
      />

      {error && <div className="text-xs text-rose-300">{error}</div>}

      <button
        onClick={handlePublish}
        disabled={loading || !title.trim()}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50"
      >
        {loading
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing…</>
          : <><Send className="h-3.5 w-3.5" /> Publish to Cartridge</>
        }
      </button>
    </div>
  );
}
