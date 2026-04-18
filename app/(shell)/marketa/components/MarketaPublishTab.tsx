'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileEdit, Send, CheckCircle2, Loader2, Eye, ArrowLeft,
  Globe, BookOpen, ChevronDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  status: 'draft' | 'published';
  slug?: string;
  app?: string;
  tenantId?: string;
}

interface Props {
  theme?: 'light' | 'dark';
}

// ── Publish target config ──────────────────────────────────────────────────────

const PUBLISH_TARGETS = [
  {
    codex: 'qriptopian',
    label: 'Qriptopian',
    icon: Globe,
    color: 'indigo',
    sections: [
      { slug: 'features',   label: 'Features'    },
      { slug: 'pennydrops', label: 'PennyDrops'  },
      { slug: 'scrolls',    label: 'Scrolls'     },
      { slug: 'kn0wdz',     label: '21 Kn0wdZ'  },
      { slug: 'rewards',    label: 'Rewards'     },
      { slug: 'qriptopia',  label: 'Qriptopia'   },
    ],
  },
  {
    codex: 'knyt',
    label: 'KNYT Codex',
    icon: BookOpen,
    color: 'purple',
    sections: [
      { slug: 'codex',        label: 'Codex'       },
      { slug: 'lore',         label: 'Lore'        },
      { slug: 'scrolls',      label: 'Scrolls'     },
      { slug: 'digiterra',    label: 'DigiTerra'   },
      { slug: 'terra',        label: 'Terra'       },
      { slug: 'living-canon', label: '21 Sats'     },
    ],
  },
];

// ── Theme helper ───────────────────────────────────────────────────────────────

function th(d: boolean) {
  return {
    card:          d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:     d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    previewPanel:  d ? 'bg-slate-900/80 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    publishedCard: d ? 'bg-emerald-950/20 ring-1 ring-emerald-500/20' : 'bg-emerald-50 border border-emerald-200',
    textPrimary:   d ? 'text-slate-100'  : 'text-slate-900',
    textSecondary: d ? 'text-slate-300'  : 'text-slate-700',
    textMuted:     d ? 'text-slate-400'  : 'text-slate-600',
    textSubtle:    d ? 'text-slate-500'  : 'text-slate-400',
    divider:       d ? 'border-white/[0.07]' : 'border-slate-200',
    label:         d ? 'text-slate-400 text-xs font-medium mb-1.5 block' : 'text-slate-600 text-xs font-medium mb-1.5 block',
    inputBase:     d
      ? 'w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/40 rounded-lg px-3 py-2 text-sm'
      : 'w-full bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 rounded-lg px-3 py-2 text-sm',
    textareaBase:  d
      ? 'w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/40 rounded-lg px-3 py-2.5 text-sm resize-none'
      : 'w-full bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 rounded-lg px-3 py-2.5 text-sm resize-none',
    selectBase:    d
      ? 'w-full appearance-none bg-slate-900/60 border border-white/10 text-slate-200 focus:outline-none focus:border-rose-500/40 rounded-lg px-3 py-2 text-sm'
      : 'w-full appearance-none bg-white border border-slate-300 text-slate-800 focus:outline-none focus:border-rose-400 rounded-lg px-3 py-2 text-sm',
    btnGhost:      d ? 'border border-white/10 bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]' : 'border border-slate-200 bg-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50',
    btnRose:       d ? 'border border-rose-500/30 bg-rose-500/[0.08] text-rose-300 hover:bg-rose-500/[0.15] hover:border-rose-500/40' : 'border border-rose-500/40 bg-rose-50 text-rose-700 hover:bg-rose-100',
    btnEmerald:    d ? 'border border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300 hover:bg-emerald-500/[0.15]' : 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    btnIndigo:     d ? 'border border-indigo-500/30 bg-indigo-500/[0.08] text-indigo-300 hover:bg-indigo-500/[0.15]' : 'border border-indigo-500/40 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    targetActive:  (color: string) => d
      ? `ring-1 ring-${color}-500/40 bg-${color}-500/[0.08] text-${color}-300`
      : `ring-1 ring-${color}-500/40 bg-${color}-50 text-${color}-700`,
    targetInactive: d ? 'border border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50',
  };
}

type Stage = 'form' | 'preview' | 'published';

// ── Markdown preview (simple renderer) ────────────────────────────────────────

function MarkdownPreview({ body, isDark, s }: { body: string; isDark: boolean; s: ReturnType<typeof th> }) {
  if (!body.trim()) {
    return <p className={`text-sm italic ${s.textSubtle}`}>Nothing to preview yet.</p>;
  }

  const lines = body.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('## '))
          return <h2 key={i} className={`text-base font-bold ${s.textPrimary} mt-3`}>{line.slice(3)}</h2>;
        if (line.startsWith('# '))
          return <h1 key={i} className={`text-lg font-bold ${s.textPrimary} mt-3`}>{line.slice(2)}</h1>;
        if (line.startsWith('### '))
          return <h3 key={i} className={`text-sm font-semibold ${s.textSecondary} mt-2`}>{line.slice(4)}</h3>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <div key={i} className="flex gap-2">
              <span className={`${s.textSubtle} flex-shrink-0`}>·</span>
              <p className={`text-sm ${s.textSecondary}`}>{line.slice(2)}</p>
            </div>
          );
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className={`text-sm leading-relaxed ${s.textSecondary}`}>{line}</p>;
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MarketaPublishTab({ theme = 'dark' }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  // Form state
  const [title,          setTitle]          = useState('');
  const [bodyMd,         setBodyMd]         = useState('');
  const [excerpt,        setExcerpt]        = useState('');
  const [coverUrl,       setCoverUrl]       = useState('');
  const [targetCodex,    setTargetCodex]    = useState<'qriptopian' | 'knyt'>('qriptopian');
  const [targetSection,  setTargetSection]  = useState('features');
  const [campaignTag,    setCampaignTag]    = useState('');

  // Flow state
  const [stage,          setStage]          = useState<Stage>('form');
  const [draft,          setDraft]          = useState<Article | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [publishing,     setPublishing]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [activePreview,  setActivePreview]  = useState<'content' | 'meta'>('content');

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!title.trim() || !bodyMd.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/marketa/publish/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body_markdown: bodyMd.trim(),
          excerpt: excerpt.trim() || undefined,
          cover_image_url: coverUrl.trim() || undefined,
          target_codex: targetCodex,
          target_section: targetSection,
          campaign_tag: campaignTag.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDraft(data.article);
        setStage('preview');
      } else {
        setError(data.error ?? 'Failed to save draft');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!draft?.id) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/publish/article/${draft.id}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setDraft(data.article ?? { ...draft, status: 'published' });
        setStage('published');
      } else {
        setError(data.error ?? 'Publish failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setPublishing(false);
    }
  };

  const reset = useCallback(() => {
    setTitle(''); setBodyMd(''); setExcerpt(''); setCoverUrl('');
    setTargetSection('features'); setCampaignTag('');
    setDraft(null); setStage('form'); setError(null);
  }, []);

  // ── Target config helpers ────────────────────────────────────────────────

  const activeTarget    = PUBLISH_TARGETS.find((t) => t.codex === targetCodex)!;
  const activeSection   = activeTarget.sections.find((s) => s.slug === targetSection) ?? activeTarget.sections[0];

  // ── Published state ──────────────────────────────────────────────────────
  if (stage === 'published') {
    return (
      <div className="p-3 sm:p-4 lg:p-5">
        <div className={`rounded-xl ${s.publishedCard} p-8 text-center`}>
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h3 className={`text-base font-bold ${d ? 'text-emerald-300' : 'text-emerald-700'} mb-2`}>
            Published to {activeTarget.label} — {activeSection.label}
          </h3>
          <p className={`text-sm ${d ? 'text-emerald-400/70' : 'text-emerald-600'} mb-1`}>{title}</p>
          {draft?.slug && (
            <p className={`text-[10px] font-mono ${d ? 'text-emerald-500/60' : 'text-emerald-600/70'}`}>{draft.slug}</p>
          )}
          <button
            onClick={reset}
            className={`mt-6 text-xs flex items-center gap-1.5 mx-auto ${d ? 'text-emerald-400/60 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            Write another article
          </button>
        </div>
      </div>
    );
  }

  // ── Preview state ────────────────────────────────────────────────────────
  if (stage === 'preview') {
    return (
      <div className="space-y-4 p-3 sm:p-4 lg:p-5">

        {/* Header */}
        <div className={`rounded-xl ${s.card} p-3 sm:p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-rose-400" />
              <span className={`text-sm font-semibold ${s.textPrimary}`}>Draft Preview</span>
              <Badge className={d ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                Draft
              </Badge>
            </div>
            <button
              onClick={() => setStage('form')}
              className={`flex items-center gap-1 text-xs ${s.textSubtle} hover:${s.textMuted}`}
            >
              <ArrowLeft className="w-3 h-3" />
              Back to edit
            </button>
          </div>
        </div>

        {/* Target summary */}
        <div className={`rounded-xl ${s.innerCard} px-4 py-3 flex items-center gap-3`}>
          <activeTarget.icon className={`w-4 h-4 ${d ? `text-${activeTarget.color}-400` : `text-${activeTarget.color}-600`} flex-shrink-0`} />
          <div className="min-w-0">
            <p className={`text-xs font-medium ${s.textSecondary}`}>
              Publishing to <span className={d ? `text-${activeTarget.color}-300` : `text-${activeTarget.color}-700`}>{activeTarget.label} → {activeSection.label}</span>
            </p>
            {campaignTag && (
              <p className={`text-[10px] ${s.textSubtle}`}>Campaign: {campaignTag}</p>
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className={`rounded-xl ${s.card} overflow-hidden`}>
          {/* Preview tabs */}
          <div className={`flex border-b ${s.divider}`}>
            {(['content', 'meta'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActivePreview(tab)}
                className={`px-4 py-2.5 text-xs font-medium capitalize border-b-2 transition-all ${
                  activePreview === tab
                    ? d ? 'text-slate-100 border-rose-500/60' : 'text-slate-900 border-rose-600/70'
                    : d ? 'text-slate-500 hover:text-slate-300 border-transparent' : 'text-slate-400 hover:text-slate-700 border-transparent'
                }`}
              >
                {tab === 'content' ? 'Article Content' : 'Metadata'}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {activePreview === 'content' ? (
              <div className="space-y-4">
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="w-full h-40 object-cover rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <h1 className={`text-xl font-bold leading-tight ${s.textPrimary}`}>{title || 'Untitled'}</h1>
                {excerpt && (
                  <p className={`text-sm italic ${s.textMuted} border-l-2 ${d ? 'border-rose-500/40 pl-3' : 'border-rose-300 pl-3'}`}>{excerpt}</p>
                )}
                <div className={`pt-2 border-t ${s.divider}`}>
                  <MarkdownPreview body={bodyMd} isDark={d} s={s} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'Title',    value: title },
                  { label: 'Excerpt',  value: excerpt || '—' },
                  { label: 'Target',   value: `${activeTarget.label} / ${activeSection.label}` },
                  { label: 'Campaign', value: campaignTag || '—' },
                  { label: 'Status',   value: 'Draft' },
                  { label: 'ID',       value: draft?.id ?? 'pending' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3">
                    <span className={`text-[10px] uppercase tracking-wide font-semibold w-20 flex-shrink-0 ${s.textSubtle}`}>{label}</span>
                    <span className={`text-xs ${s.textSecondary} break-all`}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Publish action */}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className={`rounded-xl ${s.card} p-3 sm:p-4`}>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handlePublish}
              disabled={publishing}
              className={`font-semibold bg-transparent ${s.btnEmerald}`}
            >
              {publishing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing…</>
                : <><Send className="w-4 h-4 mr-2" />Publish to {activeTarget.label}</>
              }
            </Button>
            <p className={`text-xs ${s.textSubtle}`}>
              Goes live in {activeSection.label} immediately.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form (default) ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Header */}
      <div className={`rounded-xl ${d ? 'bg-indigo-950/20 ring-1 ring-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
            <FileEdit className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${s.textPrimary}`}>Publish to Codex</h2>
            <p className={`text-sm mt-1 ${s.textMuted}`}>
              Write an article, select a target (Qriptopian or KNYT Codex), save as draft, preview, then publish.
            </p>
          </div>
        </div>
      </div>

      {/* Target selector */}
      <div className={`rounded-xl ${s.card} p-4 sm:p-5 space-y-4`}>
        <h3 className={`text-sm font-semibold ${s.textPrimary}`}>Publish Target</h3>

        {/* Codex selector */}
        <div>
          <label className={s.label}>Codex</label>
          <div className="flex gap-2">
            {PUBLISH_TARGETS.map((target) => (
              <button
                key={target.codex}
                onClick={() => {
                  setTargetCodex(target.codex as 'qriptopian' | 'knyt');
                  setTargetSection(target.sections[0].slug);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  targetCodex === target.codex
                    ? s.targetActive(target.color)
                    : s.targetInactive
                }`}
              >
                <target.icon className="w-3.5 h-3.5" />
                {target.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section selector */}
        <div>
          <label className={s.label}>Section</label>
          <div className="relative">
            <select
              value={targetSection}
              onChange={(e) => setTargetSection(e.target.value)}
              className={s.selectBase}
            >
              {activeTarget.sections.map((sec) => (
                <option key={sec.slug} value={sec.slug}>{sec.label}</option>
              ))}
            </select>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${s.textSubtle} pointer-events-none`} />
          </div>
        </div>

        {/* Campaign tag */}
        <div>
          <label className={s.label}>Campaign tag (optional)</label>
          <input
            type="text"
            value={campaignTag}
            onChange={(e) => setCampaignTag(e.target.value)}
            placeholder="e.g. knyt-launch, ks-prospects"
            className={s.inputBase}
          />
        </div>
      </div>

      {/* Article form */}
      <div className={`rounded-xl ${s.card} p-4 sm:p-5 space-y-4`}>
        <h3 className={`text-sm font-semibold ${s.textPrimary}`}>Article Content</h3>

        <div>
          <label className={s.label}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. KNYT Kickstarter is live — what it means for the ecosystem"
            className={s.inputBase}
          />
        </div>

        <div>
          <label className={s.label}>Body (Markdown) *</label>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={12}
            placeholder={`# Your headline\n\nStart writing your article here. Supports Markdown:\n\n## Section heading\n\nParagraph text goes here.\n\n- Bullet point one\n- Bullet point two`}
            className={s.textareaBase}
          />
          <p className={`text-[10px] mt-1 ${s.textSubtle}`}>{bodyMd.length} characters · Markdown supported</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={s.label}>Excerpt (optional)</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="One-line summary shown in feeds…"
              className={s.textareaBase}
            />
          </div>
          <div>
            <label className={s.label}>Cover image URL (optional)</label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className={s.inputBase}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || !title.trim() || !bodyMd.trim()}
            className={`font-semibold bg-transparent ${s.btnRose}`}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving draft…</>
              : <><Eye className="w-4 h-4 mr-2" />Save Draft &amp; Preview</>
            }
          </Button>
          {(!title.trim() || !bodyMd.trim()) && (
            <p className={`text-xs ${s.textSubtle}`}>Title and body are required.</p>
          )}
        </div>
      </div>

    </div>
  );
}
